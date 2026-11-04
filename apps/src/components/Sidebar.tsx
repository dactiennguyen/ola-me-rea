import { useAccount, type RealtimeState } from '../lib/session.tsx';
import { liveText, liveTone } from './AccountRail.tsx';
import { Avatar } from './Avatar.tsx';
import { Icon, type IconName } from './Icon.tsx';

/** The screens of one account. */
export type Screen = 'messages' | 'explore' | 'rooms' | 'profile';

const NAV: { id: Screen; label: string; icon: IconName }[] = [
  { id: 'messages', label: 'Tin nhắn', icon: 'message' },
  { id: 'explore', label: 'Khám phá', icon: 'compass' },
  { id: 'rooms', label: 'Phòng chat', icon: 'users' },
  { id: 'profile', label: 'Thông tin tài khoản', icon: 'user' },
];

export const REALTIME: Record<RealtimeState, { text: string; tone: 'ok' | 'warn' | 'bad' | 'idle' }> = {
  off: { text: 'Chưa đăng nhập', tone: 'idle' },
  'missing-key': { text: 'Thiếu socket key', tone: 'warn' },
  idle: { text: 'Chưa kết nối', tone: 'idle' },
  connecting: { text: 'Đang kết nối…', tone: 'warn' },
  connected: { text: 'Ổn định', tone: 'ok' },
  disconnected: { text: 'Mất kết nối', tone: 'bad' },
  error: { text: 'Lỗi kết nối', tone: 'bad' },
};

/** The sidebar of the account on screen: who it is, its screens, its realtime channel. */
export function Sidebar({ screen, onNavigate, unread }: { screen: Screen; onNavigate: (s: Screen) => void; unread: number }) {
  const { account, state } = useAccount();
  const name = state.me?.displayName || account.label || account.email;
  const rt = REALTIME[state.realtime];
  return (
    <aside className="sidebar" aria-label={`Tài khoản ${name}`}>
      <button type="button" className="sidebar-account" title="Thông tin tài khoản" onClick={() => onNavigate('profile')}>
        <Avatar name={name} photo={state.me?.photoURL || account.photoURL} color={account.color} size={40} ring="var(--sidebar)" />
        <span className="account-text">
          <span className="account-name">{account.label || name}</span>
          <span className="muted small ellipsis">{account.email}</span>
          <span className={`status-line tone-${liveTone(state)}`}><span className="status-dot" aria-hidden="true" />{liveText(account, state)}</span>
        </span>
      </button>

      <nav className="sidebar-section" aria-label="Mục của tài khoản">
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

      <div className="realtime-chip" title="Kênh Socket.IO cá nhân của nick này (nhận tin 1-1)">
        <span className={`status-dot tone-${rt.tone}`} aria-hidden="true" />
        <span className="grow">Kết nối realtime</span>
        <span className={`tone-${rt.tone} strong`}>{rt.text}</span>
      </div>
    </aside>
  );
}
