// Import/export of the account list. The export is plain JSON with passwords
// and proxies, like accounts.json itself; the UI says so. Import also takes one
// account per line ("email|mật khẩu", or tab, comma, semicolon or colon between
// them; "email|mật khẩu|proxy" adds a proxy).

import { DEVICE_FIELDS, deviceOverride, type DeviceField, type StoredAccount } from './accounts.ts';
import { parseProxy } from './proxy.ts';

export const EXPORT_FORMAT = 'ola-desktop-accounts';

export interface TransferAccount extends Partial<Record<DeviceField, string>> {
  email: string;
  password: string;
  label?: string;
  deviceId?: string;
  /** Normalized proxy URL (parseProxy). */
  proxy?: string;
}

export interface ParsedImport {
  accounts: TransferAccount[];
  /** One line per rejected entry, e.g. "Dòng 3: email không hợp lệ". */
  problems: string[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEVICE_ID = /^[A-Za-z0-9_.-]{4,64}$/;
/** The first of these on a line splits email from password; emails never contain them, passwords may. */
const SEPARATOR = /[|\t,;:]/;

export function exportAccounts(accounts: StoredAccount[], now = new Date()): string {
  return `${JSON.stringify({
    format: EXPORT_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    accounts: accounts.map(a => ({
      label: a.label, email: a.email, password: a.password, deviceId: a.deviceId,
      ...Object.fromEntries(DEVICE_FIELDS.filter(f => a[f]).map(f => [f, a[f]])),
      ...(a.proxy && { proxy: a.proxy }),
    })),
  }, null, 2)}\n`;
}

/** ola-accounts-YYYYMMDD-HHMMSS.json in local time (src-tauri accepts only this shape). */
export function exportFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `ola-accounts-${date}-${time}.json`;
}

export function parseImport(text: string): ParsedImport {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { accounts: [], problems: ['Không có dữ liệu để nhập.'] };
  return trimmed.startsWith('{') || trimmed.startsWith('[') ? parseJson(trimmed) : parseLines(trimmed);
}

function parseJson(text: string): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { accounts: [], problems: ['File JSON không đọc được.'] };
  }
  const list = Array.isArray(data) ? data : (data as { accounts?: unknown })?.accounts;
  if (!Array.isArray(list)) return { accounts: [], problems: ['JSON không có danh sách "accounts".'] };
  const out: ParsedImport = { accounts: [], problems: [] };
  list.forEach((item, i) => {
    const entry = item as Partial<Record<keyof TransferAccount, unknown>> | null;
    const text = (key: keyof TransferAccount) => (typeof entry?.[key] === 'string' ? entry[key] as string : undefined);
    add(out, `Mục ${i + 1}`, {
      email: text('email') ?? '',
      password: text('password') ?? '',
      label: text('label'),
      deviceId: text('deviceId'),
      proxy: text('proxy'),
      ...Object.fromEntries(DEVICE_FIELDS.map(f => [f, deviceOverride(f, text(f))]).filter(([, v]) => v)),
    });
  });
  return dedupe(out);
}

function parseLines(text: string): ParsedImport {
  const out: ParsedImport = { accounts: [], problems: [] };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const at = line.search(SEPARATOR);
    if (at < 0) {
      out.problems.push(`Dòng ${i + 1}: thiếu mật khẩu (dạng email|mật khẩu).`);
      return;
    }
    let password = line.slice(at + 1);
    let proxy: string | undefined;
    // "email|mật khẩu|proxy": the part after the last | is a proxy when it reads as one.
    const last = password.lastIndexOf('|');
    if (line[at] === '|' && last > 0) {
      const tail = parseProxy(password.slice(last + 1));
      if (tail && 'url' in tail) { proxy = tail.url; password = password.slice(0, last); }
    }
    add(out, `Dòng ${i + 1}`, { email: line.slice(0, at), password, ...(proxy && { proxy }) });
  });
  return dedupe(out);
}

function add(out: ParsedImport, where: string, entry: TransferAccount) {
  const email = entry.email.trim();
  if (!EMAIL.test(email)) { out.problems.push(`${where}: email không hợp lệ.`); return; }
  if (!entry.password) { out.problems.push(`${where}: thiếu mật khẩu.`); return; }
  const deviceId = entry.deviceId?.trim();
  if (deviceId && !DEVICE_ID.test(deviceId)) { out.problems.push(`${where}: device ID không hợp lệ.`); return; }
  const proxy = parseProxy(entry.proxy);
  if (proxy && 'error' in proxy) { out.problems.push(`${where}: ${proxy.error}.`); return; }
  out.accounts.push({
    email, password: entry.password,
    ...(proxy && { proxy: proxy.url }),
    ...(entry.label?.trim() && { label: entry.label.trim() }),
    ...(deviceId && { deviceId }),
    ...Object.fromEntries(DEVICE_FIELDS.filter(f => entry[f]).map(f => [f, entry[f]])),
  });
}

/** One entry per email (case-insensitive); the last one wins. */
function dedupe(out: ParsedImport): ParsedImport {
  const byEmail = new Map<string, TransferAccount>();
  for (const a of out.accounts) byEmail.set(a.email.toLowerCase(), a);
  return { accounts: [...byEmail.values()], problems: out.problems };
}

export interface ImportPlan {
  added: TransferAccount[];
  /** Existing accounts (same email) whose password, label or proxy changes. */
  updated: TransferAccount[];
  unchanged: number;
}

export function planImport(existing: StoredAccount[], incoming: TransferAccount[]): ImportPlan {
  const byEmail = new Map(existing.map(a => [a.email.toLowerCase(), a]));
  const plan: ImportPlan = { added: [], updated: [], unchanged: 0 };
  for (const entry of incoming) {
    const current = byEmail.get(entry.email.toLowerCase());
    if (!current) plan.added.push(entry);
    else if (current.password !== entry.password || (entry.label && entry.label !== current.label)
      || (entry.proxy && entry.proxy !== current.proxy)) plan.updated.push(entry);
    else plan.unchanged++;
  }
  return plan;
}
