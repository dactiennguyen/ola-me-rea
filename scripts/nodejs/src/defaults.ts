// Platform-neutral configuration: the constants recovered from the APK plus
// buildConfig(), which applies OLA_* overrides from whatever env map the caller
// has. No Node imports here, so the client core also runs in a browser/webview
// (the Tauri app in apps/). Node's .env loading lives in config.ts.

export interface FirebaseConfig {
  apiKey: string;
  projectId: string;
  databaseURL: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  oauthClientId: string;
}

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

export interface SocketConfig {
  /** Socket.IO 2.x (EIO=3) server for chat. */
  url: string;
  /** Static `key` query value the app sends on every connection (app-wide constant). */
  key: string;
}

export interface Account {
  email: string;
  password: string;
}

export type EnvMap = Readonly<Record<string, string | undefined>>;

export const firebaseDefaults: FirebaseConfig = {
  apiKey: 'AIzaSyDbgTrrzTslO1iXyyUhCa2F9d-On2TUbtg',
  projectId: 'olaachat',
  databaseURL: 'https://olaachat.firebaseio.com',
  storageBucket: 'olaachat.appspot.com',
  messagingSenderId: '211539470356',
  appId: '1:211539470356:android:54d93ae0ba01751b',
  oauthClientId: '211539470356-6qpsdsshh6klat94t7vc5llf9663l1dh.apps.googleusercontent.com',
};

export const olaDefaults: OlaConfig = {
  baseUrl: 'https://sgdev.vip/',
  publicKey: '49|S4f(vcVKIZ',
  deviceId: 'nodejs-probe',
  appVersion: '27.7.8',
  androidVersion: '13',
};

export const socketDefaults: SocketConfig = {
  url: 'https://sgdev.vip:3001',
  // Static handshake key, the same for every user and connection. It is the
  // `wasabiKeyID` field of the plaintext secrets JSON embedded in
  // libnative-lib.so; the app reuses that constant as the Socket.IO `key` query.
  // Recovered 2026-11-04 from the APK and a live connection (docs/api/socket-io.md).
  key: '6Q5AY7RZVR06LFAA07TC',
};

/** The trimmed env value, or the fallback when it is unset or blank. */
export function envOr(env: EnvMap, name: string, fallback: string): string {
  const value = env[name]?.trim();
  return value ? value : fallback;
}

export interface ResolvedConfig {
  firebase: FirebaseConfig;
  ola: OlaConfig;
  socket: SocketConfig;
}

/** Built-in defaults with OLA_* overrides from `env` applied. */
export function buildConfig(env: EnvMap = {}): ResolvedConfig {
  const f = firebaseDefaults;
  const o = olaDefaults;
  return {
    firebase: {
      apiKey: envOr(env, 'OLA_FIREBASE_API_KEY', f.apiKey),
      projectId: envOr(env, 'OLA_FIREBASE_PROJECT_ID', f.projectId),
      databaseURL: envOr(env, 'OLA_FIREBASE_DATABASE_URL', f.databaseURL),
      storageBucket: envOr(env, 'OLA_FIREBASE_STORAGE_BUCKET', f.storageBucket),
      messagingSenderId: envOr(env, 'OLA_FIREBASE_MESSAGING_SENDER_ID', f.messagingSenderId),
      appId: envOr(env, 'OLA_FIREBASE_APP_ID', f.appId),
      oauthClientId: envOr(env, 'OLA_FIREBASE_OAUTH_CLIENT_ID', f.oauthClientId),
    },
    ola: {
      baseUrl: envOr(env, 'OLA_BASE_URL', o.baseUrl),
      publicKey: envOr(env, 'OLA_PUBLIC_KEY', o.publicKey),
      deviceId: envOr(env, 'OLA_DEVICE_ID', o.deviceId),
      appVersion: envOr(env, 'OLA_APP_VERSION', o.appVersion),
      androidVersion: envOr(env, 'OLA_ANDROID_VERSION', o.androidVersion),
    },
    socket: {
      url: envOr(env, 'OLA_SOCKET_URL', socketDefaults.url),
      key: envOr(env, 'OLA_SOCKET_KEY', socketDefaults.key),
    },
  };
}

/** OLA_EMAIL / OLA_PASSWORD from `env`; the account has no default. */
export function accountFrom(env: EnvMap): Account {
  const email = env.OLA_EMAIL;
  const password = env.OLA_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing OLA_EMAIL / OLA_PASSWORD: copy .env.example to scripts/nodejs/.env and fill them in.');
  }
  return { email, password };
}
