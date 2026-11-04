import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from './Icon.tsx';

// The Android app sets no limit and the socket delivers long texts intact; the
// server keeps only 150 characters for offline receivers (docs/api/luong-chat-1-1.md).
const MAX_LENGTH = 4000;

/**
 * Text composer: Enter sends, Shift+Enter adds a line. Reports typing
 * start/stop (stop after 2 s idle) so the caller can emit typing events.
 */
export function Composer({ placeholder, disabledReason, onSend, onTyping }: {
  placeholder: string;
  /** When set, the composer is disabled and this explains why. */
  disabledReason?: string | null;
  onSend: (text: string) => Promise<void> | void;
  onTyping?: (typing: boolean) => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const typing = useRef(false);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const disabled = Boolean(disabledReason) || busy;

  const stopTyping = () => {
    clearTimeout(idle.current);
    if (typing.current) { typing.current = false; onTyping?.(false); }
  };
  useEffect(() => stopTyping, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (value: string) => {
    setText(value);
    if (!onTyping) return;
    if (!typing.current && value) { typing.current = true; onTyping(true); }
    clearTimeout(idle.current);
    idle.current = setTimeout(stopTyping, 2000);
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    setBusy(true);
    stopTyping();
    try {
      await onSend(value);
      setText('');
    } catch {
      // The caller shows the error; keep the text so it can be resent.
    } finally {
      setBusy(false);
    }
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-row">
        <label htmlFor={id} className="sr-only">Nội dung tin nhắn</label>
        <textarea
          id={id}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          placeholder={disabledReason ?? placeholder}
          disabled={Boolean(disabledReason)}
          onChange={e => change(e.target.value)}
          onKeyDown={keyDown}
        />
        <button type="submit" className="btn btn-primary" disabled={disabled || !text.trim()}>
          <Icon name="send" size={16} /> {busy ? 'Đang gửi…' : 'Gửi'}
        </button>
      </div>
      <p className="composer-hint">Enter để gửi · Shift + Enter để xuống dòng</p>
    </form>
  );
}
