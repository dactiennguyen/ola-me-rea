// A minimal socket.io-client 2.x (Engine.IO 3, websocket transport only) over
// the Rust-side WebSocket (src-tauri/src/socket.rs), so an account's realtime
// channels go through its proxy. Implements just what ChatChannel uses:
// on/off/emit/connect/disconnect/connected and the connect, disconnect,
// connect_error, connect_timeout and reconnecting events.

import { Channel, invoke } from '@tauri-apps/api/core';
import type { IoFactory, SocketLike } from '@ola/core/chat.ts';

// Same shape as the core's listener type; called with the decoded event arguments.
type Listener = (...args: never[]) => void;
type WsEvent = { kind: 'open' } | { kind: 'message'; data: string } | { kind: 'closed'; reason: string };

interface IoOptions {
  path?: string;
  query?: Record<string, string>;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
}

/** io(url, options) whose sockets connect through `proxy`. */
export function rustIo(proxy: string): IoFactory {
  return (url, options) => new RustSocket(url, options as IoOptions, proxy);
}

class RustSocket implements SocketLike {
  connected = false;
  readonly #url: string;
  readonly #proxy: string;
  readonly #options: IoOptions;
  readonly #listeners = new Map<string, Set<Listener>>();
  /** Bumped on every connect/disconnect: events of an older connection are ignored. */
  #generation = 0;
  #id: number | null = null;
  /** Packets sent before ws_open returned the id (events can arrive first). */
  #queued: string[] = [];
  #wanted = false;
  #attempts = 0;
  #timers: ReturnType<typeof setTimeout>[] = [];
  #ping: ReturnType<typeof setInterval> | null = null;
  #lastPong = 0;

  constructor(url: string, options: IoOptions, proxy: string) {
    const base = url.replace(/^http/, 'ws').replace(/\/+$/, '');
    const query = new URLSearchParams({ ...options.query, EIO: '3', transport: 'websocket' });
    this.#url = `${base}${options.path ?? '/socket.io/'}?${query}`;
    this.#options = options;
    this.#proxy = proxy;
  }

  on(event: string, listener: Listener) {
    let set = this.#listeners.get(event);
    if (!set) this.#listeners.set(event, set = new Set());
    set.add(listener);
    return this;
  }

  off(event: string, listener?: Listener) {
    if (listener) this.#listeners.get(event)?.delete(listener);
    else this.#listeners.delete(event);
    return this;
  }

  emit(event: string, ...args: unknown[]) {
    this.#send(`42${JSON.stringify([event, ...args])}`);
    return this;
  }

  connect() {
    this.#wanted = true;
    this.#attempts = 0;
    this.#open();
    return this;
  }

  disconnect() {
    this.#wanted = false;
    const wasConnected = this.connected;
    if (wasConnected) this.#send('41');
    this.#teardown();
    if (wasConnected) this.#fire('disconnect', 'io client disconnect');
    return this;
  }

  #fire(event: string, ...args: unknown[]) {
    for (const listener of [...(this.#listeners.get(event) ?? [])]) {
      try { (listener as (...a: unknown[]) => void)(...args); } catch (error) { console.error(error); }
    }
  }

  #send(packet: string) {
    if (!this.connected) return;
    if (this.#id === null) { this.#queued.push(packet); return; }
    void invoke('ws_send', { id: this.#id, data: packet }).catch(() => {});
  }

  /** Closes the current connection and stops its timers, without firing events. */
  #teardown() {
    this.#generation++;
    this.connected = false;
    for (const t of this.#timers) clearTimeout(t);
    this.#timers = [];
    if (this.#ping) clearInterval(this.#ping);
    this.#ping = null;
    this.#queued = [];
    if (this.#id !== null) void invoke('ws_close', { id: this.#id }).catch(() => {});
    this.#id = null;
  }

  #open() {
    this.#teardown();
    const generation = this.#generation;
    const current = () => generation === this.#generation;
    const channel = new Channel<WsEvent>();
    channel.onmessage = event => { if (current()) this.#onEvent(event); };
    this.#timers.push(setTimeout(() => {
      if (!current() || this.connected) return;
      this.#fire('connect_timeout');
      this.#lost(false);
    }, this.#options.timeout ?? 20_000));
    invoke<number>('ws_open', { url: this.#url, proxy: this.#proxy, onEvent: channel })
      .then(id => {
        if (!current()) { void invoke('ws_close', { id }).catch(() => {}); return; }
        this.#id = id;
        for (const packet of this.#queued.splice(0)) void invoke('ws_send', { id, data: packet }).catch(() => {});
      })
      .catch(error => {
        if (!current()) return;
        this.#fire('connect_error', new Error(String(error)));
        this.#lost(false);
      });
  }

  #onEvent(event: WsEvent) {
    if (event.kind === 'closed') {
      const wasConnected = this.connected;
      if (!wasConnected) this.#fire('connect_error', new Error(event.reason));
      this.#lost(wasConnected, event.reason);
      return;
    }
    if (event.kind !== 'message') return;
    const packet = event.data;
    switch (packet[0]) {
      case '0': { // Engine.IO open: start pinging
        let interval = 25_000;
        let timeout = 60_000;
        try {
          const info = JSON.parse(packet.slice(1)) as { pingInterval?: number; pingTimeout?: number };
          interval = info.pingInterval ?? interval;
          timeout = info.pingTimeout ?? timeout;
        } catch { /* defaults */ }
        this.#lastPong = Date.now();
        this.#ping = setInterval(() => {
          if (Date.now() - this.#lastPong > interval + timeout) { this.#lost(this.connected, 'ping timeout'); return; }
          if (this.#id !== null) void invoke('ws_send', { id: this.#id, data: '2' }).catch(() => {});
        }, interval);
        break;
      }
      case '3': this.#lastPong = Date.now(); break;
      case '1': this.#lost(this.connected, 'transport close'); break;
      case '4': this.#onSocketIo(packet.slice(1)); break;
      default: break;
    }
  }

  #onSocketIo(packet: string) {
    switch (packet[0]) {
      case '0': // connected to the default namespace
        if (this.connected) return;
        this.connected = true;
        this.#attempts = 0;
        this.#fire('connect');
        break;
      case '1': this.#lost(this.connected, 'io server disconnect'); break;
      case '2': {
        try {
          const [name, ...args] = JSON.parse(packet.slice(1)) as [string, ...unknown[]];
          if (typeof name === 'string') this.#fire(name, ...args);
        } catch { /* not JSON: ignore */ }
        break;
      }
      case '4': this.#fire('connect_error', new Error(packet.slice(1))); break;
      default: break;
    }
  }

  /** The connection is gone: tell listeners, then reconnect with backoff unless closed on purpose. */
  #lost(wasConnected: boolean, reason = 'transport error') {
    this.#teardown();
    if (wasConnected) this.#fire('disconnect', reason);
    if (!this.#wanted || this.#options.reconnection === false) return;
    const base = this.#options.reconnectionDelay ?? 1000;
    const max = this.#options.reconnectionDelayMax ?? 5000;
    const delay = Math.min(max, base * 2 ** this.#attempts++);
    const generation = this.#generation;
    this.#timers.push(setTimeout(() => {
      if (generation !== this.#generation || !this.#wanted) return;
      this.#fire('reconnecting', this.#attempts);
      this.#open();
    }, delay));
  }
}
