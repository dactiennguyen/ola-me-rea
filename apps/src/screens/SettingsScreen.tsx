import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon.tsx';
import { dataDir, isTauri } from '../lib/platform.ts';
import { useSession } from '../lib/session.tsx';
import { AccountsTransferPanel } from './AccountsTransferPanel.tsx';
import { DEFAULT_SETTINGS, SERVERS, type AppSettings, type CloseAction } from '../lib/settings.ts';

/** App-wide options (not per account): test mode, close button, socket key. */
export function SettingsScreen() {
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
    <div className="screen screen-scroll">
      <header className="page-head">
        <div>
          <h1>Cài đặt</h1>
          <p className="muted small">Dùng chung cho cả app, không theo tài khoản; kèm nhập / xuất danh sách tài khoản. Device ID, phiên bản, key2 và proxy của từng nick nằm ở Quản lý tài khoản.</p>
        </div>
      </header>
      <form className="panel form-grid" onSubmit={e => void submit(e)} aria-label="Cài đặt app">
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
          <Icon name="info" size={15} />
          <span>
            Tài khoản lưu dạng JSON thường (kể cả mật khẩu) trong <code>accounts.json</code>, chỉ người dùng hiện tại đọc được (quyền 600).
            {folder ? <> Thư mục: <code className="break">{folder}</code></> : !isTauri ? ' Đang chạy trong trình duyệt: dữ liệu nằm trong localStorage.' : ''}
          </span>
        </p>
      </form>
      <AccountsTransferPanel />
    </div>
  );
}
