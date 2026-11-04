import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from './Icon.tsx';

// The Android app sets no limit and the socket delivers long texts intact; the
// server keeps only 150 characters for offline receivers (docs/api/luong-chat-1-1.md).
const MAX_LENGTH = 4000;

/**
 * Text composer: Enter sends, Shift+Enter adds a line. Reports typing
 * start/stop (stop after 2 s idle) so the caller can emit typing events.
 */
export function Composer({ placeholder, disabledReason, onSend, onTyping, templates }: {
  placeholder: string;
  /** Saved texts the Mẫu button inserts; the user still presses Gửi. */
  templates?: string[];
  /** When set, the composer is disabled and this explains why. */
  disabledReason?: string | null;
  onSend: (text: string) => Promise<void> | void;
  onTyping?: (typing: boolean) => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const typing = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
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

  /** Puts a template at the cursor (replacing a selection); does not send. */
  const insert = (template: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    change((text.slice(0, start) + template + text.slice(end)).slice(0, MAX_LENGTH));
    setShowTemplates(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + template.length, start + template.length);
    });
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form className="composer" onSubmit={submit}>
      {showTemplates && templates?.length ? (
        <ul className="template-menu" role="menu" aria-label="Tin nhắn mẫu">
          {templates.map((t, i) => (
            <li key={i}>
              <button type="button" role="menuitem" onClick={() => insert(t)} title={t}>{t}</button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="composer-row">
        {templates && (
          <button
            type="button"
            className={`icon-btn${showTemplates ? ' is-active' : ''}`}
            aria-label="Chèn tin nhắn mẫu"
            aria-expanded={showTemplates}
            title={templates.length ? 'Chèn tin nhắn mẫu' : 'Chưa có tin nhắn mẫu (thêm ở màn Tìm người & nhắn)'}
            disabled={Boolean(disabledReason) || !templates.length}
            onClick={() => setShowTemplates(v => !v)}
          >
            <Icon name="template" size={18} />
          </button>
        )}
        <label htmlFor={id} className="sr-only">Nội dung tin nhắn</label>
        <textarea
          id={id}
          ref={area}
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
