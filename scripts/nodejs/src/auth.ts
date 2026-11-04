// Firebase email/password sign-in. Default: the JS SDK, session in memory only
// (Node has no browser storage; the desktop app keeps accounts itself and signs
// in again). Each sign-in gets its own Firebase app, so several accounts (e.g.
// chat A and B) can be signed in and closed independently.
//
// firebaseRestLogin() does the same over the Identity Toolkit REST API with a
// caller-supplied fetch, so every request of an account can go through that
// account's proxy (the desktop app's Rust-side fetch); the SDK always uses the
// global fetch.

import { deleteApp, initializeApp } from 'firebase/app';
import {
  initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, type User,
} from 'firebase/auth';
import { firebaseDefaults, type Account, type FirebaseConfig } from './defaults.ts';
import type { FetchLike } from './http.ts';

export interface Session {
  localId: string;
  email: string | null;
  idToken: string;
  refreshToken: string;
  expirationTime: string;
}

export interface FirebaseLogin {
  session: Session;
  user: object;
  emailVerified: boolean;
  /** A valid ID token, refreshed when it is about to expire. */
  getIdToken: () => Promise<string>;
  /** Ends this sign-in (the SDK path deletes its Firebase app, stopping SDK timers so the process can exit). */
  close: () => Promise<void>;
}

let appCount = 0;

export async function firebaseLogin(
  { email, password }: Account, firebaseConfig: FirebaseConfig = firebaseDefaults,
): Promise<FirebaseLogin> {
  const app = initializeApp(firebaseConfig, `ola-login-${++appCount}`);
  const close = () => deleteApp(app);
  let firebaseUser: User;
  try {
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    ({ user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password));
  } catch (error) {
    await close();
    // SDK codes look like auth/invalid-credential or auth/multi-factor-auth-required.
    const code = (error as { code?: unknown }).code;
    const safeCode = typeof code === 'string' && /^[a-z]+\/[a-z0-9-]+$/.test(code) ? code : 'unknown';
    throw new Error(`Firebase sign-in failed (${safeCode}).`);
  }
  const tokenResult = await firebaseUser.getIdTokenResult().catch(async (error: unknown) => {
    await close();
    throw error;
  });
  const session: Session = {
    localId: firebaseUser.uid,
    email: firebaseUser.email,
    idToken: tokenResult.token,
    refreshToken: firebaseUser.refreshToken,
    expirationTime: tokenResult.expirationTime,
  };
  return {
    session, user: firebaseUser.toJSON(), emailVerified: firebaseUser.emailVerified,
    getIdToken: () => firebaseUser.getIdToken(), close,
  };
}

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts:';
const SECURE_TOKEN = 'https://securetoken.googleapis.com/v1/token';
/** Refresh the ID token this long before it expires. */
const REFRESH_MARGIN_MS = 5 * 60_000;

/** REST error messages ("INVALID_LOGIN_CREDENTIALS", "TOO_MANY_ATTEMPTS_TRY_LATER : …") as SDK codes. */
const REST_CODES: Record<string, string> = {
  INVALID_LOGIN_CREDENTIALS: 'auth/invalid-credential',
  INVALID_PASSWORD: 'auth/invalid-credential',
  EMAIL_NOT_FOUND: 'auth/invalid-credential',
  INVALID_EMAIL: 'auth/invalid-email',
  USER_DISABLED: 'auth/user-disabled',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'auth/too-many-requests',
  TOKEN_EXPIRED: 'auth/user-token-expired',
  INVALID_REFRESH_TOKEN: 'auth/invalid-refresh-token',
};

export function restErrorCode(message: unknown): string {
  const key = typeof message === 'string' ? message.split(/[\s:]/)[0] ?? '' : '';
  return REST_CODES[key] ?? (key ? `auth/${key.toLowerCase().replace(/_/g, '-')}` : 'unknown');
}

async function restCall(fetchImpl: FetchLike, url: string, body: string, contentType: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': contentType }, body });
  } catch (error) {
    throw new Error(`Firebase sign-in failed (auth/network-request-failed): ${(error as Error).message}`);
  }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const code = restErrorCode((data.error as { message?: unknown } | undefined)?.message);
    throw new Error(`Firebase sign-in failed (${code}).`);
  }
  return data;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Email/password sign-in over REST: signInWithPassword, then accounts:lookup for emailVerified. */
export async function firebaseRestLogin(
  { email, password }: Account, fetchImpl: FetchLike, firebaseConfig: FirebaseConfig = firebaseDefaults,
): Promise<FirebaseLogin> {
  const key = `?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  const json = 'application/json';
  const signIn = await restCall(fetchImpl, `${IDENTITY}signInWithPassword${key}`, JSON.stringify({ email, password, returnSecureToken: true }), json);
  let idToken = str(signIn.idToken);
  let refreshToken = str(signIn.refreshToken);
  let expiresAt = Date.now() + Number(signIn.expiresIn ?? 3600) * 1000;
  const lookup = await restCall(fetchImpl, `${IDENTITY}lookup${key}`, JSON.stringify({ idToken }), json);
  const info = (Array.isArray(lookup.users) ? lookup.users[0] : {}) as Record<string, unknown>;
  const localId = str(signIn.localId);
  if (!idToken || !localId) throw new Error('Firebase sign-in failed (unknown).');

  let refreshing: Promise<string> | null = null;
  const getIdToken = async () => {
    if (Date.now() < expiresAt - REFRESH_MARGIN_MS) return idToken;
    refreshing ??= restCall(fetchImpl, `${SECURE_TOKEN}${key}`,
      `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`, 'application/x-www-form-urlencoded')
      .then(data => {
        idToken = str(data.id_token) || idToken;
        refreshToken = str(data.refresh_token) || refreshToken;
        expiresAt = Date.now() + Number(data.expires_in ?? 3600) * 1000;
        return idToken;
      })
      .finally(() => { refreshing = null; });
    return refreshing;
  };

  const session: Session = {
    localId,
    email: str(signIn.email) || null,
    idToken,
    refreshToken,
    expirationTime: new Date(expiresAt).toUTCString(),
  };
  const user = { uid: localId, email: session.email, emailVerified: info.emailVerified === true };
  return { session, user, emailVerified: user.emailVerified, getIdToken, close: async () => {} };
}
