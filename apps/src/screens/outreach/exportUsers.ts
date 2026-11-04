import type { Contact } from '../../lib/sentLog.ts';
import { exportFileName } from '../../lib/accountsTransfer.ts';
import { saveExportFile } from '../../lib/platform.ts';
import { provinceName } from '../../lib/provinces.ts';
import type { Found } from './types.ts';

export type ExportFormat = 'csv' | 'json';

/**
 * Writes the given people to Downloads (CSV opens in Excel, JSON for tools).
 * Returns the saved path, or null when the browser downloaded it instead.
 */
export async function exportUsers(people: Found[], contacts: Map<string, Contact[]>, format: ExportFormat): Promise<string | null> {
  const rows = people.map(f => ({
    uid: f.user.uid,
    displayName: f.user.displayName,
    photoURL: f.user.photoURL,
    province: f.user.state ? provinceName(f.user.state) : '',
    isVip: f.user.isVip,
    verified: f.user.verified,
    level: f.user.level,
    lastSeen: f.user.lastSeen || '',
    foundBy: f.by.map(b => b.label).join(', '),
    via: f.via,
    messagedBy: (contacts.get(f.user.uid) ?? []).map(c => `${c.accountLabel} (${c.count})`).join(', '),
  }));
  const content = format === 'json'
    ? `${JSON.stringify({ format: 'ola-desktop-users', exportedAt: new Date().toISOString(), users: rows }, null, 2)}\n`
    : toCsv(rows);
  return saveExportFile(exportFileName(new Date(), 'ola-users', format), content);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    // Names come from strangers: a leading = + - @ would run as an Excel formula.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens Vietnamese text as UTF-8.
  return `﻿${[headers.join(','), ...rows.map(r => headers.map(h => cell(r[h])).join(','))].join('\r\n')}\r\n`;
}
