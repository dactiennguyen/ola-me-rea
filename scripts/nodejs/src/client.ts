// OlaClient: signs and sends requests built by endpoints.
//
//   const ola = await OlaClient.login();          // Firebase sign-in + napi/users/sync
//   try {
//     const coins = await ola.call(getCoins);
//   } finally {
//     await ola.close();
//   }

import type { z } from 'zod';
import { firebaseLogin } from './auth.ts';
import { accountFromEnv, olaConfig, type Account, type OlaConfig } from './config.ts';
import {
  DRY_RUN_SESSION, type CallInput, type Endpoint, type InputArgs, type JsonObject, type OlaRequest, type SessionInfo,
} from './endpoint.ts';
import { usersSync } from './endpoints/usersSync.ts';
import { requestJson, type FetchLike } from './http.ts';
import { assertApiPath, olaHeaders } from './signing.ts';

export interface OlaClientOptions {
  session: SessionInfo & { idToken: string };
  /** Returns a fresh ID token; Firebase refreshes it after the 1h expiry. */
  getToken?: () => Promise<string>;
  config?: OlaConfig;
  fetch?: FetchLike;
  /** Releases whatever produced the session (the Firebase app). */
  close?: () => Promise<void>;
}

/** What endpoints default from: the account plus this device's identity (usersSync's deviceId/ver). */
export function sessionInfo(session: SessionInfo, config: OlaConfig = olaConfig): SessionInfo {
  return { ...session, deviceId: config.deviceId, androidVersion: config.androidVersion };
}

/** The session --dry-run and pre-login validation build with. */
export const dryRunSession = (config: OlaConfig = olaConfig) => sessionInfo(DRY_RUN_SESSION, config);

export interface LoginOptions {
  account?: Account;
  /** Stop after Firebase sign-in; skip napi/users/sync. */
  firebaseOnly?: boolean;
  config?: OlaConfig;
  fetch?: FetchLike;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export class OlaClient {
  readonly session: OlaClientOptions['session'];
  /** Firebase user JSON, set by login(). */
  user?: object;
  /** Ola profile from napi/users/sync, set by login() unless firebaseOnly. */
  profile?: JsonObject;

  #getToken: () => Promise<string>;
  #config: OlaConfig;
  #fetch: FetchLike;
  #close: (() => Promise<void>) | undefined;
  #clockOffset: Promise<number> | undefined;

  constructor(options: OlaClientOptions) {
    if (typeof options.session?.idToken !== 'string' || !options.session.idToken.trim()) {
      throw new Error('Missing Firebase session.idToken; use OlaClient.login().');
    }
    this.session = options.session;
    this.#getToken = options.getToken ?? (async () => this.session.idToken);
    this.#config = options.config ?? olaConfig;
    this.#fetch = options.fetch ?? fetch;
    this.#close = options.close;
  }

  /** Signs in with the .env account and, unless firebaseOnly, syncs the Ola profile. */
  static async login({ account = accountFromEnv(), firebaseOnly = false, ...options }: LoginOptions = {}): Promise<OlaClient> {
    const { session, user, firebaseUser, close } = await firebaseLogin(account);
    const client = new OlaClient({ ...options, session, getToken: () => firebaseUser.getIdToken(), close });
    client.user = user;
    if (firebaseOnly) return client;
    try {
      if (!firebaseUser.emailVerified) {
        throw new Error('Email is unverified; the app requires verification before Ola sync.');
      }
      client.profile = await client.sync();
    } catch (error) {
      await client.close();
      throw error;
    }
    return client;
  }

  /** napi/users/sync: registers this device and returns the Ola profile. */
  async sync(): Promise<JsonObject> {
    const data = await this.call(usersSync) as { user?: unknown } | null;
    const user = data?.user;
    if (!user || typeof user !== 'object') throw new Error('Ola sync returned HTTP success without a user object.');
    if ((user as JsonObject).uid !== this.session.localId) {
      throw new Error('Ola profile UID does not match the Firebase session.');
    }
    return user as JsonObject;
  }

  /** Builds (validates), signs and sends one endpoint call, then checks and parses the response. */
  async call<F extends z.ZodRawShape, D, R>(
    endpoint: Endpoint<F, D, R>, ...input: InputArgs<CallInput<F, D>>
  ): Promise<R> {
    const request = endpoint.build(sessionInfo(this.session, this.#config), ...input);
    return endpoint.handle(await this.request(request), request);
  }

  /** Signs and sends a raw request. Prefer call() with an endpoint. */
  async request({ method, path, body, query }: OlaRequest): Promise<unknown> {
    assertApiPath(path);
    let url = `${this.#config.baseUrl}${path}`;
    if (query) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'object') throw new Error(`Query parameter ${key} must be a scalar, not an object.`);
        search.set(key, String(value));
      }
      const qs = search.toString();
      if (qs) url += `?${qs}`;
    }
    // Await everything first so the signed timestamp is taken right before sending.
    const offset = await this.#serverClockOffset();
    const token = await this.#getToken();
    const timestamp = nowSeconds() + offset;
    return requestJson(url, {
      method, fetch: this.#fetch,
      headers: olaHeaders({ ...this.#identity(), token, timestamp, requestPath: path }),
      body: method === 'GET' ? undefined : body,
    });
  }

  /** napi/general/getTimes: the server clock in Unix seconds (signed with local time). */
  async serverTime(): Promise<number> {
    const requestPath = 'napi/general/getTimes';
    const times = await requestJson(`${this.#config.baseUrl}${requestPath}`, {
      method: 'GET', fetch: this.#fetch,
      headers: olaHeaders({ ...this.#identity(), timestamp: nowSeconds(), requestPath }),
    }) as { serverTime?: unknown } | null;
    const timestamp = Number(times?.serverTime);
    if (!Number.isSafeInteger(timestamp) || timestamp < 1 || timestamp > 100000000000) {
      throw new Error('Unexpected serverTime; refusing to sign with an invalid timestamp.');
    }
    return timestamp;
  }

  async close(): Promise<void> {
    const close = this.#close;
    this.#close = undefined;
    if (close) await close();
  }

  #identity() {
    const { publicKey: key2, deviceId, appVersion } = this.#config;
    return { key2, deviceId, appVersion };
  }

  // API calls are signed with server time. Fetch the offset once per client
  // instead of one getTimes round trip before every request.
  #serverClockOffset(): Promise<number> {
    this.#clockOffset ??= this.serverTime().then(
      serverTime => serverTime - nowSeconds(),
      error => { this.#clockOffset = undefined; throw error; },
    );
    return this.#clockOffset;
  }
}
