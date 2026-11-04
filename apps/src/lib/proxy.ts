// Per-account proxy. An account with a proxy sends everything through it from
// the Rust side: Ola API and Firebase sign-in (http plugin with `proxy`), and
// the realtime sockets (src-tauri/src/socket.rs). Without a proxy the account
// uses the webview paths as before.

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauri } from './platform.ts';

const SCHEMES = ['http', 'socks5', 'socks5h'] as const;

export type ParsedProxy = { url: string } | { error: string };

const HOST = /^[A-Za-z0-9.-]+$|^\[[0-9A-Fa-f:]+\]$/;

function build(scheme: string, host: string, port: string, user?: string, password?: string): ParsedProxy {
  if (!HOST.test(host)) return { error: `Host proxy không hợp lệ: ${host}` };
  const n = Number(port);
  if (!/^\d+$/.test(port) || n < 1 || n > 65535) return { error: `Cổng proxy không hợp lệ: ${port}` };
  const auth = user ? `${encodeURIComponent(user)}${password !== undefined ? `:${encodeURIComponent(password)}` : ''}@` : '';
  return { url: `${scheme}://${auth}${host}:${n}` };
}

/**
 * Accepts `scheme://[user:pass@]host:port`, `user:pass@host:port`,
 * `host:port` and `host:port:user:pass` (scheme defaults to http). Returns a
 * normalized URL, or an error in Vietnamese. Empty text means no proxy.
 */
export function parseProxy(text: string | undefined): ParsedProxy | null {
  let rest = (text ?? '').trim();
  if (!rest) return null;
  let scheme = 'http';
  const prefix = /^([a-z0-9]+):\/\//i.exec(rest);
  if (prefix) {
    scheme = prefix[1]!.toLowerCase();
    if (scheme === 'socks') scheme = 'socks5';
    if (!(SCHEMES as readonly string[]).includes(scheme)) return { error: `Không hỗ trợ proxy ${scheme}:// (dùng http:// hoặc socks5://)` };
    rest = rest.slice(prefix[0].length).replace(/\/+$/, '');
  }
  const at = rest.lastIndexOf('@');
  if (at >= 0) {
    const cred = rest.slice(0, at);
    const [host, port, ...extra] = rest.slice(at + 1).split(':');
    if (!host || !port || extra.length) return { error: 'Proxy phải có dạng host:cổng' };
    const colon = cred.indexOf(':');
    const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
    return colon < 0 ? build(scheme, host, port, decode(cred)) : build(scheme, host, port, decode(cred.slice(0, colon)), decode(cred.slice(colon + 1)));
  }
  const parts = rest.split(':');
  if (parts.length === 2) return build(scheme, parts[0]!, parts[1]!);
  // host:port:user:pass (the password may itself contain ':').
  if (parts.length >= 4) return build(scheme, parts[0]!, parts[1]!, parts[2], parts.slice(3).join(':'));
  return { error: 'Proxy phải có dạng host:cổng, host:cổng:user:pass hoặc http://user:pass@host:cổng' };
}

/** The normalized proxy of a stored value, or undefined (no proxy or invalid). */
export function proxyUrl(text: string | undefined): string | undefined {
  const parsed = parseProxy(text);
  return parsed && 'url' in parsed ? parsed.url : undefined;
}

/** "socks5 1.2.3.4:1080 (có user)": safe to show, without the password. */
export function proxyLabel(text: string | undefined): string {
  const url = proxyUrl(text);
  if (!url) return text?.trim() ? 'proxy không hợp lệ' : '';
  const m = /^(\w+):\/\/(?:([^@]*)@)?(.+)$/.exec(url)!;
  return `${m[1]} ${m[3]}${m[2] ? ' (có user)' : ''}`;
}

/** fetch through `proxy` on the Rust side (Tauri only). */
export function proxiedFetch(proxy: string): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    tauriFetch(input, { ...init, proxy: { all: proxy } })) as typeof fetch;
}

/** The public IP seen through the proxy, to check that it works. */
export async function checkProxy(text: string): Promise<string> {
  const parsed = parseProxy(text);
  if (!parsed) throw new Error('Chưa nhập proxy.');
  if ('error' in parsed) throw new Error(parsed.error);
  if (!isTauri) throw new Error('Chỉ kiểm tra được trong app (không chạy trong trình duyệt).');
  const response = await proxiedFetch(parsed.url)('https://api.ipify.org/?format=json', {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Proxy trả lỗi HTTP ${response.status}`);
  const { ip } = await response.json() as { ip?: string };
  if (!ip) throw new Error('Không đọc được IP');
  return ip;
}
