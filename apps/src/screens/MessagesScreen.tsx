import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  directMessagePayload, loadChatUser, loadConversations, localTextMessage, normalizeMessage, sendDirectMessage,
  type ChannelState, type ChatChannel, type ChatMessage, type ChatUser, type Conversation,
} from '@ola/core/chat.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Composer } from '../components/Composer.tsx';
import { Icon } from '../components/Icon.tsx';
import { MessageList, type PendingState } from '../components/MessageList.tsx';
import { lastSeenLabel, shortTime } from '../lib/format.ts';
import { appendThread, loadThread, loadThreadPeers, mergeMessages, onLocalMessage, rememberPeer } from '../lib/messageCache.ts';
import { logSent, type SentEntry } from '../lib/sentLog.ts';
import { useAccount, useOla, useSession } from '../lib/session.tsx';

export interface PeerTarget { uid: string; name?: string; photo?: string }

const CHANNEL_TEXT: Record<ChannelState, string> = {
  idle: 'Chưa kết nối', connecting: 'Đang kết nối…', connected: 'Realtime', disconnected: 'Mất kết nối', error: 'Lỗi kết nối',
};

export function MessagesScreen({ hidden, target, onTargetOpened, onUnreadChange }: {
  hidden: boolean;
  target: PeerTarget | null;
  onTargetOpened: () => void;
  onUnreadChange: (count: number) => void;
}) {
  const { ola, me } = useOla();
  const { onIncoming } = useAccount();
  const ids = useId();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PeerTarget | null>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [newUid, setNewUid] = useState('');
  const [showNew, setShowNew] = useState(false);
  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selected?.uid ?? null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [server, local] = await Promise.all([
        loadConversations(ola).catch(e => { setError((e as Error).message); return [] as Conversation[]; }),
        loadThreadPeers(me.uid),
      ]);
      const byPeer = new Map(server.map(c => [c.peerUid, c]));
      for (const [peerUid, { last, peer }] of Object.entries(local)) {
        const existing = byPeer.get(peerUid);
        if (existing) {
          if (!existing.peerName && peer) byPeer.set(peerUid, { ...existing, peerName: peer.displayName, peerPhoto: existing.peerPhoto || peer.photoURL });
          if (last.at > existing.at) byPeer.set(peerUid, { ...byPeer.get(peerUid)!, lastText: last.text, at: last.at, lastFromMe: last.outgoing });
        } else {
          byPeer.set(peerUid, {
            peerUid, peerName: peer?.displayName ?? '', peerPhoto: peer?.photoURL ?? '',
            lastText: last.text, lastFromMe: last.outgoing, at: last.at, unread: 0,
          });
        }
      }
      setConversations([...byPeer.values()].sort((a, b) => b.at - a.at));
      setUnread(Object.fromEntries(server.filter(c => c.unread > 0).map(c => [c.peerUid, c.unread])));
    } finally {
      setLoading(false);
    }
  }, [ola, me.uid]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Names for conversations the server listed without one. Each uid is asked
  // once per signed-in account, so a profile without a name is not re-fetched
  // every time the list changes.
  const namesTried = useRef(new Set<string>());
  useEffect(() => { namesTried.current = new Set(); }, [ola]);
  useEffect(() => {
    const missing = conversations.filter(c => !c.peerName && !namesTried.current.has(c.peerUid)).slice(0, 20);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      for (const c of missing) {
        if (cancelled) return;
        namesTried.current.add(c.peerUid);
        try {
          const user = await loadChatUser(ola, c.peerUid);
          // Superseded by a newer list: let the next run ask again.
          if (cancelled) { namesTried.current.delete(c.peerUid); return; }
          if (!user.displayName && !user.photoURL) continue;
          await rememberPeer(me.uid, user);
          setConversations(list => list.map(x => (x.peerUid === c.peerUid
            ? { ...x, peerName: user.displayName || x.peerName, peerPhoto: x.peerPhoto || user.photoURL } : x)));
        } catch { /* keep the uid as the label; not retried */ }
      }
    })();
    return () => { cancelled = true; };
  }, [conversations, ola, me.uid]);

  useEffect(() => onIncoming(message => {
    setConversations(list => {
      const others = list.filter(c => c.peerUid !== message.fromUid);
      const prev = list.find(c => c.peerUid === message.fromUid);
      return [{
        peerUid: message.fromUid, peerName: prev?.peerName || message.fromName, peerPhoto: prev?.peerPhoto || message.fromPhoto,
        lastText: message.text, lastFromMe: false, at: message.at, unread: 0,
      }, ...others];
    });
    if (selectedRef.current !== message.fromUid) setUnread(u => ({ ...u, [message.fromUid]: (u[message.fromUid] ?? 0) + 1 }));
  }), [onIncoming]);

  useEffect(() => onLocalMessage((myUid, peerUid, message) => {
    if (myUid !== me.uid) return;
    setConversations(list => {
      const prev = list.find(c => c.peerUid === peerUid);
      return [{
        peerUid, peerName: prev?.peerName ?? '', peerPhoto: prev?.peerPhoto ?? '',
        lastText: message.text, lastFromMe: true, at: message.at, unread: 0,
      }, ...list.filter(c => c.peerUid !== peerUid)];
    });
  }), [me.uid]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  useEffect(() => { onUnreadChange(totalUnread); }, [totalUnread, onUnreadChange]);

  const open = useCallback((peer: PeerTarget) => {
    setSelected(peer);
    setUnread(u => { const { [peer.uid]: _, ...rest } = u; return rest; });
  }, []);

  useEffect(() => {
    if (target) { open(target); onTargetOpened(); }
  }, [target, open, onTargetOpened]);

  const onSent = useCallback((peer: ChatUser, message: ChatMessage) => {
    setConversations(list => [{
      peerUid: peer.uid, peerName: peer.displayName, peerPhoto: peer.photoURL,
      lastText: message.text, lastFromMe: true, at: message.at, unread: 0,
    }, ...list.filter(c => c.peerUid !== peer.uid)]);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? conversations.filter(c => (c.peerName || c.peerUid).toLowerCase().includes(q) || c.lastText.toLowerCase().includes(q)) : conversations;
  }, [conversations, query]);

  const startNew = (event: FormEvent) => {
    event.preventDefault();
    const uid = newUid.trim();
    if (!uid) return;
    open({ uid });
    setNewUid('');
    setShowNew(false);
  };

  return (
    <div className="screen screen-split" hidden={hidden}>
      <section className="list-panel" aria-label="Danh sách hội thoại">
        <div className="list-head">
          <div className="list-title-row">
            <h1>Tin nhắn</h1>
            <span className="muted small">{conversations.length} hội thoại{totalUnread ? ` · ${totalUnread} chưa đọc` : ''}</span>
          </div>
          <div className="list-tools">
            <div className="search">
              <Icon name="search" size={16} />
              <label className="sr-only" htmlFor={`${ids}-search`}>Tìm hội thoại</label>
              <input id={`${ids}-search`} type="search" placeholder="Tìm hội thoại" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <button type="button" className="icon-btn" aria-label="Nhắn tin mới theo UID" title="Nhắn tin mới theo UID" onClick={() => setShowNew(v => !v)}>
              <Icon name="plus" />
            </button>
            <button type="button" className="icon-btn" aria-label="Tải lại danh sách" title="Tải lại" onClick={() => void refresh()} disabled={loading}>
              <Icon name="refresh" />
            </button>
          </div>
          {showNew && (
            <form className="inline-form" onSubmit={startNew}>
              <label className="sr-only" htmlFor={`${ids}-uid`}>UID người nhận</label>
              <input id={`${ids}-uid`} placeholder="UID người nhận (28 ký tự)" value={newUid} onChange={e => setNewUid(e.target.value)} autoFocus />
              <button type="submit" className="btn btn-primary btn-sm">Mở</button>
            </form>
          )}
          {error && <p className="notice notice-bad small">Không tải được danh sách: {error}</p>}
        </div>
        <ul className="conv-list">
          {filtered.map(c => (
            <li key={c.peerUid}>
              <button
                type="button"
                className={`conv-row${selected?.uid === c.peerUid ? ' is-active' : ''}`}
                onClick={() => open({ uid: c.peerUid, name: c.peerName, photo: c.peerPhoto })}
              >
                <Avatar name={c.peerName || c.peerUid} photo={c.peerPhoto} seed={c.peerUid} size={38} ring="var(--surface)" />
                <span className="conv-text">
                  <span className="conv-top">
                    <span className={`conv-name${unread[c.peerUid] ? ' strong' : ''}`}>{c.peerName || `${c.peerUid.slice(0, 10)}…`}</span>
                    <span className="conv-time">{shortTime(c.at)}</span>
                  </span>
                  <span className="conv-bottom">
                    <span className={`conv-last${unread[c.peerUid] ? ' unread' : ''}`}>{c.lastFromMe ? 'Bạn: ' : ''}{c.lastText || '…'}</span>
                    {Boolean(unread[c.peerUid]) && <span className="count-badge">{unread[c.peerUid]}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!loading && !filtered.length && (
            <li className="empty-list muted small">
              {query ? 'Không có hội thoại khớp.' : 'Chưa có hội thoại. Mở Khám phá để tìm người, hoặc bấm + để nhắn theo UID.'}
            </li>
          )}
          {loading && !conversations.length && <li className="empty-list muted small">Đang tải…</li>}
        </ul>
      </section>

      {selected
        ? <DirectChat key={selected.uid} target={selected} onSent={onSent} />
        : (
          <main className="chat-panel chat-placeholder">
            <Icon name="message" size={32} />
            <p>Chọn một hội thoại để bắt đầu nhắn tin.</p>
          </main>
        )}
    </div>
  );
}

/**
 * One 1-1 conversation of the account in context (AccountProvider). Every
 * message the user sends is recorded in the sent log (SQLite, sentLog.ts).
 */
export function DirectChat({ target, onSent, source = 'messages', actions }: {
  target: PeerTarget;
  onSent?: (peer: ChatUser, message: ChatMessage) => void;
  /** Recorded with each sent message: 'messages' (an account's Tin nhắn) or 'outreach'. */
  source?: string;
  /** Extra controls in the header (e.g. choosing the sending account). */
  actions?: ReactNode;
}) {
  const { ola, me } = useOla();
  const { settings } = useSession();
  const { account, onIncoming, openChannel } = useAccount();
  const [peer, setPeer] = useState<ChatUser | null>(null);
  const [peerError, setPeerError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channelState, setChannelState] = useState<ChannelState | 'none'>('none');
  const [peerTyping, setPeerTyping] = useState(false);
  const [pending, setPending] = useState<PendingState[]>([]);
  const channelRef = useRef<ChatChannel | null>(null);

  const merge = useCallback(async (incoming: ChatMessage[]) => {
    const merged = await appendThread(me.uid, target.uid, incoming);
    setMessages(merged);
  }, [me.uid, target.uid]);

  useEffect(() => {
    let cancelled = false;
    void loadThread(me.uid, target.uid).then(list => { if (!cancelled) setMessages(list); });
    loadChatUser(ola, target.uid)
      .then(async user => {
        if (cancelled) return;
        const full = { ...user, displayName: user.displayName || target.name || '', photoURL: user.photoURL || target.photo || '' };
        setPeer(full);
        await rememberPeer(me.uid, full);
      })
      .catch(e => { if (!cancelled) setPeerError((e as Error).message); });
    return () => { cancelled = true; };
  }, [ola, me.uid, target.uid, target.name, target.photo]);

  useEffect(() => {
    const channel = openChannel(target.uid, me.uid);
    if (!channel) return;
    channelRef.current = channel;
    const offs = [
      channel.onState(setChannelState),
      channel.onMessage(raw => {
        const m = normalizeMessage(raw, me.uid);
        if (m && (m.fromUid === target.uid || m.outgoing)) void merge([m]);
      }),
      channel.onTyping(setPeerTyping),
    ];
    channel.connect();
    return () => { offs.forEach(off => off()); channel.close(); channelRef.current = null; };
  }, [openChannel, target.uid, me.uid, merge]);

  // The inbox already wrote the message to disk; just add it to what is shown.
  useEffect(() => onIncoming(m => {
    if (m.fromUid === target.uid) { setPeerTyping(false); setMessages(list => mergeMessages(list, [m])); }
  }), [onIncoming, target.uid]);

  useEffect(() => onLocalMessage((myUid, peerUid, m) => {
    if (myUid === me.uid && peerUid === target.uid) setMessages(list => mergeMessages(list, [m]));
  }), [me.uid, target.uid]);

  /** Records a sent message in SQLite; a failed write must not look like a failed send. */
  const record = (message: ChatMessage, fields: Pick<SentEntry, 'pushOk' | 'lastMessageOk' | 'error' | 'dryRun'>) => {
    void logSent({
      sentAt: message.at, accountId: account.id, accountUid: me.uid, accountLabel: account.label || me.displayName,
      peerUid: target.uid, peerName: peer?.displayName || target.name || '', messageId: message.id, text: message.text,
      source, ...fields,
    }).catch(e => {
      const note = `Lỗi lưu lịch sử SQLite: ${(e as Error).message ?? e}`;
      // Keep a warning already shown for this message (MessageList shows one per id).
      setPending(p => {
        const old = p.find(x => x.id === message.id)?.error;
        return [...p.filter(x => x.id !== message.id), { id: message.id, error: old ? `${old} ${note}` : `Đã gửi; ${note.toLowerCase()}` }];
      });
    });
  };

  const send = async (text: string) => {
    const now = Date.now();
    if (settings.dryRunSends) {
      const payload = directMessagePayload({ from: me, text, now });
      const message = localTextMessage(String(payload.messageID), me, text, now);
      await merge([message]);
      setPending(p => [...p, { id: message.id, error: 'Chế độ thử: chưa gửi lên server.' }]);
      record(message, { pushOk: null, lastMessageOk: null, error: null, dryRun: true });
      return;
    }
    const channel = channelRef.current;
    if (!channel || !peer) return;
    try {
      const result = await sendDirectMessage(ola, channel, { from: me, peer, text, now });
      await merge([result.message]);
      onSent?.(peer, result.message);
      const step = (name: string) => result.steps.find(s => s.name === name);
      const failed = result.steps.filter(s => !s.ok);
      record(result.message, {
        pushOk: step('push')?.ok ?? null,
        lastMessageOk: step('lastMessage')?.ok ?? null,
        error: failed.map(f => `${f.name}: ${f.error ?? 'lỗi'}`).join('; ') || null,
        dryRun: false,
      });
      if (failed.length) {
        const names: Record<string, string> = { push: 'thông báo đẩy', lastMessage: 'lưu tin cuối' };
        setPending(p => [...p, { id: result.message.id, error: `Đã gửi realtime; lỗi ${failed.map(f => names[f.name] ?? f.name).join(', ')}.` }]);
      }
    } catch (e) {
      setPending(p => [...p, { id: `err-${now}`, error: (e as Error).message }]);
      throw e;
    }
  };

  const name = peer?.displayName || target.name || `${target.uid.slice(0, 10)}…`;
  const disabledReason = settings.dryRunSends ? null
    : !settings.socketKey.trim() ? 'Socket key đang trống (Cài đặt › Nâng cao) nên chưa nhắn tin realtime được'
      : channelState !== 'connected' ? 'Đang chờ kết nối realtime…'
        : !peer ? (peerError ? 'Không tải được thông tin người nhận' : 'Đang tải thông tin người nhận…')
          : null;
  const lastSeen = peer?.lastSeen ? lastSeenLabel(peer.lastSeen) : '';
  const sendErrors = pending.filter(p => p.id.startsWith('err-'));

  return (
    <main className="chat-panel" aria-label={`Trò chuyện với ${name}`}>
      <header className="chat-head">
        <Avatar name={name} photo={peer?.photoURL || target.photo} seed={target.uid} size={40} ring="var(--sidebar)" />
        <div className="chat-title">
          <h2>{name}{peer?.isVip && <span className="vip-tag">VIP</span>}</h2>
          <p className="muted small">{peerError ? `Lỗi tải hồ sơ: ${peerError}` : lastSeen || target.uid}</p>
        </div>
        <span className="chip" title="Tài khoản đang gửi">
          <span className="chip-swatch" style={{ background: account.color }} aria-hidden="true" />
          Gửi bằng: {me.displayName}
        </span>
        {actions}
        <span className={`chip tone-${channelState === 'connected' ? 'ok' : channelState === 'none' ? 'warn' : 'idle'}`}>
          {channelState === 'none' ? 'Không có realtime' : CHANNEL_TEXT[channelState]}
        </span>
      </header>
      <MessageList
        messages={messages}
        pending={pending}
        typingName={peerTyping ? name : null}
        empty="Chưa có tin nhắn trên máy này. Lịch sử 1-1 chỉ lưu những tin gửi/nhận qua app desktop."
      />
      {sendErrors.length > 0 && <p className="notice notice-bad small composer-notice">Gửi lỗi: {sendErrors.at(-1)!.error}</p>}
      <Composer
        placeholder={`Nhập tin nhắn cho ${name}`}
        disabledReason={disabledReason}
        onSend={send}
        onTyping={active => channelRef.current?.typing(active)}
        templates={settings.messageTemplates}
      />
    </main>
  );
}
