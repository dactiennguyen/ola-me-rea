// Log of sent 1-1 messages: SQLite messages.db on the Rust side
// (src-tauri/src/sentlog.rs); localStorage in a browser tab (yarn dev).

import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './platform.ts';

export interface SentEntry {
  sentAt: number;
  accountId: string;
  accountUid: string;
  accountLabel: string;
  peerUid: string;
  peerName: string;
  messageId: string;
  text: string;
  /** Screen the message was sent from: 'messages' (an account's Tin nhắn) or 'outreach'. */
  source: string;
  /** null: no push was attempted (no fcmToken). */
  pushOk: boolean | null;
  /** addLastMessage5 result; null: not attempted. */
  lastMessageOk: boolean | null;
  error: string | null;
  /** Chế độ thử: shown locally, not sent. */
  dryRun: boolean;
}

export interface SentRow extends SentEntry { id: number }

/** One peer and sending account: count of real (not dry-run) messages and the last time. */
export interface Contact {
  peerUid: string;
  accountId: string;
  accountLabel: string;
  count: number;
  lastSentAt: number;
}

const KEY = 'ola-desktop:sent-messages';
const listeners = new Set<() => void>();

function browserRows(): SentRow[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SentRow[]; } catch { return []; }
}

export async function logSent(entry: SentEntry): Promise<void> {
  if (isTauri) {
    await invoke('sent_log_add', { entry });
  } else {
    const rows = browserRows();
    rows.push({ ...entry, id: (rows.at(-1)?.id ?? 0) + 1 });
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-1000)));
  }
  for (const listener of listeners) listener();
}

export async function recentSent(limit = 100): Promise<SentRow[]> {
  if (isTauri) return invoke<SentRow[]>('sent_log_recent', { limit });
  return browserRows().sort((a, b) => b.sentAt - a.sentAt || b.id - a.id).slice(0, limit);
}

export async function sentContacts(): Promise<Contact[]> {
  if (isTauri) return invoke<Contact[]>('sent_log_contacts');
  const byKey = new Map<string, Contact>();
  for (const r of browserRows().filter(r => !r.dryRun).sort((a, b) => a.sentAt - b.sentAt)) {
    const key = `${r.peerUid}|${r.accountId}`;
    const c = byKey.get(key);
    byKey.set(key, { peerUid: r.peerUid, accountId: r.accountId, accountLabel: r.accountLabel, count: (c?.count ?? 0) + 1, lastSentAt: r.sentAt });
  }
  return [...byKey.values()];
}

/** Called after every logged message; returns the unsubscribe function. */
export function onSentLogged(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
