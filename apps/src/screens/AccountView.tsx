import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Icon.tsx';
import { Sidebar, type Screen } from '../components/Sidebar.tsx';
import { shortTime } from '../lib/format.ts';
import { useAccount, useSession } from '../lib/session.tsx';
import { BlogScreen } from './BlogScreen.tsx';
import { ExploreScreen } from './ExploreScreen.tsx';
import { MessagesScreen, type PeerTarget } from './MessagesScreen.tsx';
import { ProfileScreen } from './ProfileScreen.tsx';
import { RoomsScreen } from './RoomsScreen.tsx';

/**
 * Everything of one account: its sidebar and screens. Every account has one,
 * mounted for as long as the app runs (hidden when another account is on
 * screen), so each keeps its open chat, tab and unread count.
 */
export function AccountView({ hidden, onUnread, onEdit }: {
  hidden: boolean;
  onUnread: (id: string, count: number) => void;
  onEdit: (id: string) => void;
}) {
  const { account, state } = useAccount();
  const [screen, setScreen] = useState<Screen>('messages');
  const [target, setTarget] = useState<PeerTarget | null>(null);
  const [unread, setUnread] = useState(0);
  // Blog mounts on first visit, then stays (hidden) so the feed and open comments survive tab switches.
  const [blogOpened, setBlogOpened] = useState(false);
  useEffect(() => { if (screen === 'blog') setBlogOpened(true); }, [screen]);
  const me = state.status === 'ready' ? state.me : null;

  useEffect(() => { onUnread(account.id, me ? unread : 0); }, [onUnread, account.id, me, unread]);

  const messagePeer = useCallback((peer: PeerTarget) => {
    setTarget(peer);
    setScreen('messages');
  }, []);
  const clearTarget = useCallback(() => setTarget(null), []);
  const edit = useCallback(() => onEdit(account.id), [onEdit, account.id]);

  return (
    <div className="account-view" hidden={hidden}>
      <Sidebar screen={screen} onNavigate={setScreen} unread={me ? unread : 0} />
      <div className="content">
        {screen === 'profile' && <ProfileScreen onEdit={edit} />}
        {me ? (
          <>
            {/* Messages stays mounted so unread counts and the open chat survive tab switches. */}
            <MessagesScreen
              key={me.uid}
              hidden={screen !== 'messages'}
              target={target}
              onTargetOpened={clearTarget}
              onUnreadChange={setUnread}
            />
            {screen === 'explore' && <ExploreScreen key={me.uid} onMessage={messagePeer} />}
            {screen === 'rooms' && <RoomsScreen key={me.uid} onMessage={messagePeer} />}
            {blogOpened && <BlogScreen key={me.uid} hidden={screen !== 'blog'} onMessage={messagePeer} />}
          </>
        ) : screen !== 'profile' && <AccountGate onEdit={edit} />}
      </div>
    </div>
  );
}

/** Shown instead of the account's screens while it is not signed in. */
function AccountGate({ onEdit }: { onEdit: () => void }) {
  const { account, state } = useAccount();
  const { connect } = useSession();
  const name = account.label || account.email;
  return (
    <main className="gate">
      {state.status === 'signing-in' && (
        <>
          <span className="spinner" aria-hidden="true" />
          <p>Đang đăng nhập {name}…</p>
        </>
      )}
      {state.status === 'error' && (
        <>
          <Icon name="info" size={28} />
          <p className="strong">Không đăng nhập được {name}</p>
          <p className="muted">{state.error}</p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => void connect(account.id)}>Thử lại</button>
            <button type="button" className="btn btn-ghost" onClick={onEdit}>Sửa tài khoản</button>
          </div>
        </>
      )}
      {state.status === 'signed-out' && (
        <>
          <Icon name="user" size={28} />
          <p className="strong">{name} chưa đăng nhập</p>
          <p className="muted">
            {account.verificationSentAt
              ? `Đã gửi email xác thực ${shortTime(account.verificationSentAt)}. Mở link trong email rồi bấm Đăng nhập.`
              : 'App không tự đăng nhập khi mở. Bấm Đăng nhập để nick này online và nhận tin.'}
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={() => void connect(account.id)}>
              <Icon name="logIn" size={16} /> Đăng nhập
            </button>
            <button type="button" className="btn btn-ghost" onClick={onEdit}>Sửa tài khoản</button>
          </div>
        </>
      )}
    </main>
  );
}
