// What differs between the Tauri window and a plain browser tab (`yarn dev`
// opened in a browser, for UI work only: Ola API calls need the Tauri http
// plugin because sgdev.vip does not allow cross-origin requests).

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { load } from '@tauri-apps/plugin-store';

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** fetch for Ola API requests: the Rust-side client in Tauri, the browser's otherwise. */
export const apiFetch: typeof fetch = isTauri
  ? (tauriFetch as typeof fetch)
  : (input, init) => window.fetch(input, init);

export type DataFileName = 'accounts.json' | 'settings.json';

/** Folder that holds accounts.json, settings.json and the message cache. */
export async function dataDir(): Promise<string | null> {
  return isTauri ? invoke<string>('data_dir') : null;
}

/** chmod 600 on a data file (no-op outside Tauri / on Windows). */
export async function restrictDataFile(name: DataFileName): Promise<void> {
  if (isTauri) await invoke('restrict_data_file', { name });
}

/**
 * Saves an account export. Tauri writes it to the Downloads folder and returns
 * the path; a browser tab downloads it and returns null.
 */
export async function saveExportFile(name: string, content: string): Promise<string | null> {
  if (isTauri) return invoke<string>('export_accounts_file', { name, content });
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  URL.revokeObjectURL(url);
  return null;
}

/** Tells the Rust side what the close button does (src-tauri/src/tray.rs). */
export async function setCloseAction(action: 'ask' | 'tray' | 'quit'): Promise<void> {
  if (isTauri) await invoke('set_close_action', { action });
}

/** A choice of the Đóng cửa sổ dialog: hide in the tray, or quit. */
export async function closeWindow(action: 'tray' | 'quit'): Promise<void> {
  if (isTauri) await invoke('close_window', { action });
}

/** The close button was pressed and the setting is Ask. Returns the unlisten function. */
export async function onCloseAsked(handler: () => void): Promise<() => void> {
  return isTauri ? listen('close-asked', () => handler()) : () => {};
}

/** A JSON file in the app data dir (Tauri store plugin), or localStorage in a browser tab. */
export interface JsonFile {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  /** Every key/value pair whose key starts with `prefix`. */
  entries<T>(prefix: string): Promise<[string, T][]>;
  save(): Promise<void>;
}

const open = new Map<string, Promise<JsonFile>>();

export function openJsonFile(name: string): Promise<JsonFile> {
  let file = open.get(name);
  if (!file) {
    file = isTauri ? openStore(name) : Promise.resolve(openLocal(name));
    open.set(name, file);
  }
  return file;
}

async function openStore(name: string): Promise<JsonFile> {
  const store = await load(name, { autoSave: false, defaults: {} });
  return {
    get: key => store.get(key),
    set: (key, value) => store.set(key, value),
    async entries<T>(prefix: string) {
      return (await store.entries<T>()).filter(([key]) => key.startsWith(prefix));
    },
    save: () => store.save(),
  };
}

function openLocal(name: string): JsonFile {
  const ns = `ola-desktop:${name}:`;
  const read = <T,>(key: string): T | undefined => {
    const raw = localStorage.getItem(ns + key);
    return raw === null ? undefined : JSON.parse(raw) as T;
  };
  return {
    async get<T>(key: string) { return read<T>(key); },
    async set(key, value) { localStorage.setItem(ns + key, JSON.stringify(value)); },
    async entries<T>(prefix: string) {
      const out: [string, T][] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const full = localStorage.key(i);
        if (!full?.startsWith(ns + prefix)) continue;
        const key = full.slice(ns.length);
        out.push([key, read<T>(key) as T]);
      }
      return out;
    },
    async save() { /* localStorage writes immediately */ },
  };
}
