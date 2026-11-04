// App-wide state: stored accounts, settings, and one live session per account.
// Nothing signs in at launch: each account signs in when its Đăng nhập button
// (or Đăng nhập tất cả) is pressed, then keeps its own OlaClient and personal
// realtime channel (roomNo = own uid), whose incoming
// 1-1 messages are written to that account's local thread cache and
// re-broadcast to its screens. `selectedId` is only which account is on screen.

import io from 'socket.io-client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChatChannel, chatProfile, normalizeMessage, type ChannelState, type ChatMessage, type ChatProfile } from '@ola/core/chat.ts';
import { OlaClient } from '@ola/core/client.ts';
import { registerAccount, resendVerificationEmail, type RegisterInput } from '@ola/core/register.ts';
import {
  DEVICE_FIELDS, loadAccounts, newAccount, newDeviceId, olaConfigFor, saveAccounts, twinOf, type AccountsData, type StoredAccount,
} from './accounts.ts';
import { planImport, type ImportPlan, type TransferAccount } from './accountsTransfer.ts';
import { appendThread } from './messageCache.ts';
import { apiFetch, isTauri } from './platform.ts';
import { proxiedFetch, proxyUrl } from './proxy.ts';
import { rustIo } from './rustSocket.ts';
import { DEFAULT_SETTINGS, firebaseDefaults, loadSettings, saveSettings, SERVERS, type AppSettings } from './settings.ts';

export type SessionStatus = 'signed-out' | 'signing-in' | 'ready' | 'error';
export type RealtimeState = 'off' | 'missing-key' | ChannelState;

/** One account's sign-in state. */
export interface LiveState {
  status: SessionStatus;
  error: string | null;
  ola: OlaClient | null;
  me: ChatProfile | null;
  realtime: RealtimeState;
}

export const OFFLINE: LiveState = { status: 'signed-out', error: null, ola: null, me: null, realtime: 'off' };

/** Accounts signed in at the same time by Đăng nhập tất cả. */
const SIGN_IN_CONCURRENCY = 3;

export interface Session {
  loaded: boolean;
  accounts: StoredAccount[];
  /** The account shown on screen (persisted as `activeId`). */
  selectedId: string | null;
  settings: AppSettings;
  /** Live state per account id; missing means signed out. */
  live: Record<string, LiveState>;
  select(id: string): Promise<void>;
  /** Signs the account in (again). */
  connect(id: string): Promise<void>;
  /** Signs in every account that is not signed in or signing in, a few at a time. */
  connectAll(): Promise<void>;
  /** Signs the account out. */
  disconnect(id: string): Promise<void>;
  saveAccount(account: Omit<StoredAccount, 'id' | 'deviceId' | 'color'> & Partial<StoredAccount>): Promise<StoredAccount>;
  removeAccount(id: string): Promise<void>;
  /** Registers like the app (checkEmail, Firebase, verification email) and stores the account, not signed in. */
  register(input: RegisterInput & { label: string }): Promise<StoredAccount>;
  /** Sends the verification email again; false when the email is already verified. */
  resendVerification(id: string): Promise<boolean>;
  /** Adds new emails and updates the password/label/proxy of existing ones (no sign-in). */
  importAccounts(entries: TransferAccount[]): Promise<ImportPlan>;
  saveSettings(settings: AppSettings): Promise<void>;
  /** A new realtime channel of one account (through its proxy), or null without a socket key. */
  openChannel(id: string, roomNo: string, joinAs?: string): ChatChannel | null;
  /** Incoming 1-1 messages on one account's personal channel (already cached). */
  onIncoming(id: string, listener: (message: ChatMessage) => void): () => void;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession outside SessionProvider');
  return session;
}

/** True when any account is signed in. */
export const anyOnline = (live: Record<string, LiveState>) => Object.values(live).some(s => s.status === 'ready');

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/auth\/(invalid-credential|wrong-password|user-not-found|invalid-email)/.test(message)) return 'Sai email hoặc mật khẩu.';
  if (/auth\/too-many-requests/.test(message)) return 'Firebase tạm khoá do đăng nhập sai nhiều lần, thử lại sau.';
  if (/auth\/network-request-failed|NETWORK_ERROR|Load failed|Failed to fetch/.test(message)) return 'Không kết nối được mạng.';
  if (/unverified/i.test(message)) return 'Email chưa được xác minh; app Ola yêu cầu xác minh trước khi đồng bộ.';
  return message;
}

type SignInResult = { profile: ChatProfile } | { error: string } | null;
type OpenChannel = (roomNo: string, joinAs: string | undefined, proxy: string | undefined) => ChatChannel | null;

/** One account's client and personal channel, outside React. */
class LiveAccount {
  readonly id: string;
  state: LiveState = OFFLINE;
  #seq = 0;
  #inbox: ChatChannel | null = null;
  #listeners = new Set<(message: ChatMessage) => void>();
  #onChange: (id: string, state: LiveState) => void;
  #openChannel: OpenChannel;
  /** The proxy this sign-in uses (read at sign-in, like the device profile). */
  #proxy: string | undefined;

  constructor(id: string, onChange: (id: string, state: LiveState) => void, openChannel: OpenChannel) {
    this.id = id;
    this.#onChange = onChange;
    this.#openChannel = openChannel;
  }

  #set(patch: Partial<LiveState>) {
    this.state = { ...this.state, ...patch };
    this.#onChange(this.id, this.state);
  }

  onIncoming(listener: (message: ChatMessage) => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  /** A realtime channel of this account, through its proxy. */
  openChannel(roomNo: string, joinAs?: string): ChatChannel | null {
    return this.#openChannel(roomNo, joinAs, this.#proxy);
  }

  /** Shows a sign-in error without trying (e.g. the same Ola account is already online). */
  async fail(error: string): Promise<SignInResult> {
    await this.signOut();
    this.#set({ status: 'error', error });
    return { error };
  }

  /** Signs in; null when a newer sign-in or sign-out superseded this one. */
  async signIn(account: StoredAccount): Promise<SignInResult> {
    await this.signOut();
    const seq = ++this.#seq;
    // With a proxy, Firebase, the Ola API and the sockets all go out from the
    // Rust side through it; a browser tab (yarn dev) cannot use one.
    const proxy = isTauri ? proxyUrl(account.proxy) : undefined;
    // A proxy that does not parse must not fall back to the real IP.
    if (isTauri && account.proxy?.trim() && !proxy) {
      const error = 'Proxy của nick này không hợp lệ; sửa lại trong Quản lý tài khoản.';
      this.#set({ status: 'error', error });
      return { error };
    }
    this.#proxy = proxy;
    const viaProxy = proxy ? proxiedFetch(proxy) : undefined;
    this.#set({ status: 'signing-in' });
    try {
      const client = await OlaClient.login({
        account: { email: account.email, password: account.password },
        config: olaConfigFor(account),
        firebaseConfig: firebaseDefaults,
        fetch: viaProxy ?? apiFetch,
        firebaseFetch: viaProxy,
      });
      if (seq !== this.#seq) {
        await client.close();
        return null;
      }
      const profile = chatProfile(client.profile, client.session.localId);
      this.#set({ status: 'ready', error: null, ola: client, me: profile });
      this.restartInbox();
      return { profile };
    } catch (err) {
      if (seq !== this.#seq) return null;
      const error = describeError(err);
      this.#set({ status: 'error', error });
      return { error };
    }
  }

  async signOut(): Promise<void> {
    this.#seq++;
    this.#closeInbox();
    const client = this.state.ola;
    if (this.state !== OFFLINE) {
      this.state = OFFLINE;
      this.#onChange(this.id, OFFLINE);
    }
    await client?.close().catch(() => {});
  }

  /** (Re)opens the personal channel, e.g. after the socket key changed. */
  restartInbox() {
    this.#closeInbox();
    const me = this.state.me;
    if (!me) return;
    const channel = this.openChannel(me.uid, me.uid);
    if (!channel) {
      this.#set({ realtime: 'missing-key' });
      return;
    }
    channel.onState(realtime => { if (this.#inbox === channel) this.#set({ realtime }); });
    channel.onMessage(async raw => {
      const message = normalizeMessage(raw, me.uid);
      if (!message || message.outgoing || !message.fromUid) return;
      await appendThread(me.uid, message.fromUid, [message]);
      for (const listener of this.#listeners) listener(message);
    });
    this.#inbox = channel;
    channel.connect();
  }

  #closeInbox() {
    this.#inbox?.close();
    this.#inbox = null;
  }
}

/** Runs `task` for every item, at most `limit` at a time. */
async function eachLimited<T>(items: T[], limit: number, task: (item: T) => Promise<unknown>) {
  const queue = [...items];
  const worker = async () => { for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item); };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<AccountsData>({ version: 1, activeId: null, accounts: [] });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [live, setLive] = useState<Record<string, LiveState>>({});

  const dataRef = useRef(data);
  dataRef.current = data;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessions = useRef(new Map<string, LiveAccount>());
  /** Accounts whose sign-in started but whose state is not signing-in yet (it is set after an await). */
  const starting = useRef(new Set<string>());

  const persist = useCallback(async (next: AccountsData) => {
    dataRef.current = next;
    setData(next);
    await saveAccounts(next);
  }, []);

  const patchAccount = useCallback(async (id: string, patch: Partial<StoredAccount>) => {
    const current = dataRef.current;
    if (!current.accounts.some(a => a.id === id)) return;
    await persist({ ...current, accounts: current.accounts.map(a => (a.id === id ? { ...a, ...patch } : a)) });
  }, [persist]);

  const newChannel: OpenChannel = useCallback((roomNo, joinAs, proxy) => {
    const key = settingsRef.current.socketKey.trim();
    if (!key) return null;
    return new ChatChannel({ io: proxy ? rustIo(proxy) : io, socket: { url: SERVERS.socket, key }, roomNo, joinAs });
  }, []);

  const onLiveChange = useCallback((id: string, state: LiveState) => {
    setLive(all => ({ ...all, [id]: state }));
  }, []);

  const sessionFor = useCallback((id: string) => {
    let session = sessions.current.get(id);
    if (!session) {
      session = new LiveAccount(id, onLiveChange, newChannel);
      sessions.current.set(id, session);
    }
    return session;
  }, [onLiveChange, newChannel]);

  const openChannel = useCallback(
    (id: string, roomNo: string, joinAs?: string) => sessionFor(id).openChannel(roomNo, joinAs),
    [sessionFor],
  );

  const signIn = useCallback(async (id: string) => {
    const account = dataRef.current.accounts.find(a => a.id === id);
    if (!account) return;
    // The same Ola account saved twice must not be online twice (two device IDs, one inbox).
    // `starting` covers twins started in the same tick (Đăng nhập tất cả runs several at once).
    const busy = (a: StoredAccount) => starting.current.has(a.id)
      || ['ready', 'signing-in'].includes(sessions.current.get(a.id)?.state.status ?? '');
    const twin = twinOf(dataRef.current.accounts.filter(a => a.id !== id && busy(a)), account);
    let result;
    if (twin) {
      result = await sessionFor(id).fail(`Trùng tài khoản Ola với nick "${twin.label || twin.email}" đang online. Xoá một trong hai nick.`);
    } else {
      starting.current.add(id);
      try {
        result = await sessionFor(id).signIn(account);
      } finally {
        starting.current.delete(id);
      }
    }
    if (!result) return;
    if ('error' in result) {
      await patchAccount(id, { lastError: result.error });
      return;
    }
    const { profile } = result;
    await patchAccount(id, {
      uid: profile.uid,
      displayName: profile.displayName,
      photoURL: profile.photoURL,
      label: account.label.trim() || profile.displayName,
      lastLoginAt: Date.now(),
      lastError: undefined,
      verificationSentAt: undefined,
    });
  }, [patchAccount, sessionFor]);

  const connect = signIn;

  const connectAll = useCallback(async () => {
    const waiting = dataRef.current.accounts
      .filter(a => !['ready', 'signing-in'].includes(sessions.current.get(a.id)?.state.status ?? 'signed-out'))
      .map(a => a.id);
    await eachLimited(waiting, SIGN_IN_CONCURRENCY, signIn);
  }, [signIn]);

  const disconnect = useCallback(async (id: string) => {
    await sessionFor(id).signOut();
  }, [sessionFor]);

  const select = useCallback(async (id: string) => {
    if (dataRef.current.activeId === id) return;
    await persist({ ...dataRef.current, activeId: id });
  }, [persist]);

  const saveAccount: Session['saveAccount'] = useCallback(async input => {
    const current = dataRef.current;
    const existing = input.id ? current.accounts.find(a => a.id === input.id) : undefined;
    const twin = twinOf(current.accounts, { ...input, uid: existing?.uid });
    if (twin) throw new Error(`Email này đã có trong danh sách (nick "${twin.label || twin.email}").`);
    const account = existing ? { ...existing, ...input } : newAccount(input, current.accounts.length);
    const accounts = existing
      ? current.accounts.map(a => (a.id === account.id ? account : a))
      : [...current.accounts, account];
    await persist({ ...current, accounts, activeId: current.activeId ?? account.id });
    return account;
  }, [persist]);

  const register: Session['register'] = useCallback(async ({ label, ...input }) => {
    // The new account's own device id signs checkEmail, as the app does on that phone.
    const deviceId = newDeviceId();
    const { email } = await registerAccount(input, {
      config: olaConfigFor({ deviceId }),
      firebaseConfig: firebaseDefaults,
      fetch: apiFetch,
    });
    const current = dataRef.current;
    const account = newAccount({
      label: label.trim(), email, password: input.password, deviceId, verificationSentAt: Date.now(),
    }, current.accounts.length);
    // Not signed in: it cannot sync until the email is verified.
    await persist({ ...current, accounts: [...current.accounts, account], activeId: current.activeId ?? account.id });
    return account;
  }, [persist]);

  const resendVerification = useCallback(async (id: string) => {
    const account = dataRef.current.accounts.find(a => a.id === id);
    if (!account) return false;
    const sent = await resendVerificationEmail(account, { firebaseConfig: firebaseDefaults });
    await patchAccount(id, sent ? { verificationSentAt: Date.now() } : { verificationSentAt: undefined });
    return sent;
  }, [patchAccount]);

  const importAccounts = useCallback(async (entries: TransferAccount[]) => {
    const current = dataRef.current;
    const plan = planImport(current.accounts, entries);
    const updates = new Map(plan.updated.map(e => [e.email.toLowerCase(), e]));
    const accounts = current.accounts.map(a => {
      const entry = updates.get(a.email.toLowerCase());
      // Keep the stored device id: it is this account's identity on the server.
      return entry
        ? { ...a, password: entry.password, ...(entry.label && { label: entry.label }), ...(entry.proxy && { proxy: entry.proxy }), lastError: undefined }
        : a;
    });
    const added = plan.added.map((entry, i) => newAccount({
      label: entry.label ?? '', email: entry.email, password: entry.password,
      ...(entry.deviceId && { deviceId: entry.deviceId }),
      ...(entry.proxy && { proxy: entry.proxy }),
      ...Object.fromEntries(DEVICE_FIELDS.filter(f => entry[f]).map(f => [f, entry[f]])),
    }, current.accounts.length + i));
    await persist({ ...current, accounts: [...accounts, ...added], activeId: current.activeId ?? added[0]?.id ?? null });
    return plan;
  }, [persist]);

  const removeAccount = useCallback(async (id: string) => {
    await sessions.current.get(id)?.signOut();
    sessions.current.delete(id);
    setLive(({ [id]: _, ...rest }) => rest);
    const current = dataRef.current;
    const accounts = current.accounts.filter(a => a.id !== id);
    await persist({ ...current, accounts, activeId: current.activeId === id ? accounts[0]?.id ?? null : current.activeId });
  }, [persist]);

  const updateSettings = useCallback(async (next: AppSettings) => {
    const keyChanged = next.socketKey.trim() !== settingsRef.current.socketKey.trim();
    settingsRef.current = next;
    setSettings(next);
    await saveSettings(next);
    if (keyChanged) for (const session of sessions.current.values()) session.restartInbox();
  }, []);

  const onIncoming = useCallback(
    (id: string, listener: (message: ChatMessage) => void) => sessionFor(id).onIncoming(listener),
    [sessionFor],
  );

  // Load files once. Accounts stay signed out until Đăng nhập is pressed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedAccounts, { settings: saved, legacyDevice }] = await Promise.all([loadAccounts(), loadSettings()]);
      if (cancelled) return;
      let accounts = loadedAccounts;
      // Older settings.json held one device profile for every account: give it to
      // the accounts without their own, then drop it from settings.
      if (Object.keys(legacyDevice).length) {
        accounts = {
          ...accounts,
          accounts: accounts.accounts.map(a => {
            const filled = { ...a };
            for (const field of DEVICE_FIELDS) if (!filled[field] && legacyDevice[field]) filled[field] = legacyDevice[field];
            return filled;
          }),
        };
        await saveAccounts(accounts);
        await saveSettings(saved);
      }
      if (!accounts.accounts.some(a => a.id === accounts.activeId)) accounts = { ...accounts, activeId: accounts.accounts[0]?.id ?? null };
      dataRef.current = accounts;
      settingsRef.current = saved;
      setData(accounts);
      setSettings(saved);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { for (const session of sessions.current.values()) void session.signOut(); }, []);

  const value = useMemo<Session>(() => ({
    loaded, accounts: data.accounts, selectedId: data.activeId, settings, live,
    select, connect, connectAll, disconnect, saveAccount, removeAccount, register, resendVerification, importAccounts,
    saveSettings: updateSettings, openChannel, onIncoming,
  }), [loaded, data, settings, live,
    select, connect, connectAll, disconnect, saveAccount, removeAccount, register, resendVerification, importAccounts,
    updateSettings, openChannel, onIncoming]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// ---------------------------------------------------------------------------
// Per-account context: the screens of one account (Tin nhắn, Khám phá, …).

export interface AccountSession {
  account: StoredAccount;
  state: LiveState;
  onIncoming(listener: (message: ChatMessage) => void): () => void;
  /** A realtime channel of this account (through its proxy), or null without a socket key. */
  openChannel(roomNo: string, joinAs?: string): ChatChannel | null;
}

const AccountContext = createContext<AccountSession | null>(null);

export function AccountProvider({ id, children }: { id: string; children: ReactNode }) {
  const { accounts, live, onIncoming, openChannel } = useSession();
  const account = accounts.find(a => a.id === id);
  const state = live[id] ?? OFFLINE;
  const listen = useCallback((listener: (message: ChatMessage) => void) => onIncoming(id, listener), [onIncoming, id]);
  const channel = useCallback((roomNo: string, joinAs?: string) => openChannel(id, roomNo, joinAs), [openChannel, id]);
  const value = useMemo(
    () => (account ? { account, state, onIncoming: listen, openChannel: channel } : null),
    [account, state, listen, channel],
  );
  if (!value) return null;
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountSession {
  const account = useContext(AccountContext);
  if (!account) throw new Error('useAccount outside AccountProvider');
  return account;
}

/** The account's signed-in client and profile; only call under a ready account. */
export function useOla(): { ola: OlaClient; me: ChatProfile; deviceId: string } {
  const { account, state } = useAccount();
  if (!state.ola || !state.me) throw new Error('Account is not signed in');
  return { ola: state.ola, me: state.me, deviceId: account.deviceId };
}
