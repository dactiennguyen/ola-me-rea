import { useEffect, useRef, useState } from 'react';
import { closeWindow } from '../lib/platform.ts';
import { useSession } from '../lib/session.tsx';
import { Icon } from './Icon.tsx';

/**
 * Đóng cửa sổ, shown when the close button is pressed and Cài đặt says to ask
 * (src-tauri/src/tray.rs). Thu nhỏ vào khay hides the window and keeps the
 * account signed in; Thoát ứng dụng quits. Ghi nhớ saves the choice as
 * `onClose`, changeable again in Quản lý tài khoản → Cài đặt. Huỷ or Escape
 * leaves the window open.
 */
export function CloseDialog({ onDone }: { onDone: () => void }) {
  const { settings, saveSettings, status } = useSession();
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onDone(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  const choose = async (action: 'tray' | 'quit') => {
    setBusy(true);
    setError('');
    try {
      if (remember) await saveSettings({ ...settings, onClose: action });
      await closeWindow(action);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const signedIn = status === 'ready';
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onDone(); }}>
      <div className="modal panel" role="dialog" aria-modal="true" aria-labelledby="close-dialog-title">
        <div>
          <h2 id="close-dialog-title" className="panel-title">Đóng cửa sổ</h2>
          <p className="muted small">Chọn việc khi đóng cửa sổ</p>
        </div>
        <div className="choice-list">
          <button ref={first} type="button" className="choice" disabled={busy} onClick={() => void choose('tray')}>
            <span className="choice-icon choice-icon-tray"><Icon name="toTray" size={20} /></span>
            <span className="choice-text">
              <b>Thu nhỏ vào khay</b>
              <span className="muted small">
                {signedIn ? 'Vẫn giữ đăng nhập và nhận tin nhắn. ' : 'Ứng dụng vẫn chạy nền. '}
                Mở lại bằng icon ở khay hệ thống.
              </span>
            </span>
          </button>
          <button type="button" className="choice" disabled={busy} onClick={() => void choose('quit')}>
            <span className="choice-icon choice-icon-quit"><Icon name="logOut" size={20} /></span>
            <span className="choice-text">
              <b>Thoát ứng dụng</b>
              <span className="muted small">Đóng hẳn ứng dụng{signedIn ? ' và ngắt kết nối nhắn tin' : ''}.</span>
            </span>
          </button>
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          <span>Ghi nhớ lựa chọn của tôi và không hỏi lại</span>
        </label>
        {remember && <p className="muted small modal-hint">Đổi lại trong Quản lý tài khoản → Cài đặt.</p>}
        {error && <p className="tone-bad small" role="alert">{error}</p>}
        <div className="form-actions modal-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDone}>Huỷ</button>
        </div>
      </div>
    </div>
  );
}
