import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon.tsx';
import type { StoredAccount } from '../lib/accounts.ts';
import { decryptGoogleExport, isEncryptedSession, readGoogleSessionJson, type GoogleSessionExport } from '../lib/googleSession.ts';
import { isTauri } from '../lib/platform.ts';
import { useSession } from '../lib/session.tsx';

// Nhập tài khoản đăng nhập bằng Google. The owner exports their own signed-in
// Firebase session from the Ola Android app (apps/android-session-exporter) and
// pastes the JSON here. The refresh token goes into the OS vault, never
// accounts.json. The encrypted-file variant also asks for its password.

export function GoogleImportPanel({ onClose, onImported }: {
  onClose: () => void;
  onImported: (account: StoredAccount) => void;
}) {
  const { importGoogleAccount } = useSession();
  const [text, setText] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const encrypted = isEncryptedSession(text);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isTauri) { setError('Nhập phiên Google cần bản Ola Desktop; bản chạy trong trình duyệt không lưu được phiên.'); return; }
    setBusy(true);
    setError(null);
    try {
      const session: GoogleSessionExport = encrypted ? await decryptGoogleExport(text, password) : readGoogleSessionJson(text);
      onImported(await importGoogleAccount(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel" onSubmit={e => void submit(e)} aria-label="Nhập phiên Google">
      <h2 className="panel-title">Đăng nhập bằng Google</h2>
      <p className="notice small">
        <Icon name="info" size={15} />
        <span>
          Mở <b>Ola Session Exporter</b> trên điện thoại (thư mục <code>apps/android-session-exporter</code>), bấm
          <b> Lấy phiên Google</b> rồi <b>Copy JSON</b>, và dán vào đây. Nội dung chứa quyền đăng nhập tài khoản — chỉ dán
          trên máy của bạn. Token được cất trong kho bảo mật của hệ điều hành, không lưu vào <code>accounts.json</code>.
        </span>
      </p>
      <label className="field">
        <span>Nội dung phiên (JSON)</span>
        <textarea
          className="textarea"
          rows={7}
          autoComplete="off"
          spellCheck={false}
          placeholder='Dán JSON xuất từ Ola Session Exporter, ví dụ {"format":"ola-google-session", …}'
          value={text}
          onChange={e => { setText(e.target.value); setError(null); }}
        />
      </label>
      {encrypted && (
        <label className="field">
          <span>Mật khẩu file phiên</span>
          <input type="password" autoComplete="off" value={password} placeholder="Mật khẩu đặt khi xuất file" onChange={e => { setPassword(e.target.value); setError(null); }} />
        </label>
      )}
      {error && <p className="notice notice-bad small" role="alert"><Icon name="alert" size={15} /><span>{error}</span></p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
          {busy ? 'Đang nhập…' : 'Nhập và đăng nhập'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Huỷ</button>
      </div>
    </form>
  );
}
