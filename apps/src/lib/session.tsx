// App-wide state: stored accounts, settings, the signed-in account's OlaClient,
// and its personal realtime channel (roomNo = own uid), whose incoming 1-1
// messages are written to the local thread cache and re-broadcast to screens.

import io from 'socket.io-client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChatChannel, chatProfile, normalizeMessage, type ChannelState, type ChatMessage, type ChatProfile } from '@ola/core/chat.ts';
import { OlaClient } from '@ola/core/client.ts';
import { registerAccount, resendVerificationEmail, type RegisterInput } from '@ola/core/register.ts';
import { loadAccounts, newAccount, newDeviceId, saveAccounts, type AccountsData, type StoredAccount } from './accounts.ts';
import { planImport, type ImportPlan, type TransferAccount } from './accountsTransfer.ts';
import { appendThread } from './messageCache.ts';
import { apiFetch } from './platform.ts';
import { DEFAULT_SETTINGS, firebaseDefaults, loadSettings, olaConfigFor, saveSettings, SERVERS, type AppSettings } from './settings.ts';

export type SessionStatus = 'signed-out' | 'signing-in' | 'ready' | 'error';
export type RealtimeState = 'off' | 'missing-key' | ChannelState;

export interface Session {
  loaded: boolean;
  accounts: StoredAccount[];
  activeId: string | null;
  settings: AppSettings;
  status: SessionStatus;
  error: string | null;
  ola: OlaClient | null;
  me: ChatProfile | null;
  /** deviceid of the signed-in account (room payloads broadcast it). */
  deviceId: string | null;
  realtime: RealtimeState;
  switchAccount(id: string): Promise<void>;
  /** Signs out and clears the active account, so the next launch does not sign back in. */
  signOut(): Promise<void>;
  saveAccount(account: Omit<StoredAccount, 'id' | 'deviceId' | 'color'> & Partial<StoredAccount>): Promise<StoredAccount>;
  removeAccount(id: string): Promise<void>;
  /** Registers like the app (checkEmail, Firebase, verification email) and stores the account, not active. */
  register(input: RegisterInput & { label: string }): Promise<StoredAccount>;
  /** Sends the verification email again; false when the email is already verified. */
  resendVerification(id: string): Promise<boolean>;
  /** Adds new emails and updates the password/label of existing ones. */
  importAccounts(entries: TransferAccount[]): Promise<ImportPlan>;
  saveSettings(settings: AppSettings): Promise<void>;
  /** A new realtime channel with the current settings, or null without a socket key. */
  openChannel(roomNo: string, joinAs?: string): ChatChannel | null;
  /** Incoming 1-1 messages from the personal channel (already cached). */
  onIncoming(listener: (message: ChatMessage) => void): () => void;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession outside SessionProvider');
  return session;
}

/** The signed-in client and profile; only call under a ready session. */
export function useOla(): { ola: OlaClient; me: ChatProfile; deviceId: string } {
  const { ola, me, deviceId } = useSession();
  if (!ola || !me || !deviceId) throw new Error('No signed-in account');
  return { ola, me, deviceId };
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/auth\/(invalid-credential|wrong-password|user-not-found|invalid-email)/.test(message)) return 'Sai email hoặc mật khẩu.';
  if (/auth\/too-many-requests/.test(message)) return 'Firebase tạm khoá do đăng nhập sai nhiều lần, thử lại sau.';
  if (/auth\/network-request-failed|NETWORK_ERROR|Load failed|Failed to fetch/.test(message)) return 'Không kết nối được mạng.';
  if (/unverified/i.test(message)) return 'Email chưa được xác minh; app Ola yêu cầu xác minh trước khi đồng bộ.';
  return message;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState<AccountsData>({ version: 1, activeId: null, accounts: [] });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SessionStatus>('signed-out');
  const [error, setError] = useState<string | null>(null);
  const [ola, setOla] = useState<OlaClient | null>(null);
  const [me, setMe] = useState<ChatProfile | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<RealtimeState>('off');

  const dataRef = useRef(data);
  dataRef.current = data;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const olaRef = useRef<OlaClient | null>(null);
  const inboxRef = useRef<ChatChannel | null>(null);
  const loginSeq = useRef(0);
  const listeners = useRef(new Set<(message: ChatMessage) => void>());

  const persist = useCallback(async (next: AccountsData) => {
    dataRef.current = next;
    setData(next);
    await saveAccounts(next);
  }, []);

  const patchAccount = useCallback(async (id: string, patch: Partial<StoredAccount>) => {
    const current = dataRef.current;
    await persist({ ...current, accounts: current.accounts.map(a => (a.id === id ? { ...a, ...patch } : a)) });
  }, [persist]);

  const openChannel = useCallback((roomNo: string, joinAs?: string): ChatChannel | null => {
    const key = settingsRef.current.socketKey.trim();
    if (!key) return null;
    return new ChatChannel({ io, socket: { url: SERVERS.socket, key }, roomNo, joinAs });
  }, []);

  const closeInbox = useCallback(() => {
    inboxRef.current?.close();
    inboxRef.current = null;
  }, []);

  const startInbox = useCallback((profile: ChatProfile) => {
    closeInbox();
    const channel = openChannel(profile.uid, profile.uid);
    if (!channel) {
      setRealtime('missing-key');
      return;
    }
    channel.onState(setRealtime);
    channel.onMessage(async raw => {
      const message = normalizeMessage(raw, profile.uid);
      if (!message || message.outgoing || !message.fromUid) return;
      await appendThread(profile.uid, message.fromUid, [message]);
      for (const listener of listeners.current) listener(message);
    });
    inboxRef.current = channel;
    channel.connect();
  }, [closeInbox, openChannel]);

  /** Closes the signed-in client and realtime; keeps activeId (used before switching). */
  const endSession = useCallback(async () => {
    loginSeq.current++;
    closeInbox();
    const client = olaRef.current;
    olaRef.current = null;
    setOla(null);
    setMe(null);
    setDeviceId(null);
    setStatus('signed-out');
    setRealtime('off');
    setError(null);
    await client?.close().catch(() => {});
  }, [closeInbox]);

  const signOut = useCallback(async () => {
    await endSession();
    await persist({ ...dataRef.current, activeId: null });
  }, [endSession, persist]);

  const switchAccount = useCallback(async (id: string) => {
    const account = dataRef.current.accounts.find(a => a.id === id);
    if (!account) return;
    await endSession();
    const seq = ++loginSeq.current;
    await persist({ ...dataRef.current, activeId: id });
    setStatus('signing-in');
    try {
      const client = await OlaClient.login({
        account: { email: account.email, password: account.password },
        config: olaConfigFor(settingsRef.current, account.deviceId),
        firebaseConfig: firebaseDefaults,
        fetch: apiFetch,
      });
      if (seq !== loginSeq.current) {
        await client.close();
        return;
      }
      const profile = chatProfile(client.profile, client.session.localId);
      olaRef.current = client;
      setOla(client);
      setMe(profile);
      setDeviceId(account.deviceId);
      setStatus('ready');
      await patchAccount(id, {
        uid: profile.uid,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        label: account.label.trim() || profile.displayName,
        lastLoginAt: Date.now(),
        lastError: undefined,
        verificationSentAt: undefined,
      });
      startInbox(profile);
    } catch (err) {
      if (seq !== loginSeq.current) return;
      const message = describeError(err);
      setStatus('error');
      setError(message);
      await patchAccount(id, { lastError: message });
    }
  }, [endSession, patchAccount, persist, startInbox]);

  const saveAccount: Session['saveAccount'] = useCallback(async input => {
    const current = dataRef.current;
    const existing = input.id ? current.accounts.find(a => a.id === input.id) : undefined;
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
      config: olaConfigFor(settingsRef.current, deviceId),
      firebaseConfig: firebaseDefaults,
      fetch: apiFetch,
    });
    const current = dataRef.current;
    const account = newAccount({
      label: label.trim(), email, password: input.password, deviceId, verificationSentAt: Date.now(),
    }, current.accounts.length);
    // Not made active: it cannot sign in until the email is verified.
    await persist({ ...current, accounts: [...current.accounts, account] });
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
      return entry ? { ...a, password: entry.password, ...(entry.label && { label: entry.label }), lastError: undefined } : a;
    });
    plan.added.forEach((entry, i) => accounts.push(newAccount({
      label: entry.label ?? '', email: entry.email, password: entry.password,
      ...(entry.deviceId && { deviceId: entry.deviceId }),
    }, current.accounts.length + i)));
    await persist({ ...current, accounts });
    return plan;
  }, [persist]);

  const removeAccount = useCallback(async (id: string) => {
    if (dataRef.current.activeId === id) await endSession();
    const current = dataRef.current;
    const accounts = current.accounts.filter(a => a.id !== id);
    await persist({ ...current, accounts, activeId: current.activeId === id ? null : current.activeId });
  }, [endSession, persist]);

  const updateSettings = useCallback(async (next: AppSettings) => {
    const keyChanged = next.socketKey.trim() !== settingsRef.current.socketKey.trim();
    settingsRef.current = next;
    setSettings(next);
    await saveSettings(next);
    if (keyChanged && me) startInbox(me);
  }, [me, startInbox]);

  const onIncoming = useCallback((listener: (message: ChatMessage) => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  // Load files once, then sign the last active account back in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accounts, saved] = await Promise.all([loadAccounts(), loadSettings()]);
      if (cancelled) return;
      dataRef.current = accounts;
      settingsRef.current = saved;
      setData(accounts);
      setSettings(saved);
      setLoaded(true);
      if (accounts.activeId) void switchAccount(accounts.activeId);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { closeInbox(); void olaRef.current?.close(); }, [closeInbox]);

  const value = useMemo<Session>(() => ({
    loaded, accounts: data.accounts, activeId: data.activeId, settings, status, error, ola, me, deviceId, realtime,
    switchAccount, signOut, saveAccount, removeAccount, register, resendVerification, importAccounts,
    saveSettings: updateSettings, openChannel, onIncoming,
  }), [loaded, data, settings, status, error, ola, me, deviceId, realtime,
    switchAccount, signOut, saveAccount, removeAccount, register, resendVerification, importAccounts,
    updateSettings, openChannel, onIncoming]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
