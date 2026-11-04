// Chat over Socket.IO 2.x (EIO=3) plus the HTTP calls the app makes around it.
//
// Platform-neutral: the caller injects socket.io-client 2.x's `io` function, so
// this module has no dependency and runs in Node tests and in the desktop
// webview. Wire shapes follow docs/api/luong-chat-1-1.md, luong-phong-chat.md
// and socket-io.md (app 27.7.8). Response shapes for room history/members were
// observed on 2026-11-04 (keys only); conversation items are not observed yet,
// so normalizeConversations() accepts several field names.

import type { OlaClient } from './client.ts';
import type { SocketConfig } from './defaults.ts';
import type { JsonObject } from './endpoint.ts';
import { addLastMessage5 } from './endpoints/addLastMessage5.ts';
import { addUserToRoom } from './endpoints/addUserToRoom.ts';
import { apiAddMessageRoom2 } from './endpoints/apiAddMessageRoom2.ts';
import { apiAddToRoomV4 } from './endpoints/apiAddToRoomV4.ts';
import { checkBlockChat } from './endpoints/checkBlockChat.ts';
import { generalSendNotification } from './endpoints/generalSendNotification.ts';
import { getLastMessage2 } from './endpoints/getLastMessage2.ts';
import { getMessageByRoom } from './endpoints/getMessageByRoom.ts';
import { getUserInfoForChatV2 } from './endpoints/getUserInfoForChatV2.ts';
import { md5Hex } from './md5.ts';

// ---- socket ------------------------------------------------------------------

type Listener = (...args: never[]) => void;

/** The part of a socket.io-client 2.x Socket this module uses. */
export interface SocketLike {
  readonly connected: boolean;
  on(event: string, listener: Listener): unknown;
  off(event: string, listener?: Listener): unknown;
  emit(event: string, ...args: unknown[]): unknown;
  connect(): unknown;
  disconnect(): unknown;
}

/** socket.io-client 2.x `io(url, options)`. */
export type IoFactory = (url: string, options: Record<string, unknown>) => SocketLike;

export type ChannelState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

/** The channel the personal inbox listens on, and the broadcast channel. */
export const BROADCAST_ROOM = 'Olame';

export interface ChannelOptions {
  io: IoFactory;
  socket: SocketConfig;
  /** `roomNo` query: own uid (inbox), peer uid (1-1), province code (room) or Olame. */
  roomNo: string;
  /** Emitted as `add user {username, roomNo}` after each connect, when given. */
  joinAs?: string;
  reconnect?: boolean;
}

/**
 * One Socket.IO connection, like the app's per-screen Manager (forceNew,
 * websocket only, `key` + `roomNo` in the query).
 */
export class ChatChannel {
  readonly roomNo: string;
  state: ChannelState = 'idle';
  #socket: SocketLike;
  #joinAs: string | undefined;
  #stateListeners = new Set<(state: ChannelState) => void>();

  constructor({ io, socket, roomNo, joinAs, reconnect = true }: ChannelOptions) {
    if (!socket.key.trim()) throw new Error('Missing socket key (OLA_SOCKET_KEY); set it in Settings.');
    this.roomNo = roomNo;
    this.#joinAs = joinAs;
    this.#socket = io(socket.url, {
      path: '/socket.io/',
      transports: ['websocket'],
      query: { key: socket.key, roomNo },
      forceNew: true,
      autoConnect: false,
      reconnection: reconnect,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      timeout: 15000,
    });
    this.#socket.on('connect', () => {
      if (this.#joinAs) this.#socket.emit('add user', { username: this.#joinAs, roomNo });
      this.#setState('connected');
    });
    this.#socket.on('disconnect', () => this.#setState('disconnected'));
    this.#socket.on('connect_error', () => this.#setState('error'));
    this.#socket.on('connect_timeout', () => this.#setState('error'));
    this.#socket.on('reconnecting', () => this.#setState('connecting'));
  }

  get connected(): boolean { return this.#socket.connected; }

  connect(): this {
    this.#setState('connecting');
    this.#socket.connect();
    return this;
  }

  close(): void {
    this.#socket.disconnect();
    this.#setState('idle');
    this.#stateListeners.clear();
  }

  onState(listener: (state: ChannelState) => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  /** `new message` events, as received ({username, message} wrapper or bare payload). */
  onMessage(listener: (raw: unknown) => void): () => void {
    const handler = ((raw: unknown) => listener(raw)) as Listener;
    this.#socket.on('new message', handler);
    return () => { this.#socket.off('new message', handler); };
  }

  /** `user joined` / `user left` with {username, numUsers}. */
  onPresence(listener: (event: { type: 'joined' | 'left'; username: string; numUsers: number | null }) => void): () => void {
    const make = (type: 'joined' | 'left') => ((raw: unknown) => {
      const o = asObject(raw);
      listener({ type, username: str(o.username), numUsers: num(o.numUsers) });
    }) as Listener;
    const joined = make('joined');
    const left = make('left');
    this.#socket.on('user joined', joined);
    this.#socket.on('user left', left);
    return () => { this.#socket.off('user joined', joined); this.#socket.off('user left', left); };
  }

  onTyping(listener: (typing: boolean) => void): () => void {
    const start = (() => listener(true)) as Listener;
    const stop = (() => listener(false)) as Listener;
    this.#socket.on('typing', start);
    this.#socket.on('stop typing', stop);
    return () => { this.#socket.off('typing', start); this.#socket.off('stop typing', stop); };
  }

  typing(active: boolean): void {
    if (this.#socket.connected) this.#socket.emit(active ? 'typing' : 'stop typing');
  }

  /** Emits `new message`; throws when the socket is not connected. */
  emitMessage(payload: JsonObject): void {
    if (!this.#socket.connected) throw new Error('Realtime channel is not connected.');
    this.#socket.emit('new message', payload);
  }

  #setState(state: ChannelState) {
    this.state = state;
    for (const listener of this.#stateListeners) listener(state);
  }
}

// ---- profile & payloads ------------------------------------------------------

/** What chat payloads need from the signed-in Ola profile. Never the whole profile. */
export interface ChatProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  isVip: boolean;
  level: number;
  isVerifyAvatar: number;
}

/** Picks the chat fields out of napi/users/sync's user object (which holds more, e.g. secrets). */
export function chatProfile(profile: unknown, uid: string): ChatProfile {
  const p = asObject(profile);
  return {
    uid,
    displayName: str(p.displayName) || 'Ola',
    photoURL: str(p.photoURL),
    isVip: truthy(p.isVip),
    level: num(p.level) ?? 1,
    isVerifyAvatar: num(p.isVerifyAvatar) ?? 0,
  };
}

/** Client-generated message id: ms timestamp + sender uid (the app does the same). */
export const newMessageId = (uid: string, now = Date.now()) => `${now}${uid}`;

export function directMessagePayload({ from, text, recipientFcmToken = '', now = Date.now() }: {
  from: ChatProfile; text: string; recipientFcmToken?: string; now?: number;
}): JsonObject {
  return {
    mess: text, photoURL2: '', displayName: from.displayName, photoURL: from.photoURL,
    userID: from.uid, send: true, read: false, messageID: newMessageId(from.uid, now),
    isSticker: null, replyID: '', replyText: '', isVip: from.isVip,
    isImage: 0, isGift: 0, isAudio: 0, fcmTokenNguoiNhan: recipientFcmToken,
  };
}

export function roomMessagePayload({ from, deviceId, text, now = Date.now() }: {
  from: ChatProfile; deviceId: string; text: string; now?: number;
}): JsonObject {
  return {
    deviceID: deviceId, mess: text, name: from.displayName, userID: from.uid,
    photoURL2: from.photoURL, send: 1, id: newMessageId(from.uid, now), isVip: from.isVip, level: from.level,
  };
}

// ---- normalized models -------------------------------------------------------

export type MessageKind = 'text' | 'image' | 'sticker' | 'gift' | 'audio';

export interface ChatMessage {
  id: string;
  text: string;
  fromUid: string;
  fromName: string;
  fromPhoto: string;
  /** Unix ms. */
  at: number;
  outgoing: boolean;
  kind: MessageKind;
  isVip: boolean;
}

/**
 * Control/presence signals that ride the `new message` event instead of being
 * chat text: the payload carries an `action` (e.g. `VIEW_PROFILE`) and/or a
 * reserved `mess` token. The app acts on them (profile view, reaction, recall)
 * rather than showing them, so normalizeMessage drops them. `MOFIFY` is the
 * app's own spelling (observed in the APK and on the wire).
 */
const CONTROL_MESS = new Set([
  'REQUEST_MOFIFY_MESSAGE', // profile view / modify signal (carries `action`)
  'REMOVE_MESS',            // message recall
  'THA_TIM',                // heart reaction
  'REACT_ROOM',             // room reaction
]);

/**
 * A `new message` event or a stored message (room history) as a ChatMessage, or
 * null for control signals and empty payloads (so they never render as bubbles).
 */
export function normalizeMessage(raw: unknown, myUid: string): ChatMessage | null {
  const outer = asObject(raw);
  const m = outer.message && typeof outer.message === 'object' ? asObject(outer.message) : outer;
  const id = str(m.messageID) || str(m.id);
  const fromUid = str(m.userID) || str(m.uid);
  if (!id && !fromUid) return null;
  const sentAt = num(m.timestamp) ?? leadingMs(id);
  const text = str(m.mess) || str(m.content);
  const kind: MessageKind = truthy(m.isImage) ? 'image' : truthy(m.isSticker) ? 'sticker'
    : truthy(m.isGift) ? 'gift' : truthy(m.isAudio) ? 'audio' : 'text';
  // Control signal (has an action, or a reserved mess token): not a chat message.
  if (str(m.action) || CONTROL_MESS.has(text)) return null;
  // Text message with nothing to show (empty mess, no media): a system/presence
  // ping, not something to render.
  if (!text && kind === 'text') return null;
  return {
    // Without an id the fallback must not depend on when it was loaded, or the
    // same stored message gets a new id (and a duplicate row) on every load.
    id: id || (sentAt !== null ? `${sentAt}${fromUid}` : `h${md5Hex(`${fromUid}\n${kind}\n${text}`)}`),
    text,
    fromUid,
    fromName: str(m.displayName) || str(m.name) || str(outer.username),
    fromPhoto: str(m.photoURL) || str(m.photoURL2),
    // No time in the data: show it as received now (the id above stays stable).
    at: sentAt ?? Date.now(),
    outgoing: fromUid === myUid,
    kind,
    isVip: truthy(m.isVip),
  };
}

export interface Conversation {
  peerUid: string;
  peerName: string;
  peerPhoto: string;
  lastText: string;
  lastFromMe: boolean;
  /** Unix ms, 0 when unknown. */
  at: number;
  unread: number;
}

/** getLastMessage2 → conversations, newest first. Item fields are not observed yet. */
export function normalizeConversations(raw: unknown, myUid: string): Conversation[] {
  const out: Conversation[] = [];
  for (const item of listOf(raw)) {
    const o = asObject(item);
    const candidates = [o.peerID, o.friendID, o.uid, o.userID, o.id, o.roomID].map(str).filter(Boolean);
    const peerUid = candidates.find(v => v !== myUid && !/^\d{13}/.test(v));
    if (!peerUid) continue;
    out.push({
      peerUid,
      peerName: str(o.displayName) || str(o.name) || str(o.peerName),
      peerPhoto: str(o.photoURL) || str(o.photoURL2) || str(o.avatar),
      lastText: str(o.content) || str(o.mess) || str(o.lastMessage) || str(o.message),
      lastFromMe: str(o.uid) === myUid || str(o.sender) === myUid,
      at: num(o.timestamp) ?? num(o.time) ?? leadingMs(str(o.id)) ?? 0,
      unread: num(o.unread) ?? num(o.countUnread) ?? num(o.count) ?? 0,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

export interface ChatUser {
  uid: string;
  displayName: string;
  photoURL: string;
  fcmToken: string;
  isVip: boolean;
  /** isVerifyAvatar: the avatar passed face verification. */
  verified: boolean;
  level: number;
  lastSeen: number;
  /** Province code (`state`), '' when unset. */
  state: string;
  isNew: boolean;
}

/** getUserInfoForChatV2 / member rows / Explore items → ChatUser. */
export function normalizeUser(raw: unknown, fallbackUid = ''): ChatUser {
  const outer = asObject(raw);
  const nested = outer.data ?? outer.user ?? (Array.isArray(outer.list_data) ? outer.list_data[0] : undefined);
  const o = asObject(Array.isArray(nested) ? nested[0] : nested ?? outer);
  return {
    uid: str(o.uid) || fallbackUid,
    displayName: str(o.displayName) || str(o.name),
    photoURL: str(o.photoURL) || str(o.photoURL2),
    fcmToken: str(o.fcmToken),
    isVip: truthy(o.isVip),
    verified: truthy(o.isVerifyAvatar),
    level: num(o.level) ?? 0,
    lastSeen: num(o.lastSeen) ?? 0,
    state: str(o.state) === '0' ? '' : str(o.state),
    isNew: truthy(o.isNew),
  };
}

// ---- flows -------------------------------------------------------------------

export async function loadConversations(ola: OlaClient): Promise<Conversation[]> {
  return normalizeConversations(await ola.call(getLastMessage2), ola.session.localId);
}

export async function loadChatUser(ola: OlaClient, uid: string): Promise<ChatUser> {
  return normalizeUser(await ola.call(getUserInfoForChatV2, { id: uid }), uid);
}

export interface RoomSnapshot {
  messages: ChatMessage[];
  blocked: boolean;
}

/**
 * The HTTP part of entering a room, in the app's order: addUserToRoom (writes:
 * marks the account present), getMessageByRoom, checkBlockChat.
 */
export async function enterRoom(ola: OlaClient, roomID: string): Promise<RoomSnapshot> {
  await ola.call(addUserToRoom, { state: roomID });
  const history = await ola.call(getMessageByRoom, { roomID });
  const block = asObject(await ola.call(checkBlockChat));
  const myUid = ola.session.localId;
  const messages = listOf(history)
    .map(item => normalizeMessage(item, myUid))
    .filter((m): m is ChatMessage => m !== null)
    .sort((a, b) => a.at - b.at);
  return { messages, blocked: block.isBlock === true };
}

export async function loadRoomMembers(ola: OlaClient, roomID: string, page = 0): Promise<ChatUser[]> {
  return listOf(await ola.call(apiAddToRoomV4, { state: roomID, page })).map(item => normalizeUser(item));
}

/** Outcome of each independent step; the app's sends are not a transaction. */
export interface SendResult {
  message: ChatMessage;
  steps: { name: string; ok: boolean; error?: string }[];
}

async function step(steps: SendResult['steps'], name: string, run: () => unknown) {
  try {
    await run();
    steps.push({ name, ok: true });
  } catch (error) {
    steps.push({ name, ok: false, error: (error as Error).message });
  }
}

/**
 * The local echo of a text message this client just sent. Built directly (not
 * through normalizeMessage) so it is never dropped, even if the user typed text
 * that happens to equal a control token. Also used by the app's dry-run mode.
 */
export function localTextMessage(id: string, from: ChatProfile, text: string, at: number): ChatMessage {
  return {
    id, text, fromUid: from.uid, fromName: from.displayName, fromPhoto: from.photoURL,
    at, outgoing: true, kind: 'text', isVip: from.isVip,
  };
}

/**
 * 1-1 send in the app's order: socket emit on the peer channel, push via
 * napi/general/send-notification (only with the recipient's FCM token), then
 * addLastMessage5. Stops before HTTP when the emit fails (nothing was delivered).
 */
export async function sendDirectMessage(ola: OlaClient, channel: ChatChannel, {
  from, peer, text, now = Date.now(),
}: { from: ChatProfile; peer: ChatUser; text: string; now?: number }): Promise<SendResult> {
  const payload = directMessagePayload({ from, text, recipientFcmToken: peer.fcmToken, now });
  const steps: SendResult['steps'] = [];
  const message = localTextMessage(String(payload.messageID), from, text, now);
  channel.emitMessage(payload);
  steps.push({ name: 'socket', ok: true });
  if (peer.fcmToken) {
    await step(steps, 'push', () => ola.call(generalSendNotification, {
      token: peer.fcmToken, title: from.displayName, body: text,
      data: {
        action: 'chat', photo: '', messageID: payload.messageID, isSticker: null, isImage: 0, isGift: 0,
        isAudio: 0, replyText: '', replyID: '', fcmToken: '',
        user: { uid: from.uid, photoURL: from.photoURL, displayName: from.displayName },
      },
    }));
  }
  await step(steps, 'lastMessage', () => ola.call(addLastMessage5, {
    userID: peer.uid, content: text, timestamp: now, id: String(payload.messageID),
  }));
  return { message, steps };
}

/** Room send in the app's order: socket emit, then apiAddMessageRoom2 (same payload + roomID). */
export async function sendRoomMessage(ola: OlaClient, channel: ChatChannel, {
  from, roomID, deviceId, text, now = Date.now(),
}: { from: ChatProfile; roomID: string; deviceId: string; text: string; now?: number }): Promise<SendResult> {
  const payload = roomMessagePayload({ from, deviceId, text, now });
  const steps: SendResult['steps'] = [];
  const message = localTextMessage(String(payload.id), from, text, now);
  channel.emitMessage(payload);
  steps.push({ name: 'socket', ok: true });
  await step(steps, 'save', () => ola.call(apiAddMessageRoom2, {
    roomID, mess: text, name: from.displayName, deviceID: deviceId, photoURL2: from.photoURL,
    id: String(payload.id), level: from.level, isVip: from.isVip, isVerifyAvatar: from.isVerifyAvatar,
  }));
  return { message, steps };
}

// ---- helpers -----------------------------------------------------------------

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Flags arrive as true, 1, '1' or a positive level (isVip can be a tier). */
function truthy(value: unknown): boolean {
  if (value === true || value === 'true') return true;
  const n = num(value);
  return n !== null && n > 0;
}

/** The ms timestamp a client id starts with (`<13 digits><uid>`). */
function leadingMs(id: string): number | null {
  const match = /^(\d{13})/.exec(id);
  return match ? Number(match[1]) : null;
}

/** The list in a response: `data`, `list_data`, or the response itself. */
function listOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const o = asObject(raw);
  for (const key of ['data', 'list_data', 'messages', 'list']) {
    if (Array.isArray(o[key])) return o[key] as unknown[];
  }
  return [];
}
