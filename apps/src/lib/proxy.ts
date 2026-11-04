// Per-account proxy. An account with a proxy sends everything through it from
// the Rust side: Ola API and Firebase sign-in (http plugin with `proxy`), and
// the realtime sockets (src-tauri/src/socket.rs). Without a proxy the account
// uses the webview paths as before.

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauri } from './platform.ts';

const SCHEMES = ['http', 'socks5', 'socks5h'] as const;
const SCHEME_ALIASES: Record<string, string> = { socks: 'socks5', sock5: 'socks5', socks5: 'socks5', socks5h: 'socks5h', http: 'http' };

export type ParsedProxy = { url: string } | { error: string };

const HOST = /^(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)$/;
/** Looks like a host a proxy vendor would give: an IP, a domain with a dot, localhost or [IPv6]. */
const LIKELY_HOST = /^(?:\[[0-9A-Fa-f:.]+\]|\d{1,3}(?:\.\d{1,3}){3}|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+|localhost)$/i;
const isPort = (s: string | undefined) => !!s && /^\d{1,5}$/.test(s) && Number(s) >= 1 && Number(s) <= 65535;
const isHostPort = (host: string | undefined, port: string | undefined) => !!host && LIKELY_HOST.test(host) && isPort(port);

const FORMATS = 'host:cổng, host:cổng:user:pass, user:pass:host:cổng, user:pass@host:cổng, host:cổng@user:pass hoặc http:// / socks5://…';

function build(scheme: string, host: string, port: string, user?: string, password?: string): ParsedProxy {
  if (!HOST.test(host)) return { error: `Host proxy không hợp lệ: ${host}` };
  if (!isPort(port)) return { error: `Cổng proxy không hợp lệ: ${port}` };
  const auth = user ? `${encodeURIComponent(user)}${password !== undefined ? `:${encodeURIComponent(password)}` : ''}@` : '';
  return { url: `${scheme}://${auth}${host}:${Number(port)}` };
}

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** "host:port" with an optional [IPv6] host. */
function splitHostPort(text: string): [string, string] | null {
  const m = /^(\[[^\]]+\]|[^:\s]+):(\d+)$/.exec(text.trim());
  return m ? [m[1]!, m[2]!] : null;
}

/** "user:pass" (the password may contain ':'). */
function splitCredentials(text: string): [string, string | undefined] {
  const colon = text.indexOf(':');
  return colon < 0 ? [decode(text), undefined] : [decode(text.slice(0, colon)), decode(text.slice(colon + 1))];
}

/**
 * Reads a proxy pasted in the usual vendor formats; scheme defaults to http:
 *
 * - `http://user:pass@host:port`, `socks5://…`, `socks5h://…`, `socks://…`
 * - `user:pass@host:port`, `host:port@user:pass`
 * - `host:port`, `host:port:user:pass`, `user:pass:host:port`
 * - the same with `|`, `;`, `,`, tab or spaces between parts (`host port user pass`)
 * - a scheme word in front (`socks5 host:port:user:pass`), surrounding spaces or
 *   extra lines (the first non-empty line is used)
 *
 * Returns a normalized URL, or an error in Vietnamese. Empty text means no proxy.
 */
export function parseProxy(text: string | undefined): ParsedProxy | null {
  let rest = (text ?? '').split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? '';
  if (!rest) return null;
  let scheme = 'http';
  const prefix = /^([a-z0-9]+):\/\//i.exec(rest) ?? /^(https?|socks5h?|socks|sock5)\s+/i.exec(rest);
  if (prefix) {
    const named = prefix[1]!.toLowerCase();
    if (named === 'https') return { error: 'Không hỗ trợ proxy https:// (proxy "HTTP/HTTPS" thường là http://, thử dán lại với http://)' };
    const resolved = SCHEME_ALIASES[named];
    if (!resolved || !(SCHEMES as readonly string[]).includes(resolved)) return { error: `Không hỗ trợ proxy ${named}:// (dùng http:// hoặc socks5://)` };
    scheme = resolved;
    rest = rest.slice(prefix[0].length).trim();
  }
  rest = rest.replace(/\/+$/, '');

  // user:pass@host:port, or the vendor variant host:port@user:pass.
  const at = rest.lastIndexOf('@');
  if (at >= 0) {
    const left = rest.slice(0, at);
    const right = rest.slice(at + 1);
    const rightHost = splitHostPort(right);
    const leftHost = splitHostPort(left);
    if (rightHost) return build(scheme, rightHost[0], rightHost[1], ...splitCredentials(left));
    if (leftHost && LIKELY_HOST.test(leftHost[0])) return build(scheme, leftHost[0], leftHost[1], ...splitCredentials(right));
    return { error: `Không đọc được proxy. Dạng hỗ trợ: ${FORMATS}` };
  }

  // Parts separated by spaces, tabs, | ; , or ':' (an [IPv6] host is kept whole).
  const parts = /[\s|;,]/.test(rest)
    ? rest.split(/[\s|;,]+/).flatMap(p => (p.startsWith('[') ? [p] : p.split(':'))).filter(p => p !== '')
    : rest.startsWith('[')
      ? [rest.slice(0, rest.indexOf(']') + 1), ...rest.slice(rest.indexOf(']') + 2).split(':')]
      : rest.split(':');
  if (parts.length === 2) return build(scheme, parts[0]!, parts[1]!);
  if (parts.length >= 4) {
    // host:port:user:pass (the password may contain ':').
    if (isHostPort(parts[0], parts[1])) return build(scheme, parts[0]!, parts[1]!, parts[2], parts.slice(3).join(':'));
    // user:pass:host:port.
    const n = parts.length;
    if (isHostPort(parts[n - 2], parts[n - 1])) return build(scheme, parts[n - 2]!, parts[n - 1]!, parts[0], parts.slice(1, n - 2).join(':'));
    // Fall back to the most common order.
    return build(scheme, parts[0]!, parts[1]!, parts[2], parts.slice(3).join(':'));
  }
  return { error: `Không đọc được proxy. Dạng hỗ trợ: ${FORMATS}` };
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
