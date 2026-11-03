#!/usr/bin/env node
// Firebase sign-in + napi/users/sync with the account from scripts/nodejs/.env,
// then print the session, Firebase user and Ola profile.

import { loginFromEnv } from './src/node.ts';
import { runMain } from './src/run.ts';

export async function main(args = process.argv.slice(2), output = console.log): Promise<void> {
  if (args.includes('--help')) {
    output('Usage: node scripts/nodejs/login.ts [--firebase-only]\n'
      + 'Reads OLA_EMAIL / OLA_PASSWORD from scripts/nodejs/.env (copy .env.example).');
    return;
  }
  if (args.some(arg => arg !== '--firebase-only')) throw new Error('Unknown argument; use --help.');
  const client = await loginFromEnv({ firebaseOnly: args.includes('--firebase-only') });
  try {
    output('Firebase signInWithEmailAndPassword: OK');
    output(JSON.stringify(client.session, null, 2));
    output('Firebase user: OK');
    output(JSON.stringify(client.user, null, 2));
    if (client.profile) {
      output('Ola /napi/users/sync: OK');
      output(JSON.stringify(client.profile, null, 2));
    }
  } finally {
    await client.close();
  }
}

if (import.meta.main) runMain(() => main());
