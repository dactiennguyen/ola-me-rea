// Runtime configuration.
//
// App/server constants (Firebase client config, Ola base URL, key2, app version)
// were recovered from the APK. They ship as built-in defaults and can be overridden
// per-environment via scripts/nodejs/.env or the process environment.
//
// The account used to sign in is personal, so it has NO default: set OLA_EMAIL /
// OLA_PASSWORD in scripts/nodejs/.env (gitignored), never in source.

import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const ENV_FILE = new URL('../.env', import.meta.url);

// process.env wins over .env so a one-off `OLA_EMAIL=... node ola.ts` works.
const env: Record<string, string | undefined> = {
  ...(existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {}),
  ...process.env,
};

// Read env var NAME, falling back to the built-in default when unset or blank.
const envOr = (name: string, fallback: string): string => {
  const value = env[name];
  return value && value.trim() ? value : fallback;
};

export const firebaseConfig = {
  apiKey: envOr('OLA_FIREBASE_API_KEY', 'AIzaSyDbgTrrzTslO1iXyyUhCa2F9d-On2TUbtg'),
  projectId: envOr('OLA_FIREBASE_PROJECT_ID', 'olaachat'),
  databaseURL: envOr('OLA_FIREBASE_DATABASE_URL', 'https://olaachat.firebaseio.com'),
  storageBucket: envOr('OLA_FIREBASE_STORAGE_BUCKET', 'olaachat.appspot.com'),
  messagingSenderId: envOr('OLA_FIREBASE_MESSAGING_SENDER_ID', '211539470356'),
  appId: envOr('OLA_FIREBASE_APP_ID', '1:211539470356:android:54d93ae0ba01751b'),
  oauthClientId: envOr('OLA_FIREBASE_OAUTH_CLIENT_ID', '211539470356-6qpsdsshh6klat94t7vc5llf9663l1dh.apps.googleusercontent.com'),
} as const;

export interface OlaConfig {
  baseUrl: string;
  /** Signed as the `key2` header. */
  publicKey: string;
  /** Signed as the `deviceid` header; napi/users/sync must send the same value. */
  deviceId: string;
  /** App version, sent as the `ver` header. */
  appVersion: string;
  /** Android version, sent as `ver` in the napi/users/sync body. */
  androidVersion: string;
}

export const olaConfig: OlaConfig = {
  baseUrl: envOr('OLA_BASE_URL', 'https://sgdev.vip/'),
  publicKey: envOr('OLA_PUBLIC_KEY', '49|S4f(vcVKIZ'),
  deviceId: envOr('OLA_DEVICE_ID', 'nodejs-probe'),
  appVersion: envOr('OLA_APP_VERSION', '27.7.8'),
  androidVersion: envOr('OLA_ANDROID_VERSION', '13'),
};

export interface Account {
  email: string;
  password: string;
}

export function accountFromEnv(): Account {
  const email = env.OLA_EMAIL;
  const password = env.OLA_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing OLA_EMAIL / OLA_PASSWORD: copy .env.example to scripts/nodejs/.env and fill them in.');
  }
  return { email, password };
}
