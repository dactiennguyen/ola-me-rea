import { invoke } from '@tauri-apps/api/core';
import { parseGoogleSession, type GoogleSessionExport } from '@ola/core/firebase-session.ts';

export type { GoogleSessionExport };
import { isTauri } from './platform.ts';

function desktopOnly() {
  if (!isTauri) throw new Error('Nhập phiên Google cần mở Ola Desktop; bản chạy trong trình duyệt không lưu phiên này.');
}
export async function getGoogleToken(id: string): Promise<string> {
  desktopOnly(); return invoke('google_session_get', { id });
}
export async function setGoogleToken(id: string, token: string): Promise<void> {
  desktopOnly(); return invoke('google_session_set', { id, token });
}
export async function deleteGoogleToken(id: string): Promise<void> {
  desktopOnly(); return invoke('google_session_delete', { id });
}

/** The JSON the Android exporter copies (plaintext `ola-google-session`). */
export function readGoogleSessionJson(text: string): GoogleSessionExport {
  if (text.length > 100_000) throw new Error('Nội dung phiên quá lớn.');
  let data: unknown;
  try { data = JSON.parse(text.trim()); } catch { throw new Error('Không phải JSON hợp lệ. Dán đúng nội dung xuất từ Ola Session Exporter.'); }
  return parseGoogleSession(data);
}

/** True for the encrypted-file variant, which needs a password. */
export function isEncryptedSession(text: string): boolean {
  try { return (JSON.parse(text.trim()) as { format?: unknown }).format === 'ola-google-session-encrypted'; } catch { return false; }
}

/** File made by Android exporter: PBKDF2-SHA256 + AES-256-GCM, no plaintext tokens in UI. */
export async function decryptGoogleExport(text: string, password: string): Promise<GoogleSessionExport> {
  if (text.length > 100_000) throw new Error('File phiên quá lớn.');
  let d: Record<string, unknown>;
  try { d = JSON.parse(text); } catch { throw new Error('File phiên không phải JSON hợp lệ.'); }
  if (!d || d.format !== 'ola-google-session-encrypted' || d.version !== 1 || d.iterations !== 210000) {
    throw new Error('Hãy chọn file .ola-session.json xuất bằng Ola Session Exporter.');
  }
  try {
    const bytes = (v: unknown) => {
      if (typeof v !== 'string') throw new Error();
      return Uint8Array.from(atob(v), c => c.charCodeAt(0));
    };
    const salt = bytes(d.salt), iv = bytes(d.iv), cipher = bytes(d.ciphertext);
    if (salt.length !== 16 || iv.length !== 12 || cipher.length < 16) throw new Error();
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210000 },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return parseGoogleSession(JSON.parse(new TextDecoder().decode(plain)));
  } catch { throw new Error('Không mở được file: mật khẩu không đúng hoặc file bị hỏng.'); }
}
