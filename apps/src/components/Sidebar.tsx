import type { StoredAccount } from '../lib/accounts.ts';
import { shortTime } from '../lib/format.ts';
import { useSession, type RealtimeState } from '../lib/session.tsx';
import { Avatar } from './Avatar.tsx';
import { Icon, type IconName } from './Icon.tsx';

export type Screen = 'messages' | 'explore' | 'rooms' | 'accounts';

const NAV: { id: Screen; label: string; icon: IconName }[] = [
  { id: 'messages', label: 'Tin nhắn', icon: 'message' },
  { id: 'explore', label: 'Khám phá', icon: 'compass' },
  { id: 'rooms', label: 'Phòng chat', icon: 'users' },
  { id: 'accounts', label: 'Quản lý tài khoản', icon: 'settings' },
];

const REALTIME: Record<RealtimeState, { text: string; tone: 'ok' | 'warn' | 'bad' | 'idle' }> = {
  off: { text: 'Chưa đăng nhập', tone: 'idle' },
  'missing-key': { text: 'Thiếu socket key', tone: 'warn' },
  idle: { text: 'Chưa kết nối', tone: 'idle' },
  connecting: { text: 'Đang kết nối…', tone: 'warn' },
  connected: { text: 'Ổn định', tone: 'ok' },
  disconnected: { text: 'Mất kết nối', tone: 'bad' },
  error: { text: 'Lỗi kết nối', tone: 'bad' },
};

function accountStatus(account: StoredAccount, active: boolean, status: string, error: string | null) {
  if (active && status === 'ready') return { text: 'Đang hoạt động', tone: 'ok' as const };
  if (active && status === 'signing-in') return { text: 'Đang đăng nhập…', tone: 'warn' as const };
  if (active && status === 'error') return { text: error ?? 'Lỗi đăng nhập', tone: 'bad' as const };
  if (account.lastError) return { text: 'Lỗi lần trước', tone: 'warn' as const };
  if (account.lastLoginAt) return { text: `Đăng nhập ${shortTime(account.lastLoginAt)}`, tone: 'idle' as const };
  return { text: 'Chưa đăng nhập', tone: 'idle' as const };
}

export function Sidebar({ screen, onNavigate, unread }: { screen: Screen; onNavigate: (s: Screen) => void; unread: number }) {
  const { accounts, activeId, status, error, realtime, switchAccount } = useSession();
  const rt = REALTIME[realtime];
  return (
    <aside className="sidebar" aria-label="Tài khoản và điều hướng">
      <div className="sidebar-brand">
        <span className="brand-name">Ola Desktop</span>
        <span className="muted small">{accounts.length} tài khoản</span>
      </div>

      <section className="sidebar-section">
        <h2 className="section-label">Tài khoản</h2>
        {accounts.map(account => {
          const active = account.id === activeId;
          const s = accountStatus(account, active, status, error);
          return (
            <button
              key={account.id}
              type="button"
              className={`account-row${active ? ' is-active' : ''}`}
              aria-current={active ? 'true' : undefined}
              onClick={() => { if (!active || status === 'error' || status === 'signed-out') void switchAccount(account.id); }}
              title={account.email}
            >
              <Avatar name={account.label || account.email} photo={account.photoURL} color={account.color} size={32} />
              <span className="account-text">
                <span className="account-name">{account.label || account.email}</span>
                <span className={`status-line tone-${s.tone}`}><span className="status-dot" aria-hidden="true" />{s.text}</span>
              </span>
            </button>
          );
        })}
        <button type="button" className="add-account" onClick={() => onNavigate('accounts')}>
          <Icon name="plus" /> Thêm tài khoản
        </button>
      </section>

      <nav className="sidebar-section" aria-label="Điều hướng chính">
        <h2 className="section-label">Mục</h2>
        {NAV.map(item => (
          <button
            key={item.id}
            type="button"
            className={`nav-row${screen === item.id ? ' is-active' : ''}`}
            aria-current={screen === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} />
            <span className="nav-label">{item.label}</span>
            {item.id === 'messages' && unread > 0 && <span className="count-badge">{unread > 99 ? '99+' : unread}</span>}
          </button>
        ))}
      </nav>

      <div className="realtime-chip" title="Kênh Socket.IO cá nhân (nhận tin 1-1)">
        <span className={`status-dot tone-${rt.tone}`} aria-hidden="true" />
        <span className="grow">Kết nối realtime</span>
        <span className={`tone-${rt.tone} strong`}>{rt.text}</span>
      </div>
    </aside>
  );
}
