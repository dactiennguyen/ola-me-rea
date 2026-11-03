// App settings (settings.json): app identity overrides with the APK constants as
// defaults, the Socket.IO key, and the send safety switch.
//
// The servers are not settings: the http plugin scope (capabilities/default.json)
// and the CSP (tauri.conf.json) only allow https://sgdev.vip and
// wss://sgdev.vip:3001, so another host would be refused at runtime. Changing
// servers means editing those two files and defaults.ts together.

import { buildConfig, firebaseDefaults, olaDefaults, socketDefaults, type OlaConfig } from '@ola/core/defaults.ts';
import { openJsonFile, restrictDataFile } from './platform.ts';

export interface AppSettings {
  /** Signed as the `key2` header. */
  publicKey: string;
  appVersion: string;
  androidVersion: string;
  /** Static `key` for the Socket.IO query; realtime chat needs it. */
  socketKey: string;
  /** When on, sends are logged instead of reaching the server (for UI work). */
  dryRunSends: boolean;
}

export const SERVERS = { api: olaDefaults.baseUrl, socket: socketDefaults.url } as const;

export const DEFAULT_SETTINGS: AppSettings = {
  publicKey: olaDefaults.publicKey,
  appVersion: olaDefaults.appVersion,
  androidVersion: olaDefaults.androidVersion,
  socketKey: socketDefaults.key,
  dryRunSends: false,
};

/** Settings that OlaClient reads at sign-in; changing them needs a new sign-in. */
export const SIGN_IN_SETTINGS = ['publicKey', 'appVersion', 'androidVersion'] as const satisfies readonly (keyof AppSettings)[];

const FILE = 'settings.json';

export async function loadSettings(): Promise<AppSettings> {
  const file = await openJsonFile(FILE);
  const saved = (await file.get<Partial<AppSettings>>('settings')) ?? {};
  // Keep only known keys (older files also had baseUrl/socketUrl).
  const known = Object.fromEntries(Object.entries(saved).filter(([key]) => key in DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...known };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const file = await openJsonFile(FILE);
  await file.set('settings', settings);
  await file.save();
  await restrictDataFile(FILE);
}

/** OlaConfig for one account: the same override rules as the CLI's OLA_* vars, plus that account's device id. */
export function olaConfigFor(settings: AppSettings, deviceId: string): OlaConfig {
  const { ola } = buildConfig({
    OLA_PUBLIC_KEY: settings.publicKey,
    OLA_APP_VERSION: settings.appVersion,
    OLA_ANDROID_VERSION: settings.androidVersion,
  });
  return { ...ola, deviceId };
}

export { firebaseDefaults };
