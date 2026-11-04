import { useState, type FormEvent } from 'react';
import { registrationProblem, TERMS_URL } from '@ola/core/register.ts';
import { Icon } from '../components/Icon.tsx';
import type { StoredAccount } from '../lib/accounts.ts';
import { useSession } from '../lib/session.tsx';

// Đăng ký tài khoản, as the Android app's RegisterScreen does it
// (docs/api/luong-dang-ky.md): same fields, rules and messages; checkEmail, then
// Firebase creates the account and sends the verification email. The account is
// saved to the list but can sign in only after the link in that email is opened.

interface Form {
  label: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeTerms: boolean;
  confirmAge: boolean;
}

const EMPTY: Form = { label: '', email: '', password: '', confirmPassword: '', agreeTerms: false, confirmAge: false };

export function RegisterPanel({ onClose }: { onClose: () => void }) {
  const { register } = useSession();
  const [form, setForm] = useState<Form>(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<StoredAccount | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => { setForm(f => ({ ...f, [key]: value })); setError(null); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = registrationProblem(form);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      setCreated(await register(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copyTerms = () => {
    void navigator.clipboard.writeText(TERMS_URL).then(() => setCopied(true), () => setCopied(false));
  };

  if (created) {
    return (
      <section className="panel" aria-label="Đăng ký thành công">
        <h2 className="panel-title">Đã tạo tài khoản</h2>
        <p className="notice small">
          <Icon name="info" size={15} />
          Một email xác thực đã được gửi tới <b>{created.email}</b>. Mở link trong email, rồi bấm <b>Dùng</b> ở tài
          khoản này trong danh sách để đăng nhập. Chưa thấy email thì xem thư mục Spam, hoặc bấm "Gửi lại email xác thực".
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>Xong</button>
        </div>
      </section>
    );
  }

  return (
    <form className="panel form-grid" onSubmit={e => void submit(e)} aria-label="Đăng ký tài khoản" noValidate>
      <div className="span-2">
        <h2 className="panel-title">Đăng ký tài khoản</h2>
        <p className="muted small">Tạo tài khoản Ola mới bằng email, giống màn đăng ký của app điện thoại.</p>
      </div>
      <label className="field">
        <span>Email</span>
        <input type="email" autoComplete="off" value={form.email} disabled={busy} onChange={e => set('email', e.target.value)} />
      </label>
      <label className="field">
        <span>Tên hiển thị trong app <span className="muted">(tuỳ chọn)</span></span>
        <input value={form.label} disabled={busy} placeholder="Để trống: dùng tên Ola sau khi đăng nhập" onChange={e => set('label', e.target.value)} />
      </label>
      <label className="field">
        <span>Mật khẩu <span className="muted">(ít nhất 6 ký tự)</span></span>
        <span className="input-with-action">
          <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} disabled={busy} onChange={e => set('password', e.target.value)} />
          <button type="button" className="icon-btn" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShowPassword(v => !v)}>
            <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
          </button>
        </span>
      </label>
      <label className="field">
        <span>Nhập lại mật khẩu</span>
        <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} disabled={busy} onChange={e => set('confirmPassword', e.target.value)} />
      </label>
      <label className="checkbox span-2">
        <input type="checkbox" checked={form.agreeTerms} disabled={busy} onChange={e => set('agreeTerms', e.target.checked)} />
        <span>Tôi đã đọc và đồng ý với Điều khoản sử dụng</span>
      </label>
      <p className="muted small span-2 terms-line">
        Điều khoản sử dụng: <code className="break">{TERMS_URL}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyTerms}>{copied ? 'Đã sao chép' : 'Sao chép link'}</button>
      </p>
      <label className="checkbox span-2">
        <input type="checkbox" checked={form.confirmAge} disabled={busy} onChange={e => set('confirmAge', e.target.checked)} />
        <span>Tôi xác nhận mình đủ 18 tuổi trở lên</span>
      </label>
      {error && <p className="notice notice-bad small span-2" role="alert">{error}</p>}
      <div className="form-actions span-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <><span className="spinner spinner-sm" aria-hidden="true" /> Đang đăng ký…</> : <><Icon name="plus" size={16} /> Đăng ký ngay</>}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Huỷ</button>
      </div>
      <p className="muted small span-2">
        Tạo tài khoản thật trên Ola (Firebase). Tài khoản được thêm vào danh sách nhưng chỉ đăng nhập được sau khi
        xác thực email.
      </p>
    </form>
  );
}
