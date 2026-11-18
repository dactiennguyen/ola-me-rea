import { useEffect, useRef, useState } from 'react';
import { Spinner } from '../ui/Spinner.tsx';
import { checkUpdate, installUpdate, mb, useUpdate, type UpdateView } from '../lib/update.ts';
import { Icon } from './Icon.tsx';

const clock = (at: number) => new Date(at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * The thin bar along the bottom of the window; its right end holds the version and Kiểm tra cập nhật
 * (src-tauri/src/update.rs). Nothing is forced: a newer version only lights up here, and Cập nhật opens a card with
 * what is new and the button that downloads, installs and reopens the app.
 */
export function UpdateBar() {
  const u = useUpdate();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  // Opens on its own while the update the user started downloads or installs.
  const busy = u?.state === 'downloading' || u?.state === 'installing';
  useEffect(() => { if (busy) setOpen(true); }, [busy]);
  useEffect(() => { if (u?.state !== 'available' && !busy) setOpen(false); }, [u?.state, busy]);

  if (!u) return null;

  const check = async () => { setError(''); await checkUpdate().catch(e => setError(String(e))); };
  const install = async () => {
    setError('');
    try { await installUpdate(); } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
  };

  return (
    <footer className="statusbar" aria-label="Phiên bản và cập nhật">
      <div className="statusbar-right" aria-live="polite">
        <Status u={u} onOpen={() => setOpen(o => !o)} expanded={open} />
        {(u.state === 'idle' || u.state === 'latest' || u.state === 'failed' || u.state === 'checking') && (
          <button type="button" className="statusbar-btn" disabled={u.state === 'checking'} onClick={() => void check()}>
            <Icon name="refresh" size={13} /> Kiểm tra cập nhật
          </button>
        )}
      </div>
      {open && (u.state === 'available' || busy) && (
        <UpdateCard u={u} error={error} onInstall={() => void install()} onClose={() => setOpen(false)} />
      )}
    </footer>
  );
}

/** The version, and one short word on the update. */
function Status({ u, onOpen, expanded }: { u: UpdateView; onOpen: () => void; expanded: boolean }) {
  const version = <span className="statusbar-version">v{u.current}</span>;
  switch (u.state) {
    case 'off':
      return <span className="statusbar-text" title={u.reason}>{version} · bản dev, không tự cập nhật</span>;
    case 'checking':
      return <span className="statusbar-text">{version} · <Spinner size={11} /> Đang kiểm tra…</span>;
    case 'latest':
      return (
        <span className="statusbar-text" title={`Kiểm tra lúc ${clock(u.checkedAt)}`}>
          {version} · <Icon name="circleCheck" size={12} className="tone-ok" /> Bản mới nhất
        </span>
      );
    case 'failed':
      return <span className="statusbar-text tone-warn" title={u.message}>{version} · Không kiểm tra được</span>;
    case 'available':
    case 'downloading':
    case 'installing': {
      const part = u.state === 'downloading' && u.total ? Math.round((u.got / u.total) * 100) : null;
      const label = u.state === 'available' ? `Có bản ${u.version} · Cập nhật`
        : u.state === 'downloading' ? `Đang tải ${u.version}${part != null ? ` · ${part}%` : '…'}`
        : `Đang cài ${u.version}…`;
      return (
        <span className="statusbar-text">
          {version}
          <button type="button" className="statusbar-btn statusbar-new" aria-expanded={expanded} onClick={onOpen}>
            {u.state === 'available' ? <Icon name="download" size={13} /> : <Spinner size={11} />} {label}
          </button>
        </span>
      );
    }
    default:
      return <span className="statusbar-text">{version}</span>;
  }
}

/** Above the bar's right end: what is new, then Cập nhật ngay; the download's progress once started. */
function UpdateCard({ u, error, onInstall, onClose }: {
  u: Extract<UpdateView, { state: 'available' | 'downloading' | 'installing' }>;
  error: string;
  onInstall: () => void;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const idle = u.state === 'available';
  useEffect(() => {
    card.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && idle) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [idle, onClose]);
  const notes = u.state === 'installing' ? '' : u.notes.trim();
  const part = u.state === 'downloading' && u.total ? u.got / u.total : null;

  return (
    <div ref={card} className="update-card" role="dialog" aria-label={`Cập nhật bản ${u.version}`}>
      <div className="flex items-start gap-2">
        <Icon name="download" size={18} className="mt-0.5 shrink-0 text-accent-text" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base">Bản mới {u.version}</h2>
          <p className="muted small">Đang dùng {u.current}</p>
        </div>
        {idle && (
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><Icon name="x" size={15} /></button>
        )}
      </div>
      {notes && (
        <div className="update-notes">
          <b>Có gì mới</b>
          {notes.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
      {u.state === 'downloading' && (
        <div className="flex flex-col gap-1">
          <span className="progress"><span className="progress-fill" style={{ width: `${Math.round((part ?? 0) * 100)}%` }} /></span>
          <small className="muted">
            {part != null ? `Đang tải ${Math.round(part * 100)}% · ${mb(u.got)}/${mb(u.total!)} MB` : `Đang tải ${mb(u.got)} MB`}
          </small>
        </div>
      )}
      {u.state === 'installing' && <p className="small"><Spinner size={12} /> Đang cài, app sẽ tự mở lại…</p>}
      {idle && (
        <>
          <p className="muted small">App tải bản mới, cài rồi tự mở lại. Việc đang chạy (tự gửi, tự trả lời) sẽ dừng; mở lại xong cần bấm Đăng nhập cho các nick.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Để sau</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={onInstall}>Cập nhật ngay</button>
          </div>
        </>
      )}
      {error && <p className="tone-bad small break" role="alert">{error}</p>}
    </div>
  );
}
