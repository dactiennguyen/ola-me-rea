// Node runtime configuration.
//
// Constants and override rules live in defaults.ts (platform-neutral). This file
// is the Node side: it reads scripts/nodejs/.env (gitignored) plus the process
// environment and resolves the config the CLIs use.
//
// The account used to sign in is personal, so it has NO default: set OLA_EMAIL /
// OLA_PASSWORD in scripts/nodejs/.env, never in source.

import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { accountFrom, buildConfig, type Account } from './defaults.ts';

export type { Account, FirebaseConfig, OlaConfig, SocketConfig } from './defaults.ts';

const ENV_FILE = new URL('../.env', import.meta.url);

// process.env wins over .env so a one-off `OLA_EMAIL=... node ola.ts` works.
export const env: Record<string, string | undefined> = {
  ...(existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {}),
  ...process.env,
};

const resolved = buildConfig(env);

export const firebaseConfig = resolved.firebase;
export const olaConfig = resolved.ola;
export const socketConfig = resolved.socket;

export function accountFromEnv(): Account {
  return accountFrom(env);
}
