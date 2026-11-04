import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  enterRoom, loadRoomMembers, localTextMessage, normalizeMessage, roomMessagePayload, sendRoomMessage,
  type ChannelState, type ChatChannel, type ChatMessage, type ChatUser,
} from '@ola/core/chat.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Composer } from '../components/Composer.tsx';
import { Icon } from '../components/Icon.tsx';
import { MessageList, type PendingState } from '../components/MessageList.tsx';
import { mergeMessages } from '../lib/messageCache.ts';
import { lastSeenLabel } from '../lib/format.ts';
import { PROVINCES, provinceName } from '../lib/provinces.ts';
import { useAccount, useOla, useSession } from '../lib/session.tsx';
import type { PeerTarget } from './MessagesScreen.tsx';

export function RoomsScreen({ onMessage }: { onMessage: (peer: PeerTarget) => void }) {
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState<string | null>(null);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? PROVINCES.filter(p => p.name.toLowerCase().includes(q) || p.code === q) : PROVINCES;
  }, [query]);

  return (
    <div className="screen screen-split">
      <section className="list-panel" aria-label="Danh sách phòng chat">
        <div className="list-head">
          <div className="list-title-row">
            <h1>Phòng chat</h1>
            <span className="muted small">{PROVINCES.length} tỉnh/thành</span>
          </div>
          <div className="search">
            <Icon name="search" size={16} />
            <label className="sr-only" htmlFor="room-search">Tìm tỉnh/thành</label>
            <input id="room-search" type="search" placeholder="Tìm tỉnh/thành" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <ul className="conv-list">
          {list.map(p => (
            <li key={p.code}>
              <button type="button" className={`room-row${room === p.code ? ' is-active' : ''}`} onClick={() => setRoom(p.code)}>
                <span className="room-code" aria-hidden="true">{p.code}</span>
                <span className="grow truncate">{p.name}</span>
                {p.verified && <span className="muted" title="Mã phòng đã kiểm chứng trên app"><Icon name="check" size={14} label="Đã kiểm chứng" /></span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {room
        ? <RoomView key={room} roomID={room} onMessage={onMessage} />
        : (
          <main className="chat-panel chat-placeholder">
            <Icon name="users" size={32} />
            <p>Chọn một tỉnh/thành để vào phòng chat.</p>
            <p className="muted small">Giống app Ola, vào phòng sẽ đánh dấu tài khoản đang ở phòng đó.</p>
          </main>
        )}
    </div>
  );
}

/** Placeholder bubbles shown while entering a room. */
function ThreadSkeleton() {
  const rows = [false, true, false, false, true, false];
  return (
    <div className="thread" aria-hidden="true">
      {rows.map((out, i) => (
        <div key={i} className={`msg-row${out ? ' out' : ''}`}>
          {!out && <div className="skeleton sk-avatar-sm" />}
          <div className={`skeleton sk-bubble sk-bubble-${i % 3}`} />
        </div>
      ))}
    </div>
  );
}

function RoomView({ roomID, onMessage }: { roomID: string; onMessage: (peer: PeerTarget) => void }) {
  const { ola, me, deviceId } = useOla();
  const { settings } = useSession();
  const { openChannel } = useAccount();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [online, setOnline] = useState<number | null>(null);
  const [channelState, setChannelState] = useState<ChannelState | 'none'>('none');
  const [membersOpen, setMembersOpen] = useState(false);
  const [members, setMembers] = useState<ChatUser[] | null>(null);
  const [pending, setPending] = useState<PendingState[]>([]);
  const channelRef = useRef<ChatChannel | null>(null);
  const name = provinceName(roomID);

  const merge = useCallback((incoming: ChatMessage[]) => setMessages(list => mergeMessages(list, incoming)), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    enterRoom(ola, roomID)
      .then(snapshot => { if (!cancelled) { setMessages(snapshot.messages); setBlocked(snapshot.blocked); } })
      .catch(e => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ola, roomID]);

  useEffect(() => {
    // Rooms join by display name; 1-1 joins by uid (see docs/api/luong-phong-chat.md).
    const channel = openChannel(roomID, me.displayName);
    if (!channel) return;
    channelRef.current = channel;
    const offs = [
      channel.onState(setChannelState),
      channel.onMessage(raw => { const m = normalizeMessage(raw, me.uid); if (m) merge([m]); }),
      channel.onPresence(event => { if (event.numUsers !== null) setOnline(event.numUsers); }),
    ];
    channel.connect();
    return () => { offs.forEach(off => off()); channel.close(); channelRef.current = null; };
  }, [openChannel, roomID, me.displayName, me.uid, merge]);

  useEffect(() => {
    if (!membersOpen || members) return;
    loadRoomMembers(ola, roomID).then(setMembers).catch(e => setError((e as Error).message));
  }, [membersOpen, members, ola, roomID]);

  const send = async (text: string) => {
    const now = Date.now();
    if (settings.dryRunSends) {
      const payload = roomMessagePayload({ from: me, deviceId, text, now });
      const message = localTextMessage(String(payload.id), me, text, now);
      merge([message]);
      setPending(p => [...p, { id: message.id, error: 'Chế độ thử: chưa gửi lên server.' }]);
      return;
    }
    const channel = channelRef.current;
    if (!channel) return;
    try {
      const result = await sendRoomMessage(ola, channel, { from: me, roomID, deviceId, text, now });
      merge([result.message]);
      if (result.steps.some(s => !s.ok)) {
        setPending(p => [...p, { id: result.message.id, error: 'Đã gửi realtime; lưu tin vào phòng bị lỗi.' }]);
      }
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };

  const disabledReason = blocked ? 'Tài khoản đang bị cấm chat trong phòng'
    : settings.dryRunSends ? null
      : !settings.socketKey.trim() ? 'Socket key đang trống (Cài đặt › Nâng cao) nên chưa nhắn tin realtime được'
        : channelState !== 'connected' ? 'Đang chờ kết nối realtime…' : null;

  return (
    <div className="room-layout">
      <main className="chat-panel" aria-label={`Phòng ${name}`}>
        <header className="chat-head">
          <span className="room-badge" aria-hidden="true">{roomID}</span>
          <div className="chat-title">
            <h2>Phòng {name}</h2>
            <p className="muted small">
              {online !== null ? `${online} người đang trong phòng` : `${messages.length} tin gần đây`}
            </p>
          </div>
          <span className={`chip tone-${channelState === 'connected' ? 'ok' : channelState === 'none' ? 'warn' : 'idle'}`}>
            {channelState === 'none' ? 'Không có realtime' : channelState === 'connected' ? 'Realtime' : 'Đang kết nối…'}
          </span>
          <button type="button" className={`icon-btn${membersOpen ? ' is-active' : ''}`} aria-pressed={membersOpen} aria-label="Thành viên phòng" title="Thành viên" onClick={() => setMembersOpen(v => !v)}>
            <Icon name="users" />
          </button>
        </header>
        {error && <p className="notice notice-bad small composer-notice">{error}</p>}
        {loading
          ? <ThreadSkeleton />
          : <MessageList messages={messages} showSender pending={pending} empty="Phòng chưa có tin nhắn." />}
        <Composer placeholder={`Nhắn vào phòng ${name}`} disabledReason={disabledReason} onSend={send} />
      </main>
      {membersOpen && (
        <aside className="members-panel" aria-label="Thành viên phòng">
          <div className="members-head">
            <h3>Thành viên</h3>
            <button type="button" className="icon-btn" aria-label="Đóng" onClick={() => setMembersOpen(false)}><Icon name="x" /></button>
          </div>
          {!members && <p className="muted small pad">Đang tải…</p>}
          {members && !members.length && <p className="muted small pad">Chưa có ai.</p>}
          <ul className="member-list">
            {members?.map(m => (
              <li key={m.uid}>
                <Avatar name={m.displayName || m.uid} photo={m.photoURL} seed={m.uid} size={32} />
                <span className="member-text">
                  <span className="truncate">{m.displayName || 'Ẩn danh'}{m.isVip && <span className="vip-tag">VIP</span>}</span>
                  <span className="muted small">{m.lastSeen ? lastSeenLabel(m.lastSeen) : `Cấp ${m.level}`}</span>
                </span>
                {m.uid !== me.uid && (
                  <button type="button" className="icon-btn" aria-label={`Nhắn tin cho ${m.displayName || 'người này'}`} title="Nhắn tin"
                    onClick={() => onMessage({ uid: m.uid, name: m.displayName, photo: m.photoURL })}>
                    <Icon name="message" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
