import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '../components/Avatar.tsx';
import { Icon } from '../components/Icon.tsx';
import { DEVICE_DEFAULTS, deviceOverride, deviceValue, newDeviceId, type StoredAccount } from '../lib/accounts.ts';
import { shortTime } from '../lib/format.ts';
import { checkProxy, parseProxy, proxyLabel } from '../lib/proxy.ts';
import { OFFLINE, useSession } from '../lib/session.tsx';
import { RegisterPanel } from './RegisterPanel.tsx';

interface Draft {
  id?: string; label: string; email: string; password: string;
  /** This account's device profile; an empty field means the APK default. */
  deviceId: string; appVersion: string; androidVersion: string; publicKey: string;
  /** As typed; parseProxy() normalizes it on save. */
  proxy: string;
}

const emptyDraft = (): Draft => ({
  label: '', email: '', password: '', deviceId: newDeviceId(), appVersion: '', androidVersion: '', publicKey: '', proxy: '',
});

export type AccountsPanel = 'add' | 'register' | 'edit';
/** Opens a panel from outside (rail, account screens); `id` is the account to edit; `n` changes on every request. */
export interface AccountsRequest { panel: AccountsPanel; id?: string; n: number }

/** Sign-in failed or registration is pending because the email is not verified yet. */
const needsVerification = (a: StoredAccount) => Boolean(a.verificationSentAt) || /xác minh/.test(a.lastError ?? '');

export function AccountsScreen({ request, onOpen }: {
  request?: AccountsRequest | null;
  /** Shows that account's screens. */
  onOpen: (id: string) => void;
}) {
  const { accounts, live, connect, connectAll, disconnect, saveAccount, removeAccount, resendVerification } = useSession();
  const [draft, setDraft] = useState<Draft | null>(accounts.length ? null : emptyDraft());
  const [panel, setPanel] = useState<'register' | null>(null);
  const [proxyCheck, setProxyCheck] = useState<{ text: string; tone: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // A new or edited account form scrolls into view (it sits above the list).
  useEffect(() => { formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [draft?.id, draft === null]);

  useEffect(() => {
    if (!request) return;
    if (request.panel === 'edit') {
      const account = accounts.find(a => a.id === request.id);
      if (account) edit(account);
    } else if (request.panel === 'add') { setPanel(null); setDraft(emptyDraft()); } else { setDraft(null); setPanel(request.panel); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [resend, setResend] = useState<{ id: string; text: string; tone: string } | null>(null);

  const openPanel = (next: 'register') => { setDraft(null); setPanel(next); setNotice(null); };

  const testProxy = async (text: string) => {
    setProxyCheck({ text: 'Đang kiểm tra…', tone: 'idle' });
    try {
      setProxyCheck({ text: `Proxy chạy được. IP ra ngoài: ${await checkProxy(text)}`, tone: 'ok' });
    } catch (err) {
      setProxyCheck({ text: err instanceof Error ? err.message : String(err), tone: 'bad' });
    }
  };

  const doResend = async (a: StoredAccount) => {
    setResend({ id: a.id, text: 'Đang gửi…', tone: 'idle' });
    try {
      const sent = await resendVerification(a.id);
      setResend({ id: a.id, text: sent ? `Đã gửi lại email xác thực tới ${a.email}.` : 'Email đã được xác thực, bấm Đăng nhập.', tone: 'ok' });
    } catch (err) {
      setResend({ id: a.id, text: err instanceof Error ? err.message : String(err), tone: 'bad' });
    }
  };

  const edit = (a: StoredAccount) => {
    setDraft({
      id: a.id, label: a.label, email: a.email, password: a.password, deviceId: a.deviceId,
      appVersion: a.appVersion ?? '', androidVersion: a.androidVersion ?? '', publicKey: a.publicKey ?? '',
      proxy: a.proxy ?? '',
    });
    setProxyCheck(null);
    setNotice(null);
    setPanel(null);
    setFormError(null);
    setShowPassword(false);
  };

  const submit = async (event: { preventDefault(): void }, signIn: boolean) => {
    event.preventDefault();
    if (!draft) return;
    const email = draft.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFormError('Email không hợp lệ.'); return; }
    if (!draft.password) { setFormError('Nhập mật khẩu.'); return; }
    if (!/^[A-Za-z0-9_.-]{4,64}$/.test(draft.deviceId)) { setFormError('Device ID chỉ gồm chữ, số, _ . - (4–64 ký tự).'); return; }
    const proxy = parseProxy(draft.proxy);
    if (proxy && 'error' in proxy) { setFormError(proxy.error); return; }
    const before = draft.id ? accounts.find(a => a.id === draft.id) : undefined;
    const device = {
      deviceId: draft.deviceId.trim(),
      appVersion: deviceOverride('appVersion', draft.appVersion),
      androidVersion: deviceOverride('androidVersion', draft.androidVersion),
      publicKey: deviceOverride('publicKey', draft.publicKey),
    };
    const saved = await saveAccount({ ...draft, ...device, proxy: proxy?.url, email, label: draft.label.trim() });
    setDraft(null);
    setFormError(null);
    // The signed-in client keeps the device profile and password it signed in with.
    const changed = before && (before.password !== draft.password || before.proxy !== proxy?.url
      || (Object.keys(device) as (keyof typeof device)[]).some(k => before[k] !== device[k]));
    setNotice(!signIn && changed && live[before.id]?.status === 'ready'
      ? 'Đã lưu. Mật khẩu / thiết bị / proxy mới áp dụng từ lần đăng nhập sau (bấm Lưu và đăng nhập, hoặc Đăng xuất rồi Đăng nhập).' : null);
    if (signIn) {
      onOpen(saved.id);
      await connect(saved.id);
    }
  };

  return (
    <div className="screen screen-scroll">
      <header className="page-head">
        <div>
          <h1>Quản lý tài khoản</h1>
          <p className="muted small">Thêm, đăng ký hoặc nhập tài khoản Ola. Mở app không tự đăng nhập: bấm Đăng nhập ở từng nick, hoặc Đăng nhập tất cả. Nhiều nick online cùng lúc được; bấm avatar ở cột trái để xem từng nick. Mỗi nick có thông tin thiết bị riêng (Device ID, phiên bản, key2).</p>
        </div>
        {!draft?.id && (
          <div className="form-actions">
            {(!draft || panel) && (
              <button type="button" className="btn btn-primary" onClick={() => { setPanel(null); setDraft(emptyDraft()); setFormError(null); setNotice(null); }}>
                <Icon name="plus" size={16} /> Thêm tài khoản
              </button>
            )}
            {accounts.some(a => !['ready', 'signing-in'].includes(live[a.id]?.status ?? 'signed-out')) && (
              <button type="button" className="btn btn-ghost" onClick={() => void connectAll()}>
                <Icon name="logIn" size={16} /> Đăng nhập tất cả
              </button>
            )}
            <button type="button" className={`btn ${panel === 'register' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={panel === 'register'} onClick={() => openPanel('register')}>
              <Icon name="user" size={16} /> Đăng ký mới
            </button>
          </div>
        )}
      </header>

      {panel === 'register' && <RegisterPanel onClose={() => setPanel(null)} />}

      {draft && !panel && (
        <form ref={formRef} className="panel form-grid" onSubmit={e => void submit(e, true)} aria-label={draft.id ? 'Sửa tài khoản' : 'Thêm tài khoản'}>
          <h2 className="panel-title">{draft.id ? 'Sửa tài khoản' : 'Tài khoản mới'}</h2>
          <label className="field">
            <span>Tên hiển thị trong app</span>
            <input value={draft.label} placeholder="Để trống: dùng tên Ola sau khi đăng nhập" onChange={e => setDraft({ ...draft, label: e.target.value })} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="off" required value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <span className="input-with-action">
              <input type={showPassword ? 'text' : 'password'} autoComplete="off" required value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} />
              <button type="button" className="icon-btn" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(v => !v)}>
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
              </button>
            </span>
          </label>
          <div className="span-2 form-subhead">
            <h3>Thiết bị của nick này</h3>
            <p className="muted small">Gửi trong header của mọi request và đăng ký với server qua <code>users/sync</code>. Để trống = giá trị của app Android {DEVICE_DEFAULTS.appVersion}. Đổi xong áp dụng từ lần đăng nhập sau.</p>
          </div>
          <label className="field">
            <span>Device ID <span className="muted">(header deviceid, mỗi nick một mã)</span></span>
            <span className="input-with-action">
              <input value={draft.deviceId} onChange={e => setDraft({ ...draft, deviceId: e.target.value })} />
              <button type="button" className="icon-btn" aria-label="Tạo device ID mới" title="Tạo mã mới" onClick={() => setDraft({ ...draft, deviceId: newDeviceId() })}>
                <Icon name="refresh" size={16} />
              </button>
            </span>
          </label>
          <label className="field">
            <span>App version <span className="muted">(header ver)</span></span>
            <input value={draft.appVersion} placeholder={DEVICE_DEFAULTS.appVersion} onChange={e => setDraft({ ...draft, appVersion: e.target.value })} />
          </label>
          <label className="field">
            <span>Android version <span className="muted">(ver trong users/sync)</span></span>
            <input value={draft.androidVersion} placeholder={DEVICE_DEFAULTS.androidVersion} onChange={e => setDraft({ ...draft, androidVersion: e.target.value })} />
          </label>
          <label className="field">
            <span>Key2 <span className="muted">(header key2)</span></span>
            <input autoComplete="off" value={draft.publicKey} placeholder={DEVICE_DEFAULTS.publicKey} onChange={e => setDraft({ ...draft, publicKey: e.target.value })} />
          </label>
          <div className="span-2 form-subhead">
            <h3>Proxy của nick này</h3>
            <p className="muted small">
              Có proxy thì mọi kết nối của nick (đăng nhập Firebase, API Ola, socket nhắn tin) đi qua proxy này. Nhận{' '}
              <code>host:cổng</code>, <code>host:cổng:user:pass</code>, <code>http://user:pass@host:cổng</code> hoặc <code>socks5://…</code>. Để trống = không dùng proxy.
            </p>
          </div>
          <label className="field span-2">
            <span>Proxy</span>
            <span className="input-with-action">
              <input autoComplete="off" spellCheck={false} value={draft.proxy} placeholder="Không dùng proxy" onChange={e => { setDraft({ ...draft, proxy: e.target.value }); setProxyCheck(null); }} />
              <button type="button" className="btn btn-ghost btn-sm" disabled={!draft.proxy.trim() || proxyCheck?.text === 'Đang kiểm tra…'} onClick={() => void testProxy(draft.proxy)}>Kiểm tra</button>
            </span>
            {proxyCheck && <span className={`small tone-${proxyCheck.tone}`} role="status">{proxyCheck.text}</span>}
          </label>
          {formError && <p className="notice notice-bad small span-2" role="alert">{formError}</p>}
          <div className="form-actions span-2">
            <button type="submit" className="btn btn-primary"><Icon name="logIn" size={16} /> Lưu và đăng nhập</button>
            <button type="button" className="btn btn-ghost" onClick={e => void submit(e, false)}>Chỉ lưu</button>
            {accounts.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Huỷ</button>}
          </div>
        </form>
      )}

      {notice && <p className="notice small" role="status"><Icon name="info" size={15} /> {notice}</p>}

      {accounts.length > 0 && (
        <section className="panel" aria-label="Danh sách tài khoản">
          <h2 className="panel-title">Tài khoản đã lưu</h2>
          <ul className="account-table">
            {accounts.map(a => {
              const live_ = live[a.id] ?? OFFLINE;
              const online = live_.status === 'ready';
              const busy = live_.status === 'signing-in';
              const state = online ? { text: 'Đang online', tone: 'ok' }
                : busy ? { text: 'Đang đăng nhập…', tone: 'warn' }
                  : live_.status === 'error' ? { text: live_.error ?? 'Lỗi', tone: 'bad' }
                    : a.verificationSentAt ? { text: `Đã gửi email xác thực ${shortTime(a.verificationSentAt)}: mở link trong email rồi bấm Đăng nhập`, tone: 'warn' }
                      : a.lastError ? { text: `Lỗi lần trước: ${a.lastError}`, tone: 'warn' }
                        : { text: `Chưa đăng nhập${a.lastLoginAt ? ` · lần cuối ${shortTime(a.lastLoginAt)}` : ''}`, tone: 'idle' };
              return (
                <li key={a.id} className={`account-item${online ? ' is-active' : ''}`}>
                  <Avatar name={a.label || a.email} photo={a.photoURL} color={a.color} size={40} />
                  <div className="account-item-text">
                    <span className="strong">{a.label || a.email}{online && <span className="chip chip-sm tone-ok">Online</span>}</span>
                    <span className="muted small">{a.email}{a.uid ? ` · UID ${a.uid.slice(0, 8)}…` : ''}</span>
                    <span className="muted small">
                      device {a.deviceId} · ver {deviceValue(a, 'appVersion')} · Android {deviceValue(a, 'androidVersion')}
                      {a.publicKey ? ' · key2 riêng' : ''}
                      {a.proxy ? ` · proxy ${proxyLabel(a.proxy)}` : ''}
                    </span>
                    <span className={`status-line tone-${state.tone}`}><span className="status-dot" aria-hidden="true" />{state.text}</span>
                    {resend?.id === a.id && needsVerification(a) && !online && (
                      <span className={`small tone-${resend.tone}`} role="status">{resend.text}</span>
                    )}
                  </div>
                  <div className="row-actions">
                    {needsVerification(a) && !online && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={resend?.id === a.id && resend.text === 'Đang gửi…'} onClick={() => void doResend(a)}>
                        Gửi lại email xác thực
                      </button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(a.id)}>Mở</button>
                    {online || busy ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void disconnect(a.id)}><Icon name="logOut" size={15} /> Đăng xuất</button>
                    ) : (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => void connect(a.id)}>
                        <Icon name="logIn" size={15} /> {live_.status === 'error' ? 'Thử lại' : 'Đăng nhập'}
                      </button>
                    )}
                    <button type="button" className="icon-btn" aria-label={`Sửa ${a.label || a.email}`} onClick={() => edit(a)}><Icon name="pencil" size={16} /></button>
                    {confirmDelete === a.id ? (
                      <>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => { void removeAccount(a.id); setConfirmDelete(null); }}>Xoá</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Huỷ</button>
                      </>
                    ) : (
                      <button type="button" className="icon-btn" aria-label={`Xoá ${a.label || a.email}`} onClick={() => setConfirmDelete(a.id)}><Icon name="trash" size={16} /></button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

    </div>
  );
}
