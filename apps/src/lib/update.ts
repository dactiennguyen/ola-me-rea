// Tự cập nhật (src-tauri/src/update.rs; apps/docs/05-phat-hanh.md#tự-cập-nhật): the UI only reads the state, asks for a
// check, asks to install, and hears the "update" event. The updater plugin itself is not exposed to the webview.

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isTauri } from './platform.ts';

/** UpdateView of update.rs: the version running, and where the update stands. */
export type UpdateView = { current: string } & (
  | { state: 'off'; reason: string }
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'latest'; checkedAt: number }
  | { state: 'downloading'; version: string; notes: string; got: number; total: number | null }
  | { state: 'available'; version: string; notes: string }
  | { state: 'installing'; version: string }
  | { state: 'failed'; message: string; checkedAt: number }
);

/** Checks now; a newer version found is only shown (state "available"), never installed on its own. */
export const checkUpdate = (): Promise<void> => (isTauri ? invoke('check_update') : Promise.resolve());

/** Cập nhật: downloads the version found, installs it and opens the app again. */
export const installUpdate = (): Promise<void> => (isTauri ? invoke('install_update') : Promise.resolve());

/** The update the user asked for is being downloaded or installed. */
export const isUpdating = (u: UpdateView | null): boolean => u?.state === 'downloading' || u?.state === 'installing';

/** The update state, kept current by the "update" event. Null outside Tauri (a browser tab never updates). */
export function useUpdate(): UpdateView | null {
  const [view, setView] = useState<UpdateView | null>(null);
  useEffect(() => {
    if (!isTauri) {
      if (import.meta.env.DEV) setView(preview());
      return;
    }
    let alive = true;
    let newer = false;
    const unlisten = listen<UpdateView>('update', e => { newer = true; if (alive) setView(e.payload); });
    // An event newer than the answer of update_status wins.
    void invoke<UpdateView>('update_status').then(v => { if (alive && !newer) setView(v); }).catch(() => {});
    return () => { alive = false; void unlisten.then(stop => stop()); };
  }, []);
  return view;
}

const MB = 1_048_576;
/** Bytes as "12,3" MB, the Vietnamese way. */
export const mb = (n: number): string => (n / MB).toFixed(1).replace('.', ',');

/** `yarn dev` in a browser, for UI work only: ?update=<state> shows that state of the status bar. */
function preview(): UpdateView | null {
  const state = new URLSearchParams(location.search).get('update');
  const notes = 'Đăng nhập Google gộp vào form đăng nhập.\n\nNút Kiểm tra cập nhật ở góc phải dưới.';
  const base = { current: '0.8.0' };
  switch (state) {
    case 'latest': return { ...base, state, checkedAt: Date.now() };
    case 'checking': case 'idle': return { ...base, state };
    case 'available': return { ...base, state, version: '0.9.0', notes };
    case 'downloading': return { ...base, state, version: '0.9.0', notes, got: 3_800_000, total: 7_600_000 };
    case 'installing': return { ...base, state, version: '0.9.0' };
    case 'failed': return { ...base, state, message: 'không tải được từ GitHub (error sending request)', checkedAt: Date.now() };
    case 'off': return { ...base, state, reason: 'bản chạy từ mã nguồn hay bản portable, không phải bản cài' };
    default: return null;
  }
}
