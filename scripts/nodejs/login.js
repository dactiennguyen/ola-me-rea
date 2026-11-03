#!/usr/bin/env node
'use strict';

// Node >= 18. Run `yarn install` in scripts/nodejs first (Firebase JS SDK).
const username = 'dactiennguyen01@gmail.com';
const password = '';
const firebaseConfig = {
  "apiKey": "AIzaSyDbgTrrzTslO1iXyyUhCa2F9d-On2TUbtg",
  "projectId": "olaachat",
  "databaseURL": "https://olaachat.firebaseio.com",
  "storageBucket": "olaachat.appspot.com",
  "messagingSenderId": "211539470356",
  "appId": "1:211539470356:android:54d93ae0ba01751b",
  "oauthClientId": "211539470356-6qpsdsshh6klat94t7vc5llf9663l1dh.apps.googleusercontent.com"
};
const olaConfig = {
  "baseUrl": "https://sgdev.vip/",
  "publicKey": "49|S4f(vcVKIZ",
  "deviceId": "nodejs-probe",
  "appVersion": "27.7.8",
  "androidVersion": "13"
};
const { createHash } = require('node:crypto');
const { initializeApp, deleteApp } = require('firebase/app');
const { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword } = require('firebase/auth');

async function requestJson(url, { method = 'POST', headers = {}, body } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method, redirect: 'error',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const code = error.cause?.code || error.name;
    const safeCode = /^[A-Z_a-z0-9]+$/.test(code) ? code : 'NETWORK_ERROR';
    throw new Error(`${new URL(url).pathname}: ${safeCode} (TLS verification remains enabled).`);
  }
  let data;
  try { data = await response.json(); } catch {
    throw new Error(`HTTP ${response.status}: expected JSON response`);
  }
  // Some legacy responses contain JSON encoded as a string.
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { /* validated by caller */ }
  }
  if (!response.ok) {
    const code = data?.error?.message;
    const safeCode = typeof code === 'string' && /^[A-Z_0-9 :.-]{1,120}$/.test(code)
      ? ` (${code})` : '';
    throw new Error(`HTTP ${response.status}${safeCode}`);
  }
  return data;
}

let firebaseAuth;

// Node has no browser storage, so the session lives in memory for this process only.
function getFirebaseAuth() {
  if (!firebaseAuth) {
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('<')) {
      throw new Error('Missing firebaseConfig.apiKey.');
    }
    const app = initializeApp(firebaseConfig, 'ola-login');
    firebaseAuth = initializeAuth(app, { persistence: inMemoryPersistence });
  }
  return firebaseAuth;
}

async function firebaseLogin({ email, password }) {
  if (!email || !password) throw new Error('Fill in const username and const password at the top of login.js.');
  let credential;
  try {
    credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  } catch (error) {
    // SDK codes look like auth/invalid-credential or auth/multi-factor-auth-required.
    const code = typeof error.code === 'string' && /^[a-z]+\/[a-z0-9-]+$/.test(error.code)
      ? error.code : 'unknown';
    throw new Error(`Firebase sign-in failed (${code}).`);
  }
  const firebaseUser = credential.user;
  const tokenResult = await firebaseUser.getIdTokenResult();
  const session = {
    localId: firebaseUser.uid,
    email: firebaseUser.email,
    idToken: tokenResult.token,
    refreshToken: firebaseUser.refreshToken,
    expirationTime: tokenResult.expirationTime,
  };
  // firebaseUser.getIdToken() returns a refreshed token once the 1h ID token expires.
  return { session, user: firebaseUser.toJSON(), firebaseUser };
}

// Stops SDK timers so a finished CLI process can exit.
async function closeFirebase() {
  if (!firebaseAuth) return;
  const { app } = firebaseAuth;
  firebaseAuth = undefined;
  await deleteApp(app);
}

function olaHeaders({ token, key2, deviceId, appVersion, timestamp, requestPath }) {
  const slash = requestPath.lastIndexOf('/');
  const suffix = slash < 0 ? '' : requestPath.slice(slash);
  // ApiClient request interceptor, app 27.7.8: UTF8 -> MD5 -> lowercase hex.
  const hash = createHash('md5').update(`${timestamp - 888}${deviceId}${suffix}`, 'utf8').digest('hex');
  return {
    key2, deviceid: deviceId, os: 'android', ver: appVersion,
    timestamp: String(timestamp), hash,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// getTimes is signed with local time; every other call is signed with serverTime.
async function getServerTime({ key2, deviceId, appVersion }) {
  const requestPath = 'napi/general/getTimes';
  const times = await requestJson(`${olaConfig.baseUrl}${requestPath}`, {
    method: 'GET', headers: olaHeaders({ key2, deviceId, appVersion,
      timestamp: Math.floor(Date.now() / 1000), requestPath }),
  });
  const timestamp = Number(times?.serverTime);
  if (!Number.isSafeInteger(timestamp) || timestamp < 1 || timestamp > 100000000000) {
    throw new Error('Unexpected serverTime; refusing to sign with an invalid timestamp.');
  }
  return timestamp;
}

async function requestOla(token, requestPath, body, {
  key2 = olaConfig.publicKey, deviceId = olaConfig.deviceId, appVersion = olaConfig.appVersion,
} = {}) {
  if (!key2) throw new Error('Missing olaConfig.publicKey.');
  if (!/^(napi|faApi2)\/[A-Za-z0-9/_.-]+$/.test(requestPath)) throw new Error('Invalid Ola API path.');
  const timestamp = await getServerTime({ key2, deviceId, appVersion });
  return requestJson(`${olaConfig.baseUrl}${requestPath}`, {
    headers: olaHeaders({ token, key2, deviceId, appVersion, timestamp, requestPath }), body,
  });
}

async function syncOla({
  token, key2 = olaConfig.publicKey, deviceId = olaConfig.deviceId,
  appVersion = olaConfig.appVersion, androidVersion = olaConfig.androidVersion,
}) {
  const data = await requestOla(token, 'napi/users/sync',
    { os: 'android', deviceId, ver: androidVersion, displayName: '', photoURL: '' },
    { key2, deviceId, appVersion });
  if (!data?.user || typeof data.user !== 'object') {
    throw new Error('Ola sync returned HTTP success without a user object.');
  }
  return data.user;
}

function printLoginResult({ session, user, profile }, output = console.log) {
  output('Firebase signInWithEmailAndPassword: OK');
  output(JSON.stringify(session, null, 2));
  output('Firebase user: OK');
  output(JSON.stringify(user, null, 2));
  if (profile) {
    output('Ola /napi/users/sync: OK');
    output(JSON.stringify(profile, null, 2));
  }
}

async function login({ firebaseOnly = false } = {}) {
  const { session, user, firebaseUser } = await firebaseLogin({ email: username, password });
  if (firebaseOnly) return { session, user, firebaseUser };
  if (!user.emailVerified) throw new Error('Email is unverified; the app requires verification before Ola sync.');
  const profile = await syncOla({ token: session.idToken });
  if (profile.uid !== session.localId) throw new Error('Ola profile UID does not match the Firebase session.');
  return { session, user, firebaseUser, profile };
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/nodejs/login.js [--firebase-only]\nEdit username, password and firebaseConfig at the top. No environment variables required.');
    return;
  }
  if (process.argv.slice(2).some(arg => arg !== '--firebase-only')) throw new Error('Unknown argument; use --help.');
  try {
    printLoginResult(await login({ firebaseOnly: process.argv.includes('--firebase-only') }));
  } finally {
    await closeFirebase();
  }
}

module.exports = {
  login, firebaseLogin, closeFirebase, syncOla, olaHeaders, requestOla, printLoginResult,
};
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
