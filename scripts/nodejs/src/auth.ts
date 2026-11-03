// Firebase email/password sign-in with the JS SDK. Node has no browser storage,
// so the session lives in memory for this process only. Each sign-in gets its
// own Firebase app, so several accounts (e.g. chat A and B) can be signed in and
// closed independently.

import { deleteApp, initializeApp } from 'firebase/app';
import {
  initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, type User,
} from 'firebase/auth';
import { firebaseConfig, type Account } from './config.ts';

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
  firebaseUser: User;
  /** Deletes this sign-in's Firebase app, stopping SDK timers so the process can exit. */
  close: () => Promise<void>;
}

let appCount = 0;

export async function firebaseLogin({ email, password }: Account): Promise<FirebaseLogin> {
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
  return { session, user: firebaseUser.toJSON(), firebaseUser, close };
}
