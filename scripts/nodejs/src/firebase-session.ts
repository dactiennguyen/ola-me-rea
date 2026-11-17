// Restores a Firebase session exported by the owner's Android app. Never log
// refresh tokens; identity is verified by Firebase lookup, not JWT decoding.
import { firebaseDefaults } from './defaults.ts';
import type { FetchLike } from './http.ts';
import type { FirebaseLogin, Session } from './auth.ts';

export interface GoogleSessionExport {
  format: 'ola-google-session';
  version: 1;
  projectId: 'olaachat';
  provider: 'google.com';
  uid: string;
  email: string;
  refreshToken: string;
  deviceId: string;
  appVersion: string;
  androidVersion: string;
  displayName?: string;
}

export function parseGoogleSession(value: unknown): GoogleSessionExport {
  const d = value as Partial<GoogleSessionExport> | null;
  const text = (v: unknown, min = 1, max = 1024): v is string =>
    typeof v === 'string' && v.length >= min && v.length <= max && !/[\x00-\x1f]/.test(v);
  if (!d || d.format !== 'ola-google-session' || d.version !== 1 || d.projectId !== 'olaachat'
    || d.provider !== 'google.com' || !text(d.uid, 1, 128)
    || !(d.email === '' || (text(d.email, 3, 320) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)))
    || !text(d.refreshToken, 20, 8192)
    || !text(d.deviceId, 4, 64) || !/^[A-Za-z0-9_.-]+$/.test(d.deviceId)
    || !text(d.appVersion, 1, 32) || !text(d.androidVersion, 1, 32)) {
    throw new Error('File phiên Google không hợp lệ hoặc không thuộc Ola.');
  }
  // Explicit allowlist: do not retain arbitrary fields from an imported file.
  return {
    format: d.format, version: 1, projectId: d.projectId, provider: d.provider,
    uid: d.uid, email: d.email, refreshToken: d.refreshToken, deviceId: d.deviceId,
    appVersion: d.appVersion, androidVersion: d.androidVersion,
    ...(text(d.displayName, 1, 200) ? { displayName: d.displayName } : {}),
  };
}

export async function restoreGoogleSession(
  input: GoogleSessionExport,
  fetchImpl: FetchLike,
  persist: (refreshToken: string) => Promise<void>,
): Promise<FirebaseLogin> {
  const saved = parseGoogleSession(input);
  let refreshToken = saved.refreshToken;
  let expiresAt = 0;
  let closed = false;
  let pending: Promise<string> | null = null;
  const session: Session = { localId: saved.uid, email: saved.email, idToken: '', refreshToken, expirationTime: '' };
  async function call(url: string, body: string, contentType: string): Promise<Record<string, unknown>> {
    let res: Response;
    try { res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': contentType }, body }); }
    catch { throw new Error('Không kết nối được Firebase. Hãy thử lại.'); }
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok || !data) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new Error('Phiên Google không còn hợp lệ. Xuất lại phiên từ Ola trên điện thoại.');
      }
      throw new Error('Firebase tạm thời không phản hồi. Hãy thử lại.');
    }
    return data;
  }
  async function renew(): Promise<string> {
    const data = await call(`https://securetoken.googleapis.com/v1/token?key=${firebaseDefaults.apiKey}`,
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(), 'application/x-www-form-urlencoded');
    const token = data.id_token;
    const nextRefresh = data.refresh_token;
    const seconds = Number(data.expires_in);
    if (typeof token !== 'string' || !token || typeof nextRefresh !== 'string' || !nextRefresh
      || data.user_id !== saved.uid || !Number.isFinite(seconds) || seconds < 1) {
      throw new Error('Firebase trả phiên không khớp tài khoản đã nhập.');
    }
    const lookup = await call(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseDefaults.apiKey}`,
      JSON.stringify({ idToken: token }), 'application/json');
    const user = (Array.isArray(lookup.users) ? lookup.users[0] : null) as Record<string, unknown> | null;
    const providers = user?.providerUserInfo as { providerId?: string }[] | undefined;
    // Some Google accounts carry no email on Firebase; identity rests on uid + the
    // Google provider. When an email is present it must match the one exported (if any).
    const confirmedEmail = typeof user?.email === 'string' ? user.email : '';
    if (user?.localId !== saved.uid
      || (saved.email !== '' && confirmedEmail.toLowerCase() !== saved.email.toLowerCase())
      || !Array.isArray(providers) || !providers.some(p => p.providerId === 'google.com')) {
      throw new Error('Danh tính Google trên Firebase không khớp file phiên.');
    }
    // Adopt the email Firebase confirms, so a session exported without one still has it.
    if (confirmedEmail) session.email = confirmedEmail;
    if (closed) throw new Error('Phiên đã đóng.');
    // Persist rotation before allowing API calls, so restarting can always restore.
    await persist(nextRefresh);
    if (closed) throw new Error('Phiên đã đóng.');
    refreshToken = nextRefresh;
    expiresAt = Date.now() + seconds * 1000;
    Object.assign(session, { idToken: token, refreshToken, expirationTime: new Date(expiresAt).toISOString() });
    return token;
  }
  const getIdToken = async () => {
    if (closed) throw new Error('Phiên đã đóng.');
    if (session.idToken && Date.now() < expiresAt - 300_000) return session.idToken;
    pending ??= renew().finally(() => { pending = null; });
    return pending;
  };
  await getIdToken();
  return {
    session, user: { uid: saved.uid, email: session.email ?? saved.email }, emailVerified: true, getIdToken,
    close: async () => { closed = true; if (pending) await pending.catch(() => {}); },
  };
}
