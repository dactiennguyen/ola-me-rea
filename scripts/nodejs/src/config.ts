// Runtime configuration.
//
// App constants (Firebase client config, key2, app version) were recovered from
// the APK and live here. The account used to sign in is personal, so it is read
// from scripts/nodejs/.env (gitignored) or the environment, never from source.

import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const ENV_FILE = new URL('../.env', import.meta.url);

// process.env wins over .env so a one-off `OLA_EMAIL=... node ola.ts` works.
const env: Record<string, string | undefined> = {
  ...(existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {}),
  ...process.env,
};

export const firebaseConfig = {
  apiKey: 'AIzaSyDbgTrrzTslO1iXyyUhCa2F9d-On2TUbtg',
  projectId: 'olaachat',
  databaseURL: 'https://olaachat.firebaseio.com',
  storageBucket: 'olaachat.appspot.com',
  messagingSenderId: '211539470356',
  appId: '1:211539470356:android:54d93ae0ba01751b',
  oauthClientId: '211539470356-6qpsdsshh6klat94t7vc5llf9663l1dh.apps.googleusercontent.com',
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
  baseUrl: 'https://sgdev.vip/',
  publicKey: '49|S4f(vcVKIZ',
  deviceId: env.OLA_DEVICE_ID || 'nodejs-probe',
  appVersion: '27.7.8',
  androidVersion: '13',
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
