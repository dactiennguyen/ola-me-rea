import type { StoredAccount } from '../lib/accounts.ts';
import { OFFLINE, useSession, type LiveState } from '../lib/session.tsx';
import { Avatar } from './Avatar.tsx';
import { Icon } from './Icon.tsx';

/** What the main area shows: one account, or an app-wide page. */
export type AppView = 'account' | 'outreach' | 'accounts' | 'settings';

export function liveTone(state: LiveState): 'ok' | 'warn' | 'bad' | 'idle' {
  if (state.status === 'ready') return state.realtime === 'connected' || state.realtime === 'off' ? 'ok' : 'warn';
  if (state.status === 'signing-in') return 'warn';
  if (state.status === 'error') return 'bad';
  return 'idle';
}

export function liveText(account: StoredAccount, state: LiveState): string {
  if (state.status === 'ready') return 'Đang online';
  if (state.status === 'signing-in') return 'Đang đăng nhập…';
  if (state.status === 'error') return state.error ?? 'Lỗi đăng nhập';
  if (account.verificationSentAt) return 'Chờ xác thực email';
  return 'Chưa đăng nhập';
}

/**
 * The narrow column on the far left: one avatar per account (several can be
 * online at once), its status dot and unread count; Thêm, Quản lý tài khoản and Cài đặt
 * at the bottom.
 */
export function AccountRail({ view, unread, onAccount, onAdd, onOutreach, onManage, onSettings }: {
  view: AppView;
  unread: Record<string, number>;
  onAccount: (id: string) => void;
  onAdd: () => void;
  onOutreach: () => void;
  onManage: () => void;
  onSettings: () => void;
}) {
  const { accounts, selectedId, live, connectAll } = useSession();
  // Something to sign in: an account that is neither online nor already signing in.
  const needsLogin = accounts.some(a => {
    const status = (live[a.id] ?? OFFLINE).status;
    return status !== 'ready' && status !== 'signing-in';
  });
  return (
    <nav className="rail" aria-label="Tài khoản">
      <div className="rail-accounts">
        {accounts.map(account => {
          const state = live[account.id] ?? OFFLINE;
          const active = view === 'account' && account.id === selectedId;
          const count = unread[account.id] ?? 0;
          const name = account.label || account.email;
          return (
            <button
              key={account.id}
              type="button"
              className={`rail-account${active ? ' is-active' : ''}${state.status === 'ready' ? '' : ' is-offline'}`}
              aria-current={active ? 'page' : undefined}
              aria-label={`${name}: ${liveText(account, state)}${count ? `, ${count} tin chưa đọc` : ''}`}
              title={`${name}\n${account.email}\n${liveText(account, state)}`}
              onClick={() => onAccount(account.id)}
            >
              <Avatar name={name} photo={account.photoURL} color={account.color} size={40} />
              <span className={`rail-dot tone-${liveTone(state)}`} aria-hidden="true" />
              {count > 0 && <span className="rail-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
            </button>
          );
        })}
        <button type="button" className="rail-btn rail-add" title="Thêm tài khoản" aria-label="Thêm tài khoản" onClick={onAdd}>
          <Icon name="plus" size={20} />
        </button>
      </div>
      <div className="rail-bottom">
        {needsLogin && (
          <button type="button" className="rail-btn rail-login-all" title="Đăng nhập tất cả tài khoản" aria-label="Đăng nhập tất cả tài khoản" onClick={() => void connectAll()}>
            <Icon name="logIn" size={20} />
          </button>
        )}
        <button type="button" className={`rail-btn${view === 'outreach' ? ' is-active' : ''}`} title="Tìm người & nhắn" aria-label="Tìm người và nhắn" aria-current={view === 'outreach' ? 'page' : undefined} onClick={onOutreach}>
          <Icon name="send" size={20} />
        </button>
        <button type="button" className={`rail-btn${view === 'accounts' ? ' is-active' : ''}`} title="Quản lý tài khoản" aria-label="Quản lý tài khoản" aria-current={view === 'accounts' ? 'page' : undefined} onClick={onManage}>
          <Icon name="users" size={20} />
        </button>
        <button type="button" className={`rail-btn${view === 'settings' ? ' is-active' : ''}`} title="Cài đặt" aria-label="Cài đặt" aria-current={view === 'settings' ? 'page' : undefined} onClick={onSettings}>
          <Icon name="settings" size={20} />
        </button>
      </div>
    </nav>
  );
}
