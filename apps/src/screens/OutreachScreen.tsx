// Tìm người & nhắn: collect users from Khám phá or a chat room with one or more
// signed-in accounts, see who found whom and who was already messaged (SQLite
// log), and open a 1-1 chat with any of them from a chosen account. Every
// message is typed or inserted from a template and sent by hand, one at a time.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadRoomMembers, normalizeUser, type ChatUser } from '@ola/core/chat.ts';
import type { ExploreNext, ExploreResult } from '@ola/core/endpoints/_explore.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Icon } from '../components/Icon.tsx';
import { exportFileName } from '../lib/accountsTransfer.ts';
import { lastSeenLabel, shortTime } from '../lib/format.ts';
import { saveExportFile } from '../lib/platform.ts';
import { PROVINCES, provinceName } from '../lib/provinces.ts';
import { onSentLogged, recentSent, sentContacts, type Contact, type SentRow } from '../lib/sentLog.ts';
import { AccountProvider, useSession } from '../lib/session.tsx';
import { ENDPOINT, GENDERS, TABS, type Gender, type Tab } from './ExploreScreen.tsx';
import { DirectChat } from './MessagesScreen.tsx';

type Source = 'explore' | 'room';

interface Found {
  user: ChatUser;
  /** Accounts whose list contained this user. */
  by: { id: string; label: string }[];
  /** Where it was found first, e.g. "Khám phá · Online · Nữ · Hà Nội". */
  via: string;
}

const MAX_PAGES = 50;
/** Pause between page requests so collecting stays gentle on the server. */
const PAGE_PAUSE_MS = 400;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function OutreachScreen({ hidden }: { hidden: boolean }) {
  const { accounts, live } = useSession();
  const online = useMemo(() => accounts.filter(a => live[a.id]?.status === 'ready'), [accounts, live]);
  const label = useCallback((id: string) => {
    const a = accounts.find(x => x.id === id);
    return a ? a.label || live[id]?.me?.displayName || a.email : 'nick đã xoá';
  }, [accounts, live]);

  // ---- collecting
  const [source, setSource] = useState<Source>('explore');
  const [tab, setTab] = useState<Tab>('online');
  const [gender, setGender] = useState<Gender>('all');
  const [city, setCity] = useState('all');
  const [room, setRoom] = useState('79');
  const [pages, setPages] = useState(3);
  const [fetchWith, setFetchWith] = useState<string[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ text: string; tone: string } | null>(null);
  const cancel = useRef(false);

  // Accounts that went offline cannot collect.
  const chosen = fetchWith.filter(id => online.some(a => a.id === id));
  useEffect(() => {
    if (!chosen.length && online[0]) setFetchWith([online[0].id]);
  }, [online, chosen.length]);

  const via = source === 'explore'
    ? ['Khám phá', TABS.find(t => t.id === tab)!.label,
      gender !== 'all' && GENDERS.find(g => g.value === gender)!.label,
      city !== 'all' && provinceName(city)].filter(Boolean).join(' · ')
    : `Phòng ${provinceName(room)}`;

  // The list also lives in a ref: merge() counts new users synchronously, which a
  // setState updater cannot do (StrictMode runs updaters twice, React may run them later).
  const foundRef = useRef<Found[]>([]);
  const setList = (next: Found[]) => { foundRef.current = next; setFound(next); };

  const merge = (users: ChatUser[], by: { id: string; label: string }, where: string) => {
    let added = 0;
    const next = [...foundRef.current];
    const index = new Map(next.map((f, i) => [f.user.uid, i]));
    for (const user of users) {
      const i = index.get(user.uid);
      if (i === undefined) {
        index.set(user.uid, next.length);
        next.push({ user, by: [by], via: where });
        added++;
      } else if (!next[i]!.by.some(b => b.id === by.id)) {
        next[i] = { ...next[i]!, by: [...next[i]!.by, by] };
      }
    }
    setList(next);
    return added;
  };

  const collect = async () => {
    cancel.current = false;
    setRunning(true);
    // Each Lấy starts a fresh list; several nicks in the same run still merge into it.
    setList([]);
    const where = via;
    let total = 0;
    let failed = '';
    try {
      for (const id of chosen) {
        const ola = live[id]?.ola;
        if (!ola) continue;
        const by = { id, label: label(id) };
        let next: ExploreNext | null = null;
        for (let page = 0; page < pages && !cancel.current; page++) {
          setProgress({ text: `Đang lấy trang ${page + 1}/${pages} bằng ${by.label}… (${total} người)`, tone: 'idle' });
          let users: ChatUser[];
          try {
            if (source === 'explore') {
              const input = page === 0
                ? { page: 0, ...(gender !== 'all' && { gender }), ...(city !== 'all' && { cityID: city }) }
                : next!;
              const result: ExploreResult = await ola.call(ENDPOINT[tab], input);
              users = result.items.map(item => normalizeUser(item)).filter(u => u.uid);
              next = result.next;
            } else {
              users = (await loadRoomMembers(ola, room, page)).filter(u => u.uid);
            }
          } catch (e) {
            failed = `${by.label}: ${(e as Error).message}`;
            break;
          }
          total += merge(users, by, where);
          if (!users.length || (source === 'explore' && !next)) break;
          await sleep(PAGE_PAUSE_MS);
        }
        if (cancel.current) break;
      }
      setProgress(cancel.current
        ? { text: `Đã dừng. Lấy được ${total} người.`, tone: 'warn' }
        : failed
          ? { text: `Lấy được ${total} người; lỗi ${failed}`, tone: 'bad' }
          : { text: `Xong: lấy được ${total} người.`, tone: 'ok' });
    } finally {
      setRunning(false);
    }
  };

  // ---- who was already messaged (SQLite)
  const [contacts, setContacts] = useState<Map<string, Contact[]>>(new Map());
  const [recent, setRecent] = useState<SentRow[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const reloadLog = useCallback(() => {
    Promise.all([sentContacts(), recentSent(30)])
      .then(([list, rows]) => {
        const map = new Map<string, Contact[]>();
        for (const c of list) map.set(c.peerUid, [...(map.get(c.peerUid) ?? []), c]);
        setContacts(map);
        setRecent(rows);
        setLogError(null);
      })
      .catch(e => setLogError(String((e as Error).message ?? e)));
  }, []);
  useEffect(() => { reloadLog(); return onSentLogged(reloadLog); }, [reloadLog]);

  // ---- list
  const [query, setQuery] = useState('');
  const [hideContacted, setHideContacted] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return found.filter(f => (!hideContacted || !contacts.has(f.user.uid))
      && (!q || f.user.displayName.toLowerCase().includes(q) || f.user.uid.toLowerCase().includes(q)
        || provinceName(f.user.state).toLowerCase().includes(q)));
  }, [found, query, hideContacted, contacts]);

  const exportList = async (ext: 'json' | 'csv') => {
    const rows = shown.map(f => ({
      uid: f.user.uid, displayName: f.user.displayName, photoURL: f.user.photoURL,
      province: f.user.state ? provinceName(f.user.state) : '', isVip: f.user.isVip, verified: f.user.verified,
      level: f.user.level, lastSeen: f.user.lastSeen || '', foundBy: f.by.map(b => b.label).join(', '), via: f.via,
      messagedBy: (contacts.get(f.user.uid) ?? []).map(c => `${c.accountLabel} (${c.count})`).join(', '),
    }));
    const content = ext === 'json'
      ? `${JSON.stringify({ format: 'ola-desktop-users', exportedAt: new Date().toISOString(), users: rows }, null, 2)}\n`
      : toCsv(rows);
    try {
      const path = await saveExportFile(exportFileName(new Date(), 'ola-users', ext), content);
      setProgress({ text: `Đã xuất ${rows.length} người: ${path ?? 'đã tải file về'}`, tone: 'ok' });
    } catch (e) {
      setProgress({ text: `Không xuất được: ${(e as Error).message ?? e}`, tone: 'bad' });
    }
  };

  // ---- chat
  const [selected, setSelected] = useState<Found | null>(null);
  const [sendWith, setSendWith] = useState('');
  const select = (f: Found) => {
    setSelected(f);
    const keep = online.some(a => a.id === sendWith);
    if (!keep) setSendWith(f.by.find(b => online.some(a => a.id === b.id))?.id ?? online[0]?.id ?? '');
  };
  const sender = online.some(a => a.id === sendWith) ? sendWith : '';

  return (
    <div className="screen screen-split outreach" hidden={hidden}>
      <section className="outreach-side" aria-label="Lấy danh sách người dùng">
        <div className="outreach-collect">
          <div className="list-title-row">
            <h1>Tìm người &amp; nhắn</h1>
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => setSelected(null)} title="Tin nhắn mẫu và lịch sử đã gửi" aria-label="Tin nhắn mẫu và lịch sử đã gửi">
              <Icon name="template" size={16} />
            </button>
          </div>
          <div className="outreach-line">
            <div className="tabs tabs-sm" role="tablist" aria-label="Nguồn">
              {(['explore', 'room'] as const).map(s => (
                <button key={s} type="button" role="tab" aria-selected={source === s} className={`tab${source === s ? ' is-active' : ''}`} onClick={() => setSource(s)}>
                  {s === 'explore' ? 'Khám phá' : 'Phòng chat'}
                </button>
              ))}
            </div>
            <label className="pages-input" title="Số trang mỗi nick lấy (1–50)">
              <input type="number" min={1} max={MAX_PAGES} value={pages} aria-label="Số trang mỗi nick"
                onChange={e => setPages(Math.max(1, Math.min(MAX_PAGES, Math.floor(Number(e.target.value) || 1))))} />
              <span className="small muted">trang</span>
            </label>
          </div>
          <div className="outreach-line">
            {source === 'explore' ? (
              <>
                <select aria-label="Tab Khám phá" value={tab} onChange={e => setTab(e.target.value as Tab)}>
                  {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <select aria-label="Giới tính" value={String(gender)} onChange={e => setGender(e.target.value === 'all' ? 'all' : Number(e.target.value) as Gender)}>
                  {GENDERS.map(g => <option key={String(g.value)} value={String(g.value)}>{g.value === 'all' ? 'Mọi giới tính' : g.label}</option>)}
                </select>
                <select aria-label="Tỉnh" value={city} onChange={e => setCity(e.target.value)}>
                  <option value="all">Mọi tỉnh</option>
                  {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </>
            ) : (
              <select aria-label="Phòng" value={room} onChange={e => setRoom(e.target.value)}>
                {PROVINCES.map(p => <option key={p.code} value={p.code}>Phòng {p.name}</option>)}
              </select>
            )}
          </div>
          <div className="outreach-line" role="group" aria-label="Lấy bằng nick">
            {online.length ? online.map(a => {
              const on = chosen.includes(a.id);
              return (
                <button key={a.id} type="button" className={`nick-chip${on ? ' is-on' : ''}`} aria-pressed={on} title={on ? 'Bỏ chọn nick này' : 'Lấy bằng nick này'}
                  onClick={() => setFetchWith(ids => (on ? ids.filter(x => x !== a.id) : [...ids, a.id]))}>
                  {label(a.id)}
                </button>
              );
            }) : <span className="small tone-warn">Đăng nhập ít nhất một nick để lấy danh sách.</span>}
          </div>
          <div className="outreach-line">
            {running ? (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => { cancel.current = true; }}><Icon name="stop" size={14} /> Dừng</button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" disabled={!chosen.length} onClick={() => void collect()}><Icon name="download" size={14} /> Lấy</button>
            )}
            {progress && <span className={`small ellipsis grow tone-${progress.tone}`} role="status" title={progress.text}>{progress.text}</span>}
          </div>
        </div>

        <div className="outreach-toolbar">
          <div className="search search-sm">
            <Icon name="search" size={15} />
            <input type="search" placeholder={`Lọc ${shown.length}/${found.length} người`} aria-label="Lọc theo tên, UID, tỉnh" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <button type="button" className={`nick-chip${hideContacted ? ' is-on' : ''}`} aria-pressed={hideContacted} title="Ẩn người đã được nhắn từ bất kỳ nick nào (lịch sử SQLite)" onClick={() => setHideContacted(v => !v)}>Ẩn đã nhắn</button>
          <button type="button" className="icon-btn icon-btn-sm" disabled={!shown.length} title="Xuất CSV (mở bằng Excel)" aria-label="Xuất CSV" onClick={() => void exportList('csv')}>CSV</button>
          <button type="button" className="icon-btn icon-btn-sm" disabled={!shown.length} title="Xuất JSON" aria-label="Xuất JSON" onClick={() => void exportList('json')}>JSON</button>
          <button type="button" className="icon-btn icon-btn-sm" disabled={!found.length || running} title="Xoá danh sách đã lấy" aria-label="Xoá danh sách" onClick={() => { setList([]); setSelected(null); setProgress(null); }}><Icon name="trash" size={15} /></button>
        </div>
        <ul className="conv-list">
          {shown.map(f => {
            const sent = contacts.get(f.user.uid) ?? [];
            const name = f.user.displayName || `${f.user.uid.slice(0, 10)}…`;
            const meta = [f.user.state && provinceName(f.user.state), f.user.lastSeen ? lastSeenLabel(f.user.lastSeen) : '', `từ ${f.by.map(b => b.label).join(', ')}`];
            return (
              <li key={f.user.uid}>
                <button type="button" className={`conv-row outreach-row${selected?.user.uid === f.user.uid ? ' is-active' : ''}`} onClick={() => select(f)} title={`${f.via}${f.user.level ? ` · cấp ${f.user.level}` : ''}`}>
                  <Avatar name={name} photo={f.user.photoURL} seed={f.user.uid} size={34} ring="var(--surface)" />
                  <span className="conv-text">
                    <span className="conv-name">{name}{f.user.isVip && <span className="vip-tag">VIP</span>}{f.user.verified && <Icon name="badgeCheck" size={13} />}</span>
                    <span className="small muted ellipsis">{meta.filter(Boolean).join(' · ')}</span>
                  </span>
                  {sent.length > 0 && (
                    <span className="sent-mark" title={`Đã nhắn: ${sent.map(c => `${c.accountLabel} (${c.count} tin, ${shortTime(c.lastSentAt)})`).join(', ')}`}>
                      ✓{sent.reduce((n, c) => n + c.count, 0)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {!found.length && <li className="empty-list muted small">Chọn nguồn và nick rồi bấm Lấy.</li>}
          {found.length > 0 && !shown.length && <li className="empty-list muted small">Không có ai khớp bộ lọc.</li>}
        </ul>
      </section>

      {selected && sender ? (
        <AccountProvider id={sender}>
          <DirectChat
            key={`${sender}:${selected.user.uid}`}
            target={{ uid: selected.user.uid, name: selected.user.displayName, photo: selected.user.photoURL }}
            source="outreach"
            actions={(
              <label className="chip outreach-sender" title="Nick dùng để nhắn người này">
                Nhắn bằng
                <select value={sender} onChange={e => setSendWith(e.target.value)} aria-label="Nick dùng để nhắn">
                  {online.map(a => <option key={a.id} value={a.id}>{label(a.id)}{selected.by.some(b => b.id === a.id) ? '' : ' (không tìm thấy người này)'}</option>)}
                </select>
              </label>
            )}
          />
        </AccountProvider>
      ) : selected ? (
        <main className="chat-panel chat-placeholder">
          <Icon name="user" size={32} />
          <p>Cần ít nhất một nick đang online để nhắn {selected.user.displayName || selected.user.uid}.</p>
        </main>
      ) : (
        <main className="chat-panel outreach-side-panels">
          <TemplatesPanel />
          <section className="panel" aria-label="Đã gửi gần đây">
            <h2 className="panel-title">Đã gửi gần đây</h2>
            <p className="muted small">Mọi tin 1-1 đã gửi, lưu trong SQLite <code>messages.db</code>.</p>
            {logError && <p className="notice notice-bad small">Không đọc được lịch sử: {logError}</p>}
            {recent.length ? (
              <ul className="sent-list">
                {recent.map(r => (
                  <li key={r.id}>
                    <span className="small muted">{shortTime(r.sentAt)} · {r.accountLabel} → {r.peerName || r.peerUid.slice(0, 10)}</span>
                    <span className="ellipsis">{r.text}</span>
                    {(r.dryRun || r.error) && <span className={`small ${r.error ? 'tone-warn' : 'muted'}`}>{r.dryRun ? 'Chế độ thử (chưa gửi)' : r.error}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">Chưa gửi tin nào.</p>}
          </section>
        </main>
      )}
    </div>
  );
}

/** Tin nhắn mẫu (settings.json): the composer's Mẫu button inserts them; sending stays manual. */
function TemplatesPanel() {
  const { settings, saveSettings } = useSession();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const templates = settings.messageTemplates;

  const save = async (next: string[]) => {
    try {
      await saveSettings({ ...settings, messageTemplates: next });
      setError(null);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    await save(editing === null ? [...templates, text] : templates.map((t, i) => (i === editing ? text : t)));
    setDraft('');
    setEditing(null);
  };

  return (
    <section className="panel" aria-label="Tin nhắn mẫu">
      <h2 className="panel-title">Tin nhắn mẫu</h2>
      <p className="muted small">Nút <Icon name="template" size={13} /> trong ô chat chèn mẫu; bạn tự bấm Gửi.</p>
      {templates.length ? (
        <ul className="template-list">
          {templates.map((t, i) => (
            <li key={i}>
              <span className="template-text">{t}</span>
              <button type="button" className="icon-btn" aria-label="Sửa mẫu" onClick={() => { setEditing(i); setDraft(t); }}><Icon name="pencil" size={15} /></button>
              <button type="button" className="icon-btn" aria-label="Xoá mẫu" onClick={() => void save(templates.filter((_, j) => j !== i))}><Icon name="trash" size={15} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="small muted">Chưa có mẫu nào.</p>}
      <textarea className="transfer-text template-input" rows={2} maxLength={4000} placeholder="Nội dung mẫu mới" value={draft} onChange={e => setDraft(e.target.value)} />
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={!draft.trim()} onClick={() => void submit()}>{editing === null ? 'Thêm mẫu' : 'Lưu mẫu'}</button>
        {editing !== null && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setDraft(''); }}>Huỷ</button>}
      </div>
      {error && <p className="notice notice-bad small" role="alert">{error}</p>}
    </section>
  );
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    // Names come from strangers: a leading = + - @ would run as an Excel formula.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens Vietnamese text as UTF-8.
  return `\uFEFF${[headers.join(','), ...rows.map(r => headers.map(h => cell(r[h])).join(','))].join('\r\n')}\r\n`;
}
