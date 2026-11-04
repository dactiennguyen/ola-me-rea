import { useState, type ReactNode } from 'react';
import { liveText, liveTone } from '../components/AccountRail.tsx';
import { REALTIME } from '../components/Sidebar.tsx';
import { Avatar } from '../components/Avatar.tsx';
import { Icon } from '../components/Icon.tsx';
import { deviceValue } from '../lib/accounts.ts';
import { proxyLabel } from '../lib/proxy.ts';
import { shortTime } from '../lib/format.ts';
import { useAccount, useSession } from '../lib/session.tsx';

/** Thông tin tài khoản: who this account is on Ola, its device and its connection. */
export function ProfileScreen({ onEdit }: { onEdit: () => void }) {
  const { account, state } = useAccount();
  const { connect, disconnect } = useSession();
  const [copied, setCopied] = useState(false);
  const me = state.me;
  const uid = me?.uid || account.uid;
  const name = me?.displayName || account.displayName || account.label || account.email;

  const copyUid = async () => {
    if (!uid) return;
    await navigator.clipboard.writeText(uid).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const rows: [string, ReactNode][] = [
    ['Tên trên Ola', me?.displayName || account.displayName || '—'],
    ['Tên trong app', account.label || '—'],
    ['Email', account.email],
    ['UID', uid ? (
      <span className="profile-uid">
        <code className="break">{uid}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyUid()}>{copied ? 'Đã chép' : 'Sao chép'}</button>
      </span>
    ) : 'Chưa biết (chưa đăng nhập lần nào)'],
    ['Trạng thái', <span className={`tone-${liveTone(state)}`}>{liveText(account, state)}</span>],
    ['Realtime', state.status === 'ready' ? REALTIME[state.realtime].text : '—'],
    ['Đăng nhập lần cuối', account.lastLoginAt ? shortTime(account.lastLoginAt) : '—'],
    ['Device ID', <code>{account.deviceId}</code>],
    ['App version', deviceValue(account, 'appVersion')],
    ['Android version', deviceValue(account, 'androidVersion')],
    ['Key2', account.publicKey ? 'Riêng cho nick này' : 'Mặc định của APK'],
    ['Proxy', account.proxy ? proxyLabel(account.proxy) : 'Không dùng'],
  ];

  return (
    <div className="screen screen-scroll">
      <header className="page-head">
        <div>
          <h1>Thông tin tài khoản</h1>
          <p className="muted small">Thông tin của nick này. Mỗi nick đăng nhập và nhận tin riêng.</p>
        </div>
        <div className="form-actions">
          {state.status === 'ready' || state.status === 'signing-in' ? (
            <button type="button" className="btn btn-ghost" onClick={() => void disconnect(account.id)}>
              <Icon name="logOut" size={16} /> Đăng xuất nick này
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void connect(account.id)}>
              <Icon name="logIn" size={16} /> Đăng nhập
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onEdit}><Icon name="pencil" size={16} /> Sửa</button>
        </div>
      </header>

      <section className="panel profile-card">
        <div className="profile-head">
          <Avatar name={name} photo={me?.photoURL || account.photoURL} color={account.color} size={64} />
          <div>
            <h2 className="panel-title">{name}{me?.isVip && <span className="vip-tag">VIP</span>}</h2>
            <p className="muted small">{account.email}</p>
          </div>
        </div>
        {state.status === 'error' && <p className="notice notice-bad small">{state.error}</p>}
        <dl className="profile-grid">
          {rows.map(([label, value]) => (
            <div key={label} className="profile-row">
              <dt className="muted small">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
