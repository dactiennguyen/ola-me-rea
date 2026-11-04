// Tìm người & nhắn: collect users from Khám phá or a chat room with one or more
// signed-in accounts, see who found whom and who was already messaged (SQLite
// log), and open a 1-1 chat with any of them from a chosen account. Every
// message is typed or inserted from a template and sent by hand, one at a time.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  directMessagePayload, loadChatUser, loadRoomMembers, normalizeUser, sendDirectMessage,
  type ChatChannel, type ChatProfile, type ChatUser,
} from '@ola/core/chat.ts';
import type { OlaClient } from '@ola/core/client.ts';
import type { ExploreNext, ExploreResult } from '@ola/core/endpoints/_explore.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Icon } from '../components/Icon.tsx';
import { exportFileName } from '../lib/accountsTransfer.ts';
import { lastSeenLabel, shortTime } from '../lib/format.ts';
import { saveExportFile } from '../lib/platform.ts';
import { PROVINCES, provinceName } from '../lib/provinces.ts';
import { logSent, onSentLogged, recentSent, sentContacts, type Contact, type SentRow } from '../lib/sentLog.ts';
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

  // ---- manual chat vs auto send; in auto mode a row toggles whether the person
  // is in the send list (everyone shown is in it until unticked).
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const autoPicked = useMemo(() => shown.filter(f => !excluded.has(f.user.uid)), [shown, excluded]);
  const togglePick = (uid: string) => setExcluded(s => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });
  const pickAll = () => setExcluded(new Set());
  const pickNone = () => setExcluded(new Set(shown.map(f => f.user.uid)));
  const onlineLite = useMemo(() => online.map(a => ({ id: a.id, label: label(a.id) })), [online, label]);

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
            {mode === 'manual' && (
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setSelected(null)} title="Tin nhắn mẫu và lịch sử đã gửi" aria-label="Tin nhắn mẫu và lịch sử đã gửi">
                <Icon name="template" size={16} />
              </button>
            )}
          </div>
          <div className="outreach-line">
            <div className="tabs tabs-sm" role="tablist" aria-label="Chế độ nhắn">
              {(['manual', 'auto'] as const).map(m => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} className={`tab${mode === m ? ' is-active' : ''}`} onClick={() => setMode(m)}>
                  {m === 'manual' ? 'Nhắn tay' : 'Auto gửi'}
                </button>
              ))}
            </div>
            {mode === 'auto' && <span className="small muted">{autoPicked.length} người được chọn</span>}
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
            const picked = mode === 'auto' && !excluded.has(f.user.uid);
            const rowClass = mode === 'auto'
              ? (picked ? '' : ' is-unpicked')
              : (selected?.user.uid === f.user.uid ? ' is-active' : '');
            return (
              <li key={f.user.uid}>
                <button type="button" className={`conv-row outreach-row${rowClass}`}
                  onClick={() => (mode === 'auto' ? togglePick(f.user.uid) : select(f))}
                  aria-pressed={mode === 'auto' ? picked : undefined}
                  title={`${f.via}${f.user.level ? ` · cấp ${f.user.level}` : ''}`}>
                  {mode === 'auto' && <span className={`pick-box${picked ? ' is-on' : ''}`} aria-hidden="true">{picked ? '✓' : ''}</span>}
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

      {mode === 'auto' ? (
        <AutoSendPanel
          recipients={autoPicked.map(f => f.user)}
          shownCount={shown.length}
          contacts={contacts}
          online={onlineLite}
          onSelectAll={pickAll}
          onSelectNone={pickNone}
        />
      ) : selected && sender ? (
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

// ---------------------------------------------------------------------------
// Auto gửi: send to the picked people, one at a time, from the chosen nicks in
// turn, with a delay between each. Every send is recorded in SQLite (sentLog),
// exactly like a hand-sent message, with source "outreach-auto".

const AUTO_SOURCE = 'outreach-auto';

interface Sender { id: string; label: string; ola: OlaClient; me: ChatProfile }

type LogStatus = 'ok' | 'fail' | 'dry';
interface LogItem { id: string; at: number; peerUid: string; peerName: string; nick: string; status: LogStatus; note?: string }

/** Resolves once the channel connects; rejects after a timeout (it keeps retrying until then). */
function connectChannel(channel: ChatChannel, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (channel.connected) { resolve(); return; }
    const off = channel.onState(state => {
      if (state === 'connected') { off(); clearTimeout(timer); resolve(); }
    });
    const timer = setTimeout(() => { off(); reject(new Error('Hết thời gian chờ kết nối realtime.')); }, timeoutMs);
    channel.connect();
  });
}

/** sleep(ms) that returns early as soon as `cancel.current` is set. */
function cancellableSleep(ms: number, cancel: { current: boolean }): Promise<void> {
  return new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      if (cancel.current || Date.now() - start >= ms) resolve();
      else setTimeout(tick, Math.min(150, ms));
    };
    tick();
  });
}

function AutoSendPanel({ recipients, shownCount, contacts, online, onSelectAll, onSelectNone }: {
  recipients: ChatUser[];
  shownCount: number;
  contacts: Map<string, Contact[]>;
  online: { id: string; label: string }[];
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  const { live, settings, openChannel } = useSession();
  const templates = settings.messageTemplates;
  const dryRun = settings.dryRunSends;

  // Sender nicks: all online by default; a nick that goes offline drops out.
  const [senderIds, setSenderIds] = useState<string[]>([]);
  useEffect(() => {
    const ids = online.map(o => o.id);
    setSenderIds(prev => {
      const kept = prev.filter(id => ids.includes(id));
      const next = kept.length ? kept : ids;
      return next.length === prev.length && next.every((v, i) => v === prev[i]) ? prev : next;
    });
  }, [online]);

  // Message: one text for everyone, or a random pick from the chosen templates.
  const [msgMode, setMsgMode] = useState<'single' | 'random'>('single');
  const [single, setSingle] = useState('');
  const [pickedTemplates, setPickedTemplates] = useState<Set<number>>(new Set());
  useEffect(() => { setPickedTemplates(new Set(templates.map((_, i) => i))); }, [templates.length]);
  const pool = useMemo(
    () => templates.filter((_, i) => pickedTemplates.has(i)).map(t => t.trim()).filter(Boolean),
    [templates, pickedTemplates],
  );

  const [delaySec, setDelaySec] = useState(1);
  const [skipContacted, setSkipContacted] = useState(true);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ text: string; tone: string } | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const cancel = useRef(false);
  // Leaving auto mode (switching back to Nhắn tay) stops a run instead of letting it send on in the background.
  useEffect(() => () => { cancel.current = true; }, []);

  const targets = useMemo(
    () => (skipContacted ? recipients.filter(u => !contacts.has(u.uid)) : recipients),
    [recipients, skipContacted, contacts],
  );
  const senders = useMemo(
    () => senderIds.filter(id => live[id]?.status === 'ready' && live[id]?.ola && live[id]?.me),
    [senderIds, live],
  );
  const haveMessage = msgMode === 'single' ? Boolean(single.trim()) : pool.length > 0;
  const reason = !targets.length ? 'Chưa chọn người nhận nào.'
    : !senders.length ? 'Chọn ít nhất một nick đang online để gửi.'
      : !haveMessage ? (msgMode === 'single' ? 'Nhập nội dung tin nhắn.' : 'Chọn ít nhất một mẫu tin.')
        : null;

  const pickMessage = () => (msgMode === 'single'
    ? single.trim()
    : pool[Math.floor(Math.random() * pool.length)] ?? '');

  const sendOne = async (sender: Sender, user: ChatUser, text: string): Promise<{ note?: string }> => {
    const now = Date.now();
    if (dryRun) {
      const payload = directMessagePayload({ from: sender.me, text, now });
      await logSent({
        sentAt: now, accountId: sender.id, accountUid: sender.me.uid, accountLabel: sender.label,
        peerUid: user.uid, peerName: user.displayName, messageId: String(payload.messageID), text,
        source: AUTO_SOURCE, pushOk: null, lastMessageOk: null, error: null, dryRun: true,
      });
      return {};
    }
    const peer = await loadChatUser(sender.ola, user.uid);
    const channel = openChannel(sender.id, peer.uid, sender.me.uid);
    if (!channel) throw new Error('Thiếu socket key (Cài đặt › Nâng cao).');
    try {
      await connectChannel(channel);
      const result = await sendDirectMessage(sender.ola, channel, { from: sender.me, peer, text, now });
      const stepOk = (name: string) => result.steps.find(s => s.name === name)?.ok ?? null;
      const failed = result.steps.filter(s => !s.ok);
      await logSent({
        sentAt: result.message.at, accountId: sender.id, accountUid: sender.me.uid, accountLabel: sender.label,
        peerUid: peer.uid, peerName: peer.displayName || user.displayName, messageId: result.message.id, text: result.message.text,
        source: AUTO_SOURCE, pushOk: stepOk('push'), lastMessageOk: stepOk('lastMessage'),
        error: failed.map(f => `${f.name}: ${f.error ?? 'lỗi'}`).join('; ') || null, dryRun: false,
      });
      return { note: failed.length ? `Đã gửi; lỗi ${failed.map(f => f.name).join(', ')}` : undefined };
    } finally {
      channel.close();
    }
  };

  const run = async () => {
    if (reason) return;
    cancel.current = false;
    setRunning(true);
    setLog([]);
    // Snapshot the senders and targets so a mid-run state change cannot shift them.
    const pool2: Sender[] = senders.map(id => ({
      id, label: online.find(o => o.id === id)?.label ?? id, ola: live[id]!.ola!, me: live[id]!.me!,
    }));
    const list = targets;
    const add = (item: LogItem) => setLog(l => [item, ...l].slice(0, 1000));
    let ok = 0, fail = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        if (cancel.current) break;
        const user = list[i]!;
        const sender = pool2[i % pool2.length]!;
        const text = pickMessage();
        const at = Date.now();
        setProgress({ text: `Đang gửi ${i + 1}/${list.length} · ${sender.label} → ${user.displayName || user.uid.slice(0, 8)}…`, tone: 'idle' });
        try {
          const { note } = await sendOne(sender, user, text);
          ok++;
          add({ id: `${at}-${user.uid}`, at, peerUid: user.uid, peerName: user.displayName, nick: sender.label, status: dryRun ? 'dry' : 'ok', note });
        } catch (e) {
          fail++;
          add({ id: `${at}-${user.uid}`, at, peerUid: user.uid, peerName: user.displayName, nick: sender.label, status: 'fail', note: (e as Error).message });
        }
        if (i < list.length - 1 && !cancel.current) await cancellableSleep(delaySec * 1000, cancel);
      }
      const stopped = cancel.current;
      const done = dryRun ? `đã thử ${ok}` : `gửi ${ok}`;
      const left = list.length - ok - fail;
      setProgress({
        text: `${stopped ? 'Đã dừng. ' : 'Xong. '}${done}, lỗi ${fail}${left > 0 ? `, còn ${left}` : ''}.`,
        tone: fail ? 'bad' : stopped ? 'warn' : 'ok',
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="chat-panel outreach-side-panels autosend" aria-label="Auto gửi">
      <section className="panel">
        <div className="list-title-row">
          <h2 className="panel-title">Auto gửi</h2>
          {dryRun && <span className="chip tone-warn">Chế độ thử</span>}
        </div>

        <div className="autosend-field">
          <div className="autosend-label">Người nhận</div>
          <div className="autosend-row">
            <span><strong>{targets.length}</strong> người sẽ nhận</span>
            <span className="muted small">chọn {recipients.length}/{shownCount} đã lọc</span>
            <span className="grow" />
            <button type="button" className="nick-chip" disabled={running || !shownCount} onClick={onSelectAll}>Chọn tất cả</button>
            <button type="button" className="nick-chip" disabled={running || !shownCount} onClick={onSelectNone}>Bỏ chọn</button>
          </div>
          <label className="checkbox small">
            <input type="checkbox" checked={skipContacted} disabled={running} onChange={e => setSkipContacted(e.target.checked)} />
            Bỏ qua người đã được nhắn (theo lịch sử SQLite)
          </label>
          <p className="muted small">Tích/bỏ tích từng người ở danh sách bên trái, hoặc lọc rồi “Chọn tất cả”.</p>
        </div>

        <div className="autosend-field">
          <div className="autosend-label">Gửi bằng nick{senders.length > 1 ? ' (xoay vòng lần lượt)' : ''}</div>
          <div className="outreach-line">
            {online.length ? online.map(o => {
              const on = senderIds.includes(o.id);
              return (
                <button key={o.id} type="button" className={`nick-chip${on ? ' is-on' : ''}`} aria-pressed={on} disabled={running}
                  onClick={() => setSenderIds(ids => (on ? ids.filter(x => x !== o.id) : [...ids, o.id]))}>
                  {o.label}
                </button>
              );
            }) : <span className="small tone-warn">Chưa có nick nào online. Đăng nhập một nick để gửi.</span>}
          </div>
        </div>

        <div className="autosend-field">
          <div className="autosend-label">Nội dung</div>
          <div className="tabs tabs-sm">
            {(['single', 'random'] as const).map(m => (
              <button key={m} type="button" className={`tab${msgMode === m ? ' is-active' : ''}`} disabled={running} onClick={() => setMsgMode(m)}>
                {m === 'single' ? 'Một nội dung' : 'Ngẫu nhiên từ mẫu'}
              </button>
            ))}
          </div>
          {msgMode === 'single' ? (
            <textarea className="transfer-text" rows={3} maxLength={4000} placeholder="Nội dung gửi cho mọi người" value={single} disabled={running} onChange={e => setSingle(e.target.value)} />
          ) : templates.length ? (
            <>
              <ul className="template-list autosend-templates">
                {templates.map((t, i) => (
                  <li key={i}>
                    <label className="checkbox small">
                      <input type="checkbox" checked={pickedTemplates.has(i)} disabled={running}
                        onChange={e => setPickedTemplates(s => { const n = new Set(s); if (e.target.checked) n.add(i); else n.delete(i); return n; })} />
                      <span className="template-text">{t}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="muted small">Mỗi người nhận một mẫu ngẫu nhiên trong {pool.length} mẫu đã chọn.</p>
            </>
          ) : <p className="small muted">Chưa có mẫu nào. Thêm mẫu ở tab “Nhắn tay”.</p>}
        </div>

        <div className="autosend-field">
          <div className="autosend-label">Giãn cách giữa 2 tin</div>
          <label className="pages-input">
            <input type="number" min={0} step={0.5} value={delaySec} disabled={running} aria-label="Giãn cách mỗi tin (giây)"
              onChange={e => setDelaySec(Math.max(0, Number(e.target.value) || 0))} />
            <span className="small muted">giây/tin</span>
          </label>
        </div>

        <div className="form-actions">
          {running ? (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => { cancel.current = true; }}><Icon name="stop" size={14} /> Dừng</button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(reason)} title={reason ?? ''} onClick={() => void run()}>
              <Icon name="send" size={14} /> {dryRun ? 'Chạy thử' : 'Bắt đầu gửi'}
            </button>
          )}
          {progress && <span className={`small grow ellipsis tone-${progress.tone}`} role="status" title={progress.text}>{progress.text}</span>}
        </div>
        {reason && !running && <p className="small muted" role="status">{reason}</p>}
      </section>

      <section className="panel">
        <div className="list-title-row">
          <h2 className="panel-title">Log gửi</h2>
          {log.length > 0 && !running && (
            <button type="button" className="icon-btn icon-btn-sm" onClick={() => setLog([])} aria-label="Xoá log phiên này"><Icon name="trash" size={14} /></button>
          )}
        </div>
        <p className="muted small">Mỗi dòng là một lần gửi trong phiên; tất cả được lưu vào SQLite <code>messages.db</code>.</p>
        {log.length ? (
          <ul className="sent-list autosend-log">
            {log.map(item => (
              <li key={item.id}>
                <span className="small">
                  <span className={`autosend-dot ${item.status}`} aria-hidden="true" />
                  {shortTime(item.at)} · {item.nick} → {item.peerName || item.peerUid.slice(0, 10)}
                </span>
                {item.status === 'dry'
                  ? <span className="small muted">Chế độ thử (chưa gửi)</span>
                  : item.note && <span className={`small ${item.status === 'fail' ? 'tone-bad' : 'tone-warn'}`}>{item.note}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="small muted">Chưa gửi tin nào trong phiên này.</p>}
      </section>
    </main>
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
