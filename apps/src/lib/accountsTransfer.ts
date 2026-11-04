// Import/export of the account list. The export is plain JSON with passwords,
// like accounts.json itself; the UI says so. Import also takes one account per
// line ("email|mật khẩu", or tab, comma, semicolon or colon between them).

import type { StoredAccount } from './accounts.ts';

export const EXPORT_FORMAT = 'ola-desktop-accounts';

export interface TransferAccount {
  email: string;
  password: string;
  label?: string;
  deviceId?: string;
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
    accounts: accounts.map(a => ({ label: a.label, email: a.email, password: a.password, deviceId: a.deviceId })),
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
    add(out, `Mục ${i + 1}`, {
      email: typeof entry?.email === 'string' ? entry.email : '',
      password: typeof entry?.password === 'string' ? entry.password : '',
      label: typeof entry?.label === 'string' ? entry.label : undefined,
      deviceId: typeof entry?.deviceId === 'string' ? entry.deviceId : undefined,
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
    add(out, `Dòng ${i + 1}`, { email: line.slice(0, at), password: line.slice(at + 1) });
  });
  return dedupe(out);
}

function add(out: ParsedImport, where: string, entry: TransferAccount) {
  const email = entry.email.trim();
  if (!EMAIL.test(email)) { out.problems.push(`${where}: email không hợp lệ.`); return; }
  if (!entry.password) { out.problems.push(`${where}: thiếu mật khẩu.`); return; }
  const deviceId = entry.deviceId?.trim();
  if (deviceId && !DEVICE_ID.test(deviceId)) { out.problems.push(`${where}: device ID không hợp lệ.`); return; }
  out.accounts.push({
    email, password: entry.password,
    ...(entry.label?.trim() && { label: entry.label.trim() }),
    ...(deviceId && { deviceId }),
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
  /** Existing accounts (same email) whose password or label changes. */
  updated: TransferAccount[];
  unchanged: number;
}

export function planImport(existing: StoredAccount[], incoming: TransferAccount[]): ImportPlan {
  const byEmail = new Map(existing.map(a => [a.email.toLowerCase(), a]));
  const plan: ImportPlan = { added: [], updated: [], unchanged: 0 };
  for (const entry of incoming) {
    const current = byEmail.get(entry.email.toLowerCase());
    if (!current) plan.added.push(entry);
    else if (current.password !== entry.password || (entry.label && entry.label !== current.label)) plan.updated.push(entry);
    else plan.unchanged++;
  }
  return plan;
}
