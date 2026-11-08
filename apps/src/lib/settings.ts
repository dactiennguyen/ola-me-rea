// App settings (settings.json), shared by every account: the Socket.IO key, the
// send safety switch and the close button. Each account's device profile
// (device id, app/Android version, key2) lives on the account (accounts.ts).
//
// The servers are not settings: the http plugin scope (capabilities/default.json)
// and the CSP (tauri.conf.json) only allow https://sgdev.vip and
// wss://sgdev.vip:3001, so another host would be refused at runtime. Changing
// servers means editing those two files and defaults.ts together.

import { firebaseDefaults, olaDefaults, socketDefaults } from '@ola/core/defaults.ts';
import { DEVICE_FIELDS, deviceOverride, type DeviceField } from './accounts.ts';
import { openJsonFile, restrictDataFile } from './platform.ts';

export interface AppSettings {
  /** Static `key` for the Socket.IO query; realtime chat needs it. */
  socketKey: string;
  /** When on, sends are logged instead of reaching the server (for UI work). */
  dryRunSends: boolean;
  /** The window's close button: ask each time, hide in the tray, or quit (src-tauri/src/tray.rs). */
  onClose: CloseAction;
  /** Saved message texts the composer can insert (each send is still pressed by hand). */
  messageTemplates: string[];
  /** Tự trả lời: answer incoming 1-1 messages of signed-in nicks with `autoReplyText`. */
  autoReplyEnabled: boolean;
  autoReplyText: string;
  /** How many automatic replies one person can get from one nick, ever. */
  autoReplyMaxPerPerson: number;
}

export type CloseAction = 'ask' | 'tray' | 'quit';
const CLOSE_ACTIONS: readonly CloseAction[] = ['ask', 'tray', 'quit'];

export const SERVERS = { api: olaDefaults.baseUrl, socket: socketDefaults.url } as const;

export const DEFAULT_SETTINGS: AppSettings = {
  socketKey: socketDefaults.key,
  dryRunSends: false,
  onClose: 'ask',
  messageTemplates: [],
  autoReplyEnabled: false,
  autoReplyText: '',
  autoReplyMaxPerPerson: 1,
};

const FILE = 'settings.json';

export interface LoadedSettings {
  settings: AppSettings;
  /**
   * Device values older files kept app-wide (publicKey/appVersion/androidVersion)
   * when they differed from the APK defaults; the session copies them onto the
   * accounts that have none, then saves settings without them.
   */
  legacyDevice: Partial<Record<DeviceField, string>>;
}

export async function loadSettings(): Promise<LoadedSettings> {
  const file = await openJsonFile(FILE);
  const saved = (await file.get<Record<string, unknown>>('settings')) ?? {};
  // Keep only known keys (older files also had baseUrl/socketUrl).
  const known = Object.fromEntries(Object.entries(saved).filter(([key]) => key in DEFAULT_SETTINGS));
  const settings = { ...DEFAULT_SETTINGS, ...known } as AppSettings;
  if (!CLOSE_ACTIONS.includes(settings.onClose)) settings.onClose = DEFAULT_SETTINGS.onClose;
  settings.messageTemplates = Array.isArray(settings.messageTemplates)
    ? settings.messageTemplates.filter((t): t is string => typeof t === 'string' && Boolean(t.trim()))
    : [];
  settings.autoReplyEnabled = settings.autoReplyEnabled === true;
  if (typeof settings.autoReplyText !== 'string') settings.autoReplyText = '';
  if (!Number.isInteger(settings.autoReplyMaxPerPerson) || settings.autoReplyMaxPerPerson < 1) settings.autoReplyMaxPerPerson = DEFAULT_SETTINGS.autoReplyMaxPerPerson;
  const legacyDevice: LoadedSettings['legacyDevice'] = {};
  for (const field of DEVICE_FIELDS) {
    const value = deviceOverride(field, typeof saved[field] === 'string' ? saved[field] : undefined);
    if (value) legacyDevice[field] = value;
  }
  return { settings, legacyDevice };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const file = await openJsonFile(FILE);
  await file.set('settings', settings);
  await file.save();
  await restrictDataFile(FILE);
}

export { firebaseDefaults };
