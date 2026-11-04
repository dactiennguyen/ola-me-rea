import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeUser, type ChatUser } from '@ola/core/chat.ts';
import type { ExploreNext } from '@ola/core/endpoints/_explore.ts';
import { getExplore3 } from '@ola/core/endpoints/getExplore3.ts';
import { getExploreAvatarV4 } from '@ola/core/endpoints/getExploreAvatarV4.ts';
import { getExploreOnlineV6 } from '@ola/core/endpoints/getExploreOnlineV6.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Icon } from '../components/Icon.tsx';
import { lastSeenLabel } from '../lib/format.ts';
import { PROVINCES, provinceName } from '../lib/provinces.ts';
import { useOla } from '../lib/session.tsx';
import type { PeerTarget } from './MessagesScreen.tsx';

export type Tab = 'online' | 'verified' | 'avatar';
export type Gender = 'all' | 0 | 1 | 2;

export const TABS: { id: Tab; label: string }[] = [
  { id: 'online', label: 'Online' },
  { id: 'verified', label: 'Đã xác thực' },
  { id: 'avatar', label: 'Ảnh có mặt' },
];

// The three tabs are built by the same defineExplore(), so they share one type.
export const ENDPOINT: Record<Tab, typeof getExploreOnlineV6> = {
  online: getExploreOnlineV6, verified: getExplore3, avatar: getExploreAvatarV4,
};

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'all', label: 'Tất cả' }, { value: 0, label: 'Nữ' }, { value: 1, label: 'Nam' }, { value: 2, label: 'LGBT' },
];


export function ExploreScreen({ onMessage }: { onMessage: (peer: PeerTarget) => void }) {
  const { ola } = useOla();
  const [tab, setTab] = useState<Tab>('online');
  const [gender, setGender] = useState<Gender>('all');
  const [city, setCity] = useState('all');
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [next, setNext] = useState<ExploreNext | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const generation = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (reset: boolean) => {
    if (loadingRef.current && !reset) return;
    const gen = reset ? ++generation.current : generation.current;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const input = reset || !next
        ? { page: 0, ...(gender !== 'all' && { gender }), ...(city !== 'all' && { cityID: city }) }
        : next;
      const result = await ola.call(ENDPOINT[tab], input);
      if (gen !== generation.current) return;
      const page = result.items.map(item => normalizeUser(item)).filter(u => u.uid);
      setUsers(prev => {
        const base = reset ? [] : prev;
        const seen = new Set(base.map(u => u.uid));
        return [...base, ...page.filter(u => !seen.has(u.uid))];
      });
      setNext(result.next);
      setDone(!result.next);
    } catch (e) {
      if (gen === generation.current) setError((e as Error).message);
    } finally {
      if (gen === generation.current) { loadingRef.current = false; setLoading(false); }
    }
  }, [ola, tab, gender, city, next]);

  // New tab or filter: start over.
  useEffect(() => {
    setUsers([]);
    setNext(null);
    setDone(false);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, gender, city, ola]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !done && !loadingRef.current && users.length) void load(false);
    }, { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [load, done, users.length]);

  return (
    <div className="screen screen-scroll">
      <header className="page-head">
        <div>
          <h1>Khám phá</h1>
          <p className="muted small">{users.length ? `${users.length} người` : 'Tìm người để làm quen và nhắn tin'}</p>
        </div>
        <div className="tabs" role="tablist" aria-label="Danh sách">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="filters">
        <div className="segmented" role="group" aria-label="Giới tính">
          {GENDERS.map(g => (
            <button key={String(g.value)} type="button" aria-pressed={gender === g.value} className={gender === g.value ? 'is-active' : ''} onClick={() => setGender(g.value)}>
              {g.label}
            </button>
          ))}
        </div>
        <label className="field-inline">
          <span className="muted small">Tỉnh/thành</span>
          <select value={city} onChange={e => setCity(e.target.value)}>
            <option value="all">Tất cả</option>
            {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load(true)} disabled={loading}>
          <Icon name="refresh" size={16} /> Làm mới
        </button>
      </div>

      {error && <p className="notice notice-bad">Không tải được danh sách: {error}</p>}

      <div className="card-grid">
        {loading && !users.length && !error && Array.from({ length: 8 }, (_, i) => <UserCardSkeleton key={`sk-${i}`} />)}
        {users.map(u => (
          <article key={u.uid} className="user-card">
            <Avatar name={u.displayName || u.uid} photo={u.photoURL} seed={u.uid} size={64} online={tab === 'online'} ring="var(--surface)" />
            <div className="user-card-body">
              <h3 className="user-name">
                <span className="truncate">{u.displayName || 'Chưa đặt tên'}</span>
                {u.verified && <span className="verified" title="Ảnh đại diện đã xác thực"><Icon name="badgeCheck" size={15} label="Đã xác thực" /></span>}
              </h3>
              <p className="user-meta small">
                {u.isVip && <span className="vip-tag">VIP</span>}
                {u.isNew && <span className="new-tag">Mới</span>}
                {u.level > 0 && <span>Cấp {u.level}</span>}
                {u.state && <span>{provinceName(u.state)}</span>}
              </p>
              {u.lastSeen > 0 && <p className="muted small">{lastSeenLabel(u.lastSeen)}</p>}
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onMessage({ uid: u.uid, name: u.displayName, photo: u.photoURL })}>
              <Icon name="message" size={15} /> Nhắn tin
            </button>
          </article>
        ))}
      </div>

      <div ref={sentinel} className="load-more">
        {loading && users.length > 0 && <span className="muted small">Đang tải…</span>}
        {!loading && done && users.length > 0 && <span className="muted small">Đã hết danh sách.</span>}
        {!loading && !done && users.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load(false)}>Tải thêm</button>
        )}
        {!loading && !error && done && !users.length && <span className="muted small">Không có ai khớp bộ lọc.</span>}
      </div>
    </div>
  );
}

/** Placeholder card shown while the first page of Khám phá loads. */
function UserCardSkeleton() {
  return (
    <article className="user-card user-card-skeleton" aria-hidden="true">
      <div className="skeleton sk-avatar" />
      <div className="user-card-body">
        <div className="skeleton sk-line sk-line-lg" />
        <div className="skeleton sk-line sk-line-sm" />
      </div>
      <div className="skeleton sk-btn" />
    </article>
  );
}
