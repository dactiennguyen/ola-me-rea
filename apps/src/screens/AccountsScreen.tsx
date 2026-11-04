import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '../components/Avatar.tsx';
import { Icon } from '../components/Icon.tsx';
import { DEVICE_DEFAULTS, deviceOverride, deviceValue, newDeviceId, type StoredAccount } from '../lib/accounts.ts';
import { shortTime } from '../lib/format.ts';
import { dataDir, isTauri } from '../lib/platform.ts';
import { useSession } from '../lib/session.tsx';
import { AccountsTransferPanel } from './AccountsTransferPanel.tsx';
import { RegisterPanel } from './RegisterPanel.tsx';
import { DEFAULT_SETTINGS, SERVERS, type AppSettings, type CloseAction } from '../lib/settings.ts';

interface Draft {
  id?: string; label: string; email: string; password: string;
  /** This account's device profile; an empty field means the APK default. */
  deviceId: string; appVersion: string; androidVersion: string; publicKey: string;
}

const emptyDraft = (): Draft => ({
  label: '', email: '', password: '', deviceId: newDeviceId(), appVersion: '', androidVersion: '', publicKey: '',
});

export type AccountsPanel = 'add' | 'register' | 'transfer';
/** Opens a panel from outside (the sidebar); `n` changes on every request. */
export interface AccountsRequest { panel: AccountsPanel; n: number }

/** Sign-in failed or registration is pending because the email is not verified yet. */
const needsVerification = (a: StoredAccount) => Boolean(a.verificationSentAt) || /xác minh/.test(a.lastError ?? '');

export function AccountsScreen({ request }: { request?: AccountsRequest | null }) {
  const { accounts, activeId, status, error, switchAccount, signOut, saveAccount, removeAccount, resendVerification } = useSession();
  const [draft, setDraft] = useState<Draft | null>(accounts.length ? null : emptyDraft());
  const [panel, setPanel] = useState<'register' | 'transfer' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // A new or edited account form scrolls into view (it sits above the list).
  useEffect(() => { formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [draft?.id, draft === null]);

  useEffect(() => {
    if (!request) return;
    if (request.panel === 'add') { setPanel(null); setDraft(emptyDraft()); } else { setDraft(null); setPanel(request.panel); }
  }, [request]);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [resend, setResend] = useState<{ id: string; text: string; tone: string } | null>(null);

  const openPanel = (next: 'register' | 'transfer') => { setDraft(null); setPanel(next); setNotice(null); };

  const doResend = async (a: StoredAccount) => {
    setResend({ id: a.id, text: 'Đang gửi…', tone: 'idle' });
    try {
      const sent = await resendVerification(a.id);
      setResend({ id: a.id, text: sent ? `Đã gửi lại email xác thực tới ${a.email}.` : 'Email đã được xác thực, bấm Dùng để đăng nhập.', tone: 'ok' });
    } catch (err) {
      setResend({ id: a.id, text: err instanceof Error ? err.message : String(err), tone: 'bad' });
    }
  };

  const edit = (a: StoredAccount) => {
    setDraft({
      id: a.id, label: a.label, email: a.email, password: a.password, deviceId: a.deviceId,
      appVersion: a.appVersion ?? '', androidVersion: a.androidVersion ?? '', publicKey: a.publicKey ?? '',
    });
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
    const before = draft.id ? accounts.find(a => a.id === draft.id) : undefined;
    const device = {
      deviceId: draft.deviceId.trim(),
      appVersion: deviceOverride('appVersion', draft.appVersion),
      androidVersion: deviceOverride('androidVersion', draft.androidVersion),
      publicKey: deviceOverride('publicKey', draft.publicKey),
    };
    const saved = await saveAccount({ ...draft, ...device, email, label: draft.label.trim() });
    setDraft(null);
    setFormError(null);
    // The signed-in client keeps the device profile it signed in with.
    const deviceChanged = before && (Object.keys(device) as (keyof typeof device)[]).some(k => before[k] !== device[k]);
    setNotice(!signIn && deviceChanged && before.id === activeId && status === 'ready'
      ? 'Đã lưu. Thông tin thiết bị mới áp dụng từ lần đăng nhập sau (bấm Đăng xuất rồi Dùng).' : null);
    if (signIn) await switchAccount(saved.id);
  };

  return (
    <div className="screen screen-scroll">
      <header className="page-head">
        <div>
          <h1>Quản lý tài khoản</h1>
          <p className="muted small">Thêm, đăng ký hoặc nhập tài khoản Ola. Mỗi nick có thông tin thiết bị riêng; phần cài đặt cuối trang dùng chung cho app.</p>
        </div>
        {!draft?.id && (
          <div className="form-actions">
            {(!draft || panel) && (
              <button type="button" className="btn btn-primary" onClick={() => { setPanel(null); setDraft(emptyDraft()); setFormError(null); setNotice(null); }}>
                <Icon name="plus" size={16} /> Thêm tài khoản
              </button>
            )}
            <button type="button" className={`btn ${panel === 'register' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={panel === 'register'} onClick={() => openPanel('register')}>
              <Icon name="user" size={16} /> Đăng ký mới
            </button>
            <button type="button" className={`btn ${panel === 'transfer' ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={panel === 'transfer'} onClick={() => openPanel('transfer')}>
              <Icon name="arrowUpDown" size={16} /> Nhập / Xuất
            </button>
          </div>
        )}
      </header>

      {panel === 'register' && <RegisterPanel onClose={() => setPanel(null)} />}
      {panel === 'transfer' && <AccountsTransferPanel onClose={() => setPanel(null)} />}

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
              const active = a.id === activeId;
              const state = active
                ? status === 'ready' ? { text: 'Đang hoạt động', tone: 'ok' }
                  : status === 'signing-in' ? { text: 'Đang đăng nhập…', tone: 'warn' }
                    : status === 'error' ? { text: error ?? 'Lỗi', tone: 'bad' } : { text: 'Đã đăng xuất', tone: 'idle' }
                : a.verificationSentAt ? { text: `Đã gửi email xác thực ${shortTime(a.verificationSentAt)}: mở link trong email rồi bấm Dùng`, tone: 'warn' }
                : a.lastError ? { text: `Lỗi lần trước: ${a.lastError}`, tone: 'warn' }
                  : { text: a.lastLoginAt ? `Đăng nhập lần cuối ${shortTime(a.lastLoginAt)}` : 'Chưa đăng nhập', tone: 'idle' };
              return (
                <li key={a.id} className={`account-item${active ? ' is-active' : ''}`}>
                  <Avatar name={a.label || a.email} photo={a.photoURL} color={a.color} size={40} />
                  <div className="account-item-text">
                    <span className="strong">{a.label || a.email}{active && <span className="chip chip-sm">Đang dùng</span>}</span>
                    <span className="muted small">{a.email}{a.uid ? ` · UID ${a.uid.slice(0, 8)}…` : ''}</span>
                    <span className="muted small">
                      device {a.deviceId} · ver {deviceValue(a, 'appVersion')} · Android {deviceValue(a, 'androidVersion')}
                      {a.publicKey ? ' · key2 riêng' : ''}
                    </span>
                    <span className={`status-line tone-${state.tone}`}><span className="status-dot" aria-hidden="true" />{state.text}</span>
                    {resend?.id === a.id && needsVerification(a) && !(active && status === 'ready') && (
                      <span className={`small tone-${resend.tone}`} role="status">{resend.text}</span>
                    )}
                  </div>
                  <div className="row-actions">
                    {needsVerification(a) && !(active && status === 'ready') && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={resend?.id === a.id && resend.text === 'Đang gửi…'} onClick={() => void doResend(a)}>
                        Gửi lại email xác thực
                      </button>
                    )}
                    {(!active || status !== 'ready') && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => void switchAccount(a.id)}>
                        <Icon name="logIn" size={15} /> {active ? 'Thử lại' : 'Dùng'}
                      </button>
                    )}
                    {active && status === 'ready' && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}><Icon name="logOut" size={15} /> Đăng xuất</button>
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

      <SettingsPanel />
    </div>
  );
}

function SettingsPanel() {
  const { settings, saveSettings } = useSession();
  const [form, setForm] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  const keyIsDefault = form.socketKey === DEFAULT_SETTINGS.socketKey;

  useEffect(() => { setForm(settings); }, [settings]);
  useEffect(() => { void dataDir().then(setFolder).catch(() => setFolder(null)); }, []);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => { setForm(f => ({ ...f, [key]: value })); setSaved(null); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await saveSettings(form);
    setSaved('Đã lưu.');
  };

  return (
    <form className="panel form-grid" onSubmit={e => void submit(e)} aria-label="Cài đặt app">
      <div className="span-2">
        <h2 className="panel-title">Cài đặt app</h2>
        <p className="muted small">Dùng chung cho mọi nick. Device ID, phiên bản và key2 nằm ở từng tài khoản (nút sửa ở danh sách).</p>
      </div>
      <label className="checkbox span-2">
        <input type="checkbox" checked={form.dryRunSends} onChange={e => set('dryRunSends', e.target.checked)} />
        <span>Chế độ thử: không gửi tin thật (chỉ hiện trên máy này)</span>
      </label>
      <label className="field">
        <span>Khi bấm nút đóng cửa sổ</span>
        <select value={form.onClose} onChange={e => set('onClose', e.target.value as CloseAction)}>
          <option value="ask">Hỏi mỗi lần</option>
          <option value="tray">Thu nhỏ vào khay (chạy nền)</option>
          <option value="quit">Thoát ứng dụng</option>
        </select>
      </label>

      <div className="advanced-toggle span-2">
        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(v => !v)}>
          <Icon name={showAdvanced ? 'chevronDown' : 'chevronRight'} size={15} /> Nâng cao
        </button>
        {!showAdvanced && (
          <span className="muted small">
            Socket key cho nhắn tin realtime {keyIsDefault ? 'đã có sẵn, không cần nhập' : 'đã được chỉnh'}.
          </span>
        )}
      </div>
      {showAdvanced && (
        <label className="field span-2">
          <span>Socket key <span className="muted">(hằng số <code>key</code> của Socket.IO, đã có mặc định; chỉ đổi khi app gốc đổi key)</span></span>
          <span className="input-with-action">
            <input type={showKey ? 'text' : 'password'} autoComplete="off" value={form.socketKey} placeholder="Trống = không kết nối realtime" onChange={e => set('socketKey', e.target.value)} />
            <button type="button" className="icon-btn" aria-label={showKey ? 'Ẩn key' : 'Hiện key'} onClick={() => setShowKey(v => !v)}>
              <Icon name={showKey ? 'eyeOff' : 'eye'} size={16} />
            </button>
            {!keyIsDefault && (
              <button type="button" className="icon-btn" aria-label="Khôi phục socket key mặc định" title="Dùng key mặc định" onClick={() => set('socketKey', DEFAULT_SETTINGS.socketKey)}>
                <Icon name="refresh" size={16} />
              </button>
            )}
          </span>
        </label>
      )}

      <div className="form-actions span-2">
        <button type="submit" className="btn btn-primary">Lưu cài đặt</button>
        <button type="button" className="btn btn-ghost" onClick={() => setForm(DEFAULT_SETTINGS)}>Khôi phục mặc định</button>
        {saved && <span className="tone-ok small" role="status">{saved}</span>}
      </div>
      <p className="muted small span-2">
        Máy chủ API <code>{SERVERS.api}</code> · Socket <code>{SERVERS.socket}</code>. Cố định theo quyền mạng của app
        (<code>capabilities/default.json</code> và CSP), nên không đổi được trong Cài đặt.
      </p>
      <p className="notice small span-2">
        <Icon name="info" size={15} /> Tài khoản lưu dạng JSON thường (kể cả mật khẩu) trong <code>accounts.json</code>, chỉ người dùng hiện tại đọc được (quyền 600).
        {folder ? <> Thư mục: <code className="break">{folder}</code></> : !isTauri ? ' Đang chạy trong trình duyệt: dữ liệu nằm trong localStorage.' : ''}
      </p>
    </form>
  );
}
