import { Fragment, useEffect, useRef } from 'react';
import type { ChatMessage } from '@ola/core/chat.ts';
import { clockTime, dayLabel } from '../lib/format.ts';
import { Avatar } from './Avatar.tsx';

const KIND_TEXT: Record<ChatMessage['kind'], string> = {
  text: '', image: '[Ảnh]', sticker: '[Sticker]', gift: '[Quà tặng]', audio: '[Tin thoại]',
};

export interface PendingState { id: string; error?: string }

/**
 * Bubbles grouped by day. `showSender` adds names/avatars for rooms, where
 * several people talk.
 */
export function MessageList({ messages, showSender = false, typingName, pending = [], empty }: {
  messages: ChatMessage[];
  showSender?: boolean;
  typingName?: string | null;
  pending?: PendingState[];
  empty?: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, typingName]);
  const problems = new Map(pending.filter(p => p.error).map(p => [p.id, p.error!]));

  if (!messages.length && !typingName) {
    return <div className="thread thread-empty"><p className="muted">{empty ?? 'Chưa có tin nhắn.'}</p></div>;
  }

  let lastDay = '';
  return (
    <div className="thread" role="log" aria-live="polite" aria-relevant="additions">
      {messages.map((m, i) => {
        const day = dayLabel(m.at);
        const divider = day !== lastDay;
        lastDay = day;
        const prev = messages[i - 1];
        const firstOfRun = divider || !prev || prev.fromUid !== m.fromUid;
        const body = m.text || KIND_TEXT[m.kind] || '…';
        const problem = problems.get(m.id);
        return (
          <Fragment key={m.id}>
            {divider && <div className="day-divider"><span>{day}</span></div>}
            <div className={`msg-row${m.outgoing ? ' out' : ''}${firstOfRun ? ' first' : ''}`}>
              {showSender && !m.outgoing && (
                <span className="msg-avatar">{firstOfRun && <Avatar name={m.fromName || '?'} photo={m.fromPhoto} seed={m.fromUid} size={28} />}</span>
              )}
              <div className="msg-col">
                {showSender && !m.outgoing && firstOfRun && (
                  <span className="msg-sender">{m.fromName || 'Ẩn danh'}{m.isVip && <span className="vip-tag">VIP</span>}</span>
                )}
                <div className={`bubble${m.outgoing ? ' bubble-out' : ''}${m.kind !== 'text' ? ' bubble-meta' : ''}`}>
                  <span className="bubble-text">{body}</span>
                  <span className="bubble-time">{clockTime(m.at)}</span>
                </div>
                {problem && <span className="msg-problem" role="status">{problem}</span>}
              </div>
            </div>
          </Fragment>
        );
      })}
      {typingName && (
        <div className="typing" role="status">
          <span className="typing-dots" aria-hidden="true"><span /><span /><span /></span>
          {typingName} đang soạn tin…
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
