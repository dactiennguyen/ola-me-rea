import { useCallback, useEffect, useState } from 'react';
import { AccountRail, type AppView } from './components/AccountRail.tsx';
import { CloseDialog } from './components/CloseDialog.tsx';
import { onCloseAsked, setCloseAction } from './lib/platform.ts';
import { AccountProvider, useSession } from './lib/session.tsx';
import { AccountsScreen, type AccountsPanel, type AccountsRequest } from './screens/AccountsScreen.tsx';
import { AccountView } from './screens/AccountView.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';

export function App() {
  const session = useSession();
  const { accounts, selectedId, select } = session;
  const [view, setView] = useState<AppView>('account');
  const [unread, setUnread] = useState<Record<string, number>>({});

  const onUnread = useCallback((id: string, count: number) => {
    setUnread(all => (all[id] === count ? all : { ...all, [id]: count }));
  }, []);

  // Quản lý tài khoản, opened on a panel (add / register / import-export / edit one account).
  const [accountsRequest, setAccountsRequest] = useState<AccountsRequest | null>(null);
  const openAccounts = useCallback((panel: AccountsPanel, id?: string) => {
    setView('accounts');
    setAccountsRequest(prev => ({ panel, id, n: (prev?.n ?? 0) + 1 }));
  }, []);
  const editAccount = useCallback((id: string) => openAccounts('edit', id), [openAccounts]);
  const showAccount = useCallback((id: string) => {
    void select(id);
    setView('account');
  }, [select]);

  // The close button (src-tauri/src/tray.rs): Rust quits until it hears the setting.
  const [closeAsked, setCloseAsked] = useState(false);
  const closeDialogDone = useCallback(() => setCloseAsked(false), []);
  const onClose = session.settings.onClose;
  useEffect(() => {
    if (session.loaded) void setCloseAction(onClose).catch(() => {});
  }, [session.loaded, onClose]);
  useEffect(() => {
    const unlisten = onCloseAsked(() => setCloseAsked(true));
    return () => { void unlisten.then(stop => stop()); };
  }, []);

  if (!session.loaded) {
    return <div className="splash"><span className="muted">Đang mở Ola Desktop…</span></div>;
  }

  // No account to show yet: the account manager stands in for it.
  const current = view === 'account' && !accounts.some(a => a.id === selectedId) ? 'accounts' : view;

  return (
    <div className="app">
      <AccountRail
        view={current}
        unread={unread}
        onAccount={showAccount}
        onAdd={() => openAccounts('add')}
        onManage={() => setView('accounts')}
        onSettings={() => setView('settings')}
      />
      {accounts.map(account => (
        <AccountProvider key={account.id} id={account.id}>
          <AccountView hidden={!(current === 'account' && account.id === selectedId)} onUnread={onUnread} onEdit={editAccount} />
        </AccountProvider>
      ))}
      {current === 'accounts' && (
        <div className="content content-page"><AccountsScreen request={accountsRequest} onOpen={showAccount} /></div>
      )}
      {current === 'settings' && <div className="content content-page"><SettingsScreen /></div>}
      {closeAsked && <CloseDialog onDone={closeDialogDone} />}
    </div>
  );
}
