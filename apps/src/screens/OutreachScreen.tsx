// Tìm người & nhắn: collect users from Khám phá or a chat room with one or more
// signed-in accounts, see who found whom and who was already messaged (SQLite
// log), and open a 1-1 chat with any of them from a chosen account. Every
// message is typed or inserted from a template and sent by hand, one at a time.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useSession } from '../lib/session.tsx';
import { ENDPOINT, GENDERS, TABS, type Gender, type Tab } from './ExploreScreen.tsx';

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
  const [rooms, setRooms] = useState<string[]>(['79']);
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
    : rooms.length ? `Phòng ${rooms.map(provinceName).join(', ')}` : 'Phòng chat';

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
    let total = 0;
    let failed = '';
    try {
      for (const id of chosen) {
        if (cancel.current) break;
        const ola = live[id]?.ola;
        if (!ola) continue;
        const by = { id, label: label(id) };
        try {
          if (source === 'explore') {
            let next: ExploreNext | null = null;
            for (let page = 0; page < pages && !cancel.current; page++) {
              setProgress({ text: `Đang lấy trang ${page + 1}/${pages} bằng ${by.label}… (${total} người)`, tone: 'idle' });
              const input = page === 0
                ? { page: 0, ...(gender !== 'all' && { gender }), ...(city !== 'all' && { cityID: city }) }
                : next!;
              const result: ExploreResult = await ola.call(ENDPOINT[tab], input);
              const users = result.items.map(item => normalizeUser(item)).filter(u => u.uid);
              next = result.next;
              total += merge(users, by, via);
              if (!users.length || !next) break;
              await sleep(PAGE_PAUSE_MS);
            }
          } else {
            // Phòng chat: lấy HẾT thành viên từng phòng đã chọn — tự chạy mọi trang
            // tới khi hết (không dùng ô "trang"), tối đa MAX_PAGES/phòng cho an toàn.
            for (const code of rooms) {
              if (cancel.current) break;
              const where = `Phòng ${provinceName(code)}`;
              for (let page = 0; page < MAX_PAGES && !cancel.current; page++) {
                setProgress({ text: `Đang lấy ${where} (trang ${page + 1}) bằng ${by.label}… (${total} người)`, tone: 'idle' });
                const users = (await loadRoomMembers(ola, code, page)).filter(u => u.uid);
                total += merge(users, by, where);
                if (!users.length) break;
                await sleep(PAGE_PAUSE_MS);
              }
            }
          }
        } catch (e) {
          failed = `${by.label}: ${(e as Error).message}`;
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

  // Recipients for auto-send: everyone shown is included until unticked in the list.
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

  return (
    <div className="screen screen-split outreach" hidden={hidden}>
      <section className="outreach-side" aria-label="Lấy danh sách người dùng">
        <div className="outreach-collect">
          <div className="list-title-row">
            <h1>Tìm người &amp; nhắn</h1>
            <span className="muted small">{autoPicked.length} người được chọn</span>
          </div>
          <div className="outreach-line">
            <div className="tabs tabs-sm" role="tablist" aria-label="Nguồn">
              {(['explore', 'room'] as const).map(s => (
                <button key={s} type="button" role="tab" aria-selected={source === s} className={`tab${source === s ? ' is-active' : ''}`} onClick={() => setSource(s)}>
                  {s === 'explore' ? 'Khám phá' : 'Phòng chat'}
                </button>
              ))}
            </div>
            {source === 'explore' && (
              <label className="pages-input" title="Số trang mỗi nick lấy (1–50)">
                <input type="number" min={1} max={MAX_PAGES} value={pages} aria-label="Số trang mỗi nick"
                  onChange={e => setPages(Math.max(1, Math.min(MAX_PAGES, Math.floor(Number(e.target.value) || 1))))} />
                <span className="small muted">trang</span>
              </label>
            )}
            {source === 'room' && <span className="small muted pages-input">lấy hết thành viên</span>}
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
              <select aria-label="Thêm phòng" value="" onChange={e => { const v = e.target.value; if (v) setRooms(rs => (rs.includes(v) ? rs : [...rs, v])); }}>
                <option value="">+ Thêm phòng…</option>
                {PROVINCES.filter(p => !rooms.includes(p.code)).map(p => <option key={p.code} value={p.code}>Phòng {p.name}</option>)}
              </select>
            )}
          </div>
          {source === 'room' && (
            <div className="outreach-line" role="group" aria-label="Phòng đã chọn">
              {rooms.length ? rooms.map(code => (
                <button key={code} type="button" className="nick-chip is-on" title="Bỏ phòng này" aria-label={`Bỏ phòng ${provinceName(code)}`}
                  onClick={() => setRooms(rs => rs.filter(x => x !== code))}>
                  Phòng {provinceName(code)} <Icon name="x" size={11} />
                </button>
              )) : <span className="small tone-warn">Chọn ít nhất một phòng để lấy.</span>}
            </div>
          )}
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
              <button type="button" className="btn btn-primary btn-sm" disabled={!chosen.length || (source === 'room' && !rooms.length)} onClick={() => void collect()}><Icon name="download" size={14} /> Lấy</button>
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
          <button type="button" className="icon-btn icon-btn-sm" disabled={!found.length || running} title="Xoá danh sách đã lấy" aria-label="Xoá danh sách" onClick={() => { setList([]); setProgress(null); }}><Icon name="trash" size={15} /></button>
        </div>
        <ul className="conv-list">
          {shown.map(f => {
            const sent = contacts.get(f.user.uid) ?? [];
            const name = f.user.displayName || `${f.user.uid.slice(0, 10)}…`;
            const meta = [f.user.state && provinceName(f.user.state), f.user.lastSeen ? lastSeenLabel(f.user.lastSeen) : '', `từ ${f.by.map(b => b.label).join(', ')}`];
            const picked = !excluded.has(f.user.uid);
            return (
              <li key={f.user.uid}>
                <button type="button" className={`conv-row outreach-row${picked ? '' : ' is-unpicked'}`}
                  onClick={() => togglePick(f.user.uid)}
                  aria-pressed={picked}
                  title={`${f.via}${f.user.level ? ` · cấp ${f.user.level}` : ''}`}>
                  <span className={`pick-box${picked ? ' is-on' : ''}`} aria-hidden="true">{picked ? '✓' : ''}</span>
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

      <AutoSendPanel
        recipients={autoPicked.map(f => f.user)}
        shownCount={shown.length}
        contacts={contacts}
        online={onlineLite}
        recent={recent}
        logError={logError}
        onSelectAll={pickAll}
        onSelectNone={pickNone}
      />
    </div>
  );
}

/** Tin nhắn mẫu (settings.json): the composer's Mẫu button inserts them; sending stays manual. */
function TemplatesPanel({ embedded = false }: { embedded?: boolean }) {
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

  const body = (
    <>
      <p className="muted small">Những mẫu này dùng cho “Ngẫu nhiên từ mẫu” khi auto gửi.</p>
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
      <textarea className="autosend-textarea template-input" rows={2} maxLength={4000} placeholder="Nội dung mẫu mới" value={draft} onChange={e => setDraft(e.target.value)} />
      <div className="form-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={!draft.trim()} onClick={() => void submit()}>{editing === null ? 'Thêm mẫu' : 'Lưu mẫu'}</button>
        {editing !== null && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setDraft(''); }}>Huỷ</button>}
      </div>
      {error && <p className="notice notice-bad small" role="alert">{error}</p>}
    </>
  );

  if (embedded) return body;
  return (
    <section className="panel" aria-label="Tin nhắn mẫu">
      <h2 className="panel-title">Tin nhắn mẫu</h2>
      {body}
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
interface LogItem { id: string; at: number; peerUid: string; peerName: string; nick: string; status: LogStatus; note?: string; pushOk?: boolean | null }

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

/** Giây → "45s" hoặc "2p05". */
function estLabel(sec: number): string {
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}p${String(sec % 60).padStart(2, '0')}`;
}

/** Overlay nhỏ (.modal-backdrop + .modal): Esc hoặc bấm nền để đóng. */
function AutoModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal panel autosend-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="list-title-row">
          <h2 className="panel-title">{title}</h2>
          <button type="button" className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Đóng"><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Trạng thái thông báo đẩy (FCM) của một tin đã gửi. */
function PushMark({ ok }: { ok: boolean | null | undefined }) {
  if (ok === true) return <span className="push-mark tone-ok" title="Đã bắn thông báo đẩy (FCM)"><Icon name="bell" size={12} /></span>;
  if (ok === false) return <span className="push-mark tone-warn" title="Thông báo đẩy lỗi"><Icon name="bell" size={12} /></span>;
  return <span className="push-mark muted" title="Người nhận không có token FCM — không gửi được push"><Icon name="bellOff" size={12} /></span>;
}

function AutoSendPanel({ recipients, shownCount, contacts, online, recent, logError, onSelectAll, onSelectNone }: {
  recipients: ChatUser[];
  shownCount: number;
  contacts: Map<string, Contact[]>;
  online: { id: string; label: string }[];
  recent: SentRow[];
  logError: string | null;
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
  const [cap, setCap] = useState(0); // 0 = không giới hạn (gửi hết)
  const [skipContacted, setSkipContacted] = useState(true);
  const [showSkip, setShowSkip] = useState(false);
  const [modal, setModal] = useState<null | 'history' | 'templates'>(null);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ text: string; tone: string } | null>(null);
  const [counts, setCounts] = useState<{ ok: number; fail: number }>({ ok: 0, fail: 0 });
  const [runSize, setRunSize] = useState(0);
  const [now, setNow] = useState<{ name: string; photo: string; nick: string; text: string } | null>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const cancel = useRef(false);
  // Unmounting (e.g. leaving the screen) stops a run instead of letting it send on in the background.
  useEffect(() => () => { cancel.current = true; }, []);

  // People excluded because they were already messaged (shown when "bỏ qua" is on).
  const skipped = useMemo(
    () => (skipContacted ? recipients.filter(u => contacts.has(u.uid)) : []),
    [recipients, skipContacted, contacts],
  );
  const targets = useMemo(
    () => (skipContacted ? recipients.filter(u => !contacts.has(u.uid)) : recipients),
    [recipients, skipContacted, contacts],
  );
  const sendCount = cap > 0 ? Math.min(cap, targets.length) : targets.length;
  const senders = useMemo(
    () => senderIds.filter(id => live[id]?.status === 'ready' && live[id]?.ola && live[id]?.me),
    [senderIds, live],
  );
  const haveMessage = msgMode === 'single' ? Boolean(single.trim()) : pool.length > 0;
  const reason = !sendCount ? 'Chưa có người nhận nào.'
    : !senders.length ? 'Chọn ít nhất một nick đang online để gửi.'
      : !haveMessage ? (msgMode === 'single' ? 'Nhập nội dung tin nhắn.' : 'Chọn ít nhất một mẫu tin.')
        : null;

  // Thời gian ước tính: mỗi tin ~1.8s (kết nối + gửi) + giãn cách giữa các tin.
  const estSec = sendCount > 0 ? Math.round(sendCount * (dryRun ? 0.2 : 1.8) + Math.max(0, sendCount - 1) * delaySec) : 0;
  const previewText = running ? (now?.text ?? '') : (msgMode === 'single' ? single.trim() : (pool[0] ?? ''));

  const pickMessage = () => (msgMode === 'single'
    ? single.trim()
    : pool[Math.floor(Math.random() * pool.length)] ?? '');

  const sendOne = async (sender: Sender, user: ChatUser, text: string): Promise<{ note?: string; pushOk: boolean | null }> => {
    const now = Date.now();
    if (dryRun) {
      const payload = directMessagePayload({ from: sender.me, text, now });
      await logSent({
        sentAt: now, accountId: sender.id, accountUid: sender.me.uid, accountLabel: sender.label,
        peerUid: user.uid, peerName: user.displayName, messageId: String(payload.messageID), text,
        source: AUTO_SOURCE, pushOk: null, lastMessageOk: null, error: null, dryRun: true,
      });
      return { pushOk: null };
    }
    // Prefer any fcmToken the lookup returns; fall back to the one the collected
    // user carried (some sources include it, Khám phá/phòng do not → no push).
    const loaded = await loadChatUser(sender.ola, user.uid);
    const peer = { ...loaded, fcmToken: loaded.fcmToken || user.fcmToken };
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
      return { note: failed.length ? `Đã gửi; lỗi ${failed.map(f => f.name).join(', ')}` : undefined, pushOk: stepOk('push') };
    } finally {
      channel.close();
    }
  };

  const run = async () => {
    if (reason) return;
    cancel.current = false;
    setRunning(true);
    setLog([]);
    setCounts({ ok: 0, fail: 0 });
    // Snapshot the senders and the capped target list so a mid-run state change cannot shift them.
    const pool2: Sender[] = senders.map(id => ({
      id, label: online.find(o => o.id === id)?.label ?? id, ola: live[id]!.ola!, me: live[id]!.me!,
    }));
    const list = cap > 0 ? targets.slice(0, cap) : targets;
    setRunSize(list.length);
    const add = (item: LogItem) => setLog(l => [item, ...l].slice(0, 1000));
    let ok = 0, fail = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        if (cancel.current) break;
        const user = list[i]!;
        const sender = pool2[i % pool2.length]!;
        const text = pickMessage();
        const at = Date.now();
        setNow({ name: user.displayName || user.uid.slice(0, 10), photo: user.photoURL, nick: sender.label, text });
        setProgress({ text: `Đang gửi ${i + 1}/${list.length} · ${sender.label} → ${user.displayName || user.uid.slice(0, 8)}…`, tone: 'idle' });
        try {
          const { note, pushOk } = await sendOne(sender, user, text);
          ok++;
          add({ id: `${at}-${user.uid}`, at, peerUid: user.uid, peerName: user.displayName, nick: sender.label, status: dryRun ? 'dry' : 'ok', note, pushOk });
        } catch (e) {
          fail++;
          add({ id: `${at}-${user.uid}`, at, peerUid: user.uid, peerName: user.displayName, nick: sender.label, status: 'fail', note: (e as Error).message });
        }
        setCounts({ ok, fail });
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
      setNow(null);
      setRunning(false);
    }
  };

  const total = counts.ok + counts.fail;
  const pct = runSize ? Math.min(100, Math.round((total / runSize) * 100)) : 0;
  const nickNames = senders.map(id => online.find(o => o.id === id)?.label ?? id);

  return (
    <main className="autosend-campaign" aria-label="Auto gửi">
      <div className="campaign-config">
        <div className="campaign-head">
          <h2 className="panel-title">Auto gửi</h2>
          {dryRun && <span className="chip tone-warn">Chế độ thử</span>}
          <span className="grow" />
          <div className="campaign-head-tools">
            <button type="button" className="icon-btn icon-btn-sm" aria-label="Quản lý tin nhắn mẫu" title="Tin nhắn mẫu" onClick={() => setModal('templates')}><Icon name="template" size={15} /></button>
            <button type="button" className="icon-btn icon-btn-sm" aria-label="Lịch sử đã gửi gần đây" title="Lịch sử đã gửi (SQLite)" onClick={() => setModal('history')}><Icon name="toTray" size={15} /></button>
          </div>
        </div>

        <ol className="campaign-fields">
          <li className="cfg-block">
            <div className="cfg-block-head">
              <span className={`cfg-num${sendCount > 0 ? ' is-done' : ''}`} aria-hidden="true">1</span>
              <h3 className="grow">Người nhận</h3>
              <span className="cfg-count">{sendCount} người</span>
            </div>
            <div className="cfg-subrow">
              <span className="muted small">chọn {recipients.length}/{shownCount} đã lọc</span>
              <span className="grow" />
              <button type="button" className="icon-btn icon-btn-sm" disabled={running || !shownCount} onClick={onSelectAll}>Chọn tất cả</button>
              <button type="button" className="icon-btn icon-btn-sm" disabled={running || !shownCount} onClick={onSelectNone}>Bỏ chọn</button>
            </div>
            <label className="checkbox small">
              <input type="checkbox" checked={skipContacted} disabled={running} onChange={e => setSkipContacted(e.target.checked)} />
              Bỏ qua người đã được nhắn
            </label>
            {skipContacted && skipped.length > 0 && (
              <>
                <button type="button" className="disclosure" aria-expanded={showSkip} aria-controls="autosend-skip" onClick={() => setShowSkip(v => !v)}>
                  <Icon name={showSkip ? 'chevronDown' : 'chevronRight'} size={14} />
                  {skipped.length} người bị bỏ qua
                </button>
                {showSkip && (
                  <ul id="autosend-skip" className="skip-list">
                    {skipped.map(u => {
                      const cs = contacts.get(u.uid) ?? [];
                      const n = cs.reduce((s, c) => s + c.count, 0);
                      const who = cs.map(c => c.accountLabel).join(', ');
                      return (
                        <li key={u.uid}>
                          <Avatar name={u.displayName || u.uid} photo={u.photoURL} seed={u.uid} size={26} ring="var(--bg)" />
                          <span className="skip-who">
                            <span className="ellipsis">{u.displayName || `${u.uid.slice(0, 10)}…`}</span>
                            <span className="small muted ellipsis">đã nhắn bởi {who || '—'} · {n} tin</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
            <label className="cfg-subrow cfg-caplabel">
              Gửi tối đa
              <span className="pages-input">
                <input type="number" min={0} max={Math.max(0, targets.length)} value={cap || ''} placeholder="tất cả" disabled={running} aria-label="Gửi tối đa bao nhiêu người (trống = tất cả)"
                  onChange={e => setCap(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                <span className="small muted">người</span>
              </span>
              {cap > 0 && targets.length > cap && <span className="small muted">bỏ {targets.length - cap} người cuối</span>}
            </label>
          </li>

          <li className="cfg-block">
            <div className="cfg-block-head">
              <span className={`cfg-num${senders.length > 0 ? ' is-done' : ''}`} aria-hidden="true">2</span>
              <h3 className="grow">Gửi bằng nick{senders.length > 1 ? ' · xoay vòng' : ''}</h3>
              <span className="cfg-count">{senders.length} nick</span>
            </div>
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
          </li>

          <li className="cfg-block">
            <div className="cfg-block-head">
              <span className={`cfg-num${haveMessage ? ' is-done' : ''}`} aria-hidden="true">3</span>
              <h3 className="grow">Nội dung</h3>
              <span className="cfg-count">{msgMode === 'single' ? '1 nội dung' : `${pool.length} mẫu`}</span>
            </div>
            <div className="segmented" role="tablist" aria-label="Kiểu nội dung">
              {(['single', 'random'] as const).map(m => (
                <button key={m} type="button" role="tab" aria-selected={msgMode === m} className={msgMode === m ? 'is-active' : ''} disabled={running} onClick={() => setMsgMode(m)}>
                  {m === 'single' ? 'Một nội dung' : 'Ngẫu nhiên từ mẫu'}
                </button>
              ))}
            </div>
            {msgMode === 'single' ? (
              <textarea className="autosend-textarea" rows={3} maxLength={4000} placeholder="Nội dung gửi cho mọi người" value={single} disabled={running} onChange={e => setSingle(e.target.value)} />
            ) : templates.length ? (
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
            ) : (
              <p className="small muted">Chưa có mẫu — <button type="button" className="link-btn" onClick={() => setModal('templates')}>thêm mẫu</button>.</p>
            )}
          </li>

          <li className="cfg-block">
            <div className="cfg-block-head">
              <span className="cfg-num is-done" aria-hidden="true">4</span>
              <h3 className="grow">Giãn cách</h3>
              <span className="cfg-count">{delaySec}s/tin</span>
            </div>
            <label className="cfg-subrow cfg-caplabel">
              Mỗi tin cách nhau
              <span className="pages-input">
                <input type="number" min={0} step={0.5} value={delaySec} disabled={running} aria-label="Giãn cách mỗi tin (giây)"
                  onChange={e => setDelaySec(Math.max(0, Number(e.target.value) || 0))} />
                <span className="small muted">giây</span>
              </span>
            </label>
          </li>
        </ol>
      </div>

      <div className="campaign-live">
        <div className="live-section">
          <div className="live-head"><span className="live-eyebrow">Xem trước</span></div>
          {running && now && (
            <div className="live-now">
              <Avatar name={now.name} photo={now.photo} seed={now.name} size={34} ring="var(--surface)" />
              <span className="skip-who">
                <span className="small muted ellipsis">{now.nick} → đang gửi</span>
                <strong className="ellipsis">{now.name}</strong>
              </span>
            </div>
          )}
          {previewText
            ? <div className="preview-bubble">{previewText}</div>
            : <p className="live-empty">{msgMode === 'single' ? 'Nhập nội dung để xem trước.' : 'Chọn mẫu để xem trước.'}</p>}
          <div className="preview-meta">
            <span><strong>{running ? runSize : sendCount}</strong> người</span>
            <span><strong>{senders.length}</strong> nick</span>
            <span>{delaySec}s/tin</span>
            <span>{estSec > 0 ? `~${estLabel(estSec)}` : '—'}</span>
          </div>
        </div>

        <div className="live-log">
          <div className="live-head">
            <span className="live-eyebrow grow">Nhật ký{log.length ? ` (${log.length})` : ''}</span>
            {log.length > 0 && !running && (
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => setLog([])} aria-label="Xoá log phiên này"><Icon name="trash" size={14} /></button>
            )}
          </div>
          {log.length ? (
            <ul className="sent-list autosend-log">
              {log.map(item => (
                <li key={item.id}>
                  <span className="small">
                    <span className={`autosend-dot ${item.status}`} aria-hidden="true" />
                    {shortTime(item.at)} · {item.nick} → {item.peerName || item.peerUid.slice(0, 10)}
                    {item.status !== 'dry' && <> <PushMark ok={item.pushOk} /></>}
                  </span>
                  {item.status === 'dry'
                    ? <span className="small muted">Chế độ thử (chưa gửi)</span>
                    : item.note && <span className={`small ${item.status === 'fail' ? 'tone-bad' : 'tone-warn'}`}>{item.note}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="small muted">Chưa gửi tin nào trong phiên này.</p>}
          <p className="live-logfoot"><Icon name="bell" size={11} /> đã đẩy push · <Icon name="bellOff" size={11} /> người nhận không có token. Lưu vào SQLite <code>messages.db</code>.</p>
        </div>

        <div className="live-actions">
          {running ? (
            <>
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={runSize} aria-valuenow={total}>
                <span className={`progress-fill${counts.fail ? ' tone-bad' : ''}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="progress-text" role="status" aria-live="polite">
                <span className="grow ellipsis tone-idle">{progress?.text}</span>
                <span className="tone-ok">✓{counts.ok}</span>
                {counts.fail > 0 && <span className="tone-bad">✕{counts.fail}</span>}
              </span>
            </>
          ) : reason ? (
            <p className="send-summary is-blocked"><Icon name="info" size={14} />{reason}</p>
          ) : (
            <p className="send-summary">
              Gửi tới <strong>{sendCount}</strong> người, mỗi <strong>{delaySec}s</strong>, bằng <strong>{senders.length}</strong> nick{nickNames.length ? ` (${nickNames.join(', ')})` : ''}, {msgMode === 'single' ? '1 nội dung' : `ngẫu nhiên ${pool.length} mẫu`}.
            </p>
          )}
          {!running && progress && <span className={`small tone-${progress.tone}`} role="status">{progress.text}</span>}
          {running ? (
            <button type="button" className="btn btn-danger btn-run" onClick={() => { cancel.current = true; }}><Icon name="stop" size={16} /> Dừng</button>
          ) : (
            <button type="button" className="btn btn-primary btn-run" disabled={Boolean(reason)} title={reason ?? ''} onClick={() => void run()}>
              <Icon name="send" size={16} /> {dryRun ? 'Chạy thử' : 'Bắt đầu gửi'}
            </button>
          )}
        </div>
      </div>

      {modal === 'history' && (
        <AutoModal title="Đã gửi gần đây" onClose={() => setModal(null)}>
          <p className="muted small">Mọi tin 1-1 đã gửi, lưu trong SQLite <code>messages.db</code>.</p>
          {logError && <p className="notice notice-bad small">Không đọc được lịch sử: {logError}</p>}
          {recent.length ? (
            <ul className="sent-list">
              {recent.map(r => (
                <li key={r.id}>
                  <span className="small muted">{shortTime(r.sentAt)} · {r.accountLabel} → {r.peerName || r.peerUid.slice(0, 10)}{!r.dryRun && <> <PushMark ok={r.pushOk} /></>}</span>
                  <span className="ellipsis">{r.text}</span>
                  {(r.dryRun || r.error) && <span className={`small ${r.error ? 'tone-warn' : 'muted'}`}>{r.dryRun ? 'Chế độ thử (chưa gửi)' : r.error}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="small muted">Chưa gửi tin nào.</p>}
        </AutoModal>
      )}

      {modal === 'templates' && (
        <AutoModal title="Tin nhắn mẫu" onClose={() => setModal(null)}>
          <TemplatesPanel embedded />
        </AutoModal>
      )}
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
