import { useCallback, useState } from 'react';
import { Icon } from './components/Icon.tsx';
import { Sidebar, type Screen } from './components/Sidebar.tsx';
import { useSession } from './lib/session.tsx';
import { AccountsScreen } from './screens/AccountsScreen.tsx';
import { ExploreScreen } from './screens/ExploreScreen.tsx';
import { MessagesScreen, type PeerTarget } from './screens/MessagesScreen.tsx';
import { RoomsScreen } from './screens/RoomsScreen.tsx';

export function App() {
  const session = useSession();
  const [screen, setScreen] = useState<Screen>('messages');
  const [target, setTarget] = useState<PeerTarget | null>(null);
  const [unread, setUnread] = useState(0);

  const messagePeer = useCallback((peer: PeerTarget) => {
    setTarget(peer);
    setScreen('messages');
  }, []);
  const clearTarget = useCallback(() => setTarget(null), []);

  if (!session.loaded) {
    return <div className="splash"><span className="muted">Đang mở Ola Desktop…</span></div>;
  }

  const needsAccount = screen !== 'accounts' && !session.accounts.length;
  const ready = session.status === 'ready' && session.ola && session.me;

  return (
    <div className="app">
      <Sidebar screen={needsAccount ? 'accounts' : screen} onNavigate={setScreen} unread={unread} />
      <div className="content">
        {needsAccount || screen === 'accounts' ? <AccountsScreen /> : !ready ? <SessionGate onManage={() => setScreen('accounts')} /> : (
          <>
            {/* Messages stays mounted so unread counts and the open chat survive tab switches. */}
            <MessagesScreen
              key={session.me!.uid}
              hidden={screen !== 'messages'}
              target={target}
              onTargetOpened={clearTarget}
              onUnreadChange={setUnread}
            />
            {screen === 'explore' && <ExploreScreen key={session.me!.uid} onMessage={messagePeer} />}
            {screen === 'rooms' && <RoomsScreen key={session.me!.uid} onMessage={messagePeer} />}
          </>
        )}
      </div>
    </div>
  );
}

function SessionGate({ onManage }: { onManage: () => void }) {
  const { status, error, activeId, accounts, switchAccount } = useSession();
  const account = accounts.find(a => a.id === activeId);
  return (
    <main className="gate">
      {status === 'signing-in' && (
        <>
          <span className="spinner" aria-hidden="true" />
          <p>Đang đăng nhập {account?.label || account?.email}…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <Icon name="info" size={28} />
          <p className="strong">Không đăng nhập được {account?.label || account?.email}</p>
          <p className="muted">{error}</p>
          <div className="form-actions">
            {activeId && <button type="button" className="btn btn-primary" onClick={() => void switchAccount(activeId)}>Thử lại</button>}
            <button type="button" className="btn btn-ghost" onClick={onManage}>Quản lý tài khoản</button>
          </div>
        </>
      )}
      {status === 'signed-out' && (
        <>
          <Icon name="user" size={28} />
          <p>Chọn một tài khoản ở thanh bên để bắt đầu.</p>
          <button type="button" className="btn btn-ghost" onClick={onManage}>Quản lý tài khoản</button>
        </>
      )}
    </main>
  );
}
