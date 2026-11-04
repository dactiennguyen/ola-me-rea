import { useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar.tsx';
import { Icon, type IconName } from '../../../components/Icon.tsx';
import { copyText } from '../../../lib/clipboard.ts';
import { clockTime, fullTime } from '../../../lib/format.ts';
import { Badge, cn, EmptyState, Eyebrow, IconButton, Segmented, useToast, VirtualList, type Tone } from '../../../ui/index.ts';
import type { SendLogEntry, SendStatus } from './engine.ts';

const STATUS: Record<SendStatus, { label: string; icon: IconName; tone: Tone }> = {
  ok: { label: 'Đã gửi', icon: 'circleCheck', tone: 'ok' },
  fail: { label: 'Lỗi', icon: 'circleX', tone: 'bad' },
  dry: { label: 'Chạy thử', icon: 'flask', tone: 'neutral' },
};

/** `source` column → where the message was sent from. */
export const SOURCE_LABEL: Record<string, string> = {
  'outreach-auto': 'Auto gửi',
  outreach: 'Tìm người',
  messages: 'Tin nhắn',
  bulk: 'Hàng loạt',
};

/** A message longer than this (or multi-line) starts collapsed to 2 lines. */
const LONG_TEXT = 110;

/** Push outcome of a delivered message, always as icon + words. */
function PushState({ entry }: { entry: SendLogEntry }) {
  if (entry.status !== 'ok') return null;
  if (entry.pushOk === true) {
    return <span className="inline-flex items-center gap-1 text-ok" title="Đã bắn thông báo đẩy (FCM) tới máy người nhận"><Icon name="bell" size={12} />Đã đẩy thông báo</span>;
  }
  if (entry.pushOk === false) {
    return <span className="inline-flex items-center gap-1 text-warn" title="Gọi thông báo đẩy thất bại"><Icon name="bell" size={12} />Thông báo đẩy lỗi</span>;
  }
  return <span className="inline-flex items-center gap-1 text-muted" title="Server không cấp token FCM của người này nên không gửi được thông báo đẩy; tin vẫn tới trong app"><Icon name="bellOff" size={12} />Không có thông báo đẩy</span>;
}

/**
 * One sent (or failed) message: who, status, when, the message (2 lines, or in
 * full once opened; always selectable), sending nick, push, and a copy button.
 */
export function SendLogRow({ entry, divider, showSource = false }: { entry: SendLogEntry; divider: boolean; showSource?: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const s = STATUS[entry.status];
  const name = entry.peerName || `${entry.peerUid.slice(0, 10)}…`;
  const long = entry.text.length > LONG_TEXT || entry.text.includes('\n');

  const copy = async () => {
    const ok = await copyText(entry.text);
    toast(ok ? { tone: 'ok', message: `Đã sao chép tin gửi ${name}` } : { tone: 'bad', message: 'Không sao chép được — hãy bôi đen rồi Ctrl/⌘+C' });
  };

  return (
    <article className={cn('flex gap-3 px-3.5 py-3', divider && 'border-t border-line', entry.status === 'fail' && 'bg-bad-bg')}>
      <Avatar name={name} seed={entry.peerUid} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <header className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-strong" title={`${name} · UID ${entry.peerUid}`}>{name}</span>
          <Badge tone={s.tone} icon={s.icon}>{s.label}</Badge>
          {showSource && entry.source && <Badge>{SOURCE_LABEL[entry.source] ?? entry.source}</Badge>}
          <time dateTime={new Date(entry.at).toISOString()} title={fullTime(entry.at)} className="ml-auto shrink-0 text-xs tabular-nums text-muted">
            {clockTime(entry.at)}
          </time>
        </header>

        {entry.text ? (
          <div className="relative rounded-md rounded-tl-xs border border-line bg-surface py-2 pl-3 pr-9">
            {/* Clamp an inner element: clamping the padded box would let line 3 show in the padding. */}
            <p className={cn('select-text whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed text-fg', long && !open && 'line-clamp-2')}>
              {entry.text}
            </p>
            {long && (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
                className="mt-1 inline-flex items-center gap-1 rounded-xs text-xs font-semibold text-link hover:underline"
              >
                <Icon name={open ? 'chevronDown' : 'chevronRight'} size={12} />
                {open ? 'Thu gọn' : 'Xem đủ nội dung'}
              </button>
            )}
            <IconButton icon="copy" label="Sao chép nội dung tin" size="sm" variant="ghost" className="absolute right-1 top-1 text-muted hover:enabled:text-strong" onClick={() => void copy()} />
          </div>
        ) : <p className="text-sm text-muted">(không có nội dung)</p>}

        <footer className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-soft" title="Nick đã gửi">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: entry.nickColor ?? 'var(--muted)' }} />
            <span className="truncate">qua {entry.nick}</span>
          </span>
          <PushState entry={entry} />
        </footer>

        {entry.note && (
          <p className={cn('flex items-start gap-1.5 text-xs leading-normal', entry.status === 'fail' ? 'text-bad-text' : 'text-warn-text')}>
            <Icon name="alert" size={13} className="mt-px" />
            <span className="select-text">{entry.note}</span>
          </p>
        )}
      </div>
    </article>
  );
}

type Filter = 'all' | 'ok' | 'fail';

/** The session's send log: newest first, filterable, every row saved in SQLite too. */
export function SendLog({ entries, canClear, onClear, className }: {
  entries: SendLogEntry[];
  canClear: boolean;
  onClear: () => void;
  className?: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const failCount = useMemo(() => entries.filter(e => e.status === 'fail').length, [entries]);
  const shown = useMemo(
    () => (filter === 'all' ? entries : entries.filter(e => (filter === 'fail') === (e.status === 'fail'))),
    [entries, filter],
  );

  return (
    <section aria-label="Nhật ký gửi" className={cn('flex min-h-0 flex-col', className)}>
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <Eyebrow className="flex-1">Nhật ký gửi</Eyebrow>
        <Segmented
          size="sm"
          label="Lọc nhật ký"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Tất cả', count: entries.length },
            { value: 'ok', label: 'Thành công', count: entries.length - failCount, countClass: 'text-ok' },
            { value: 'fail', label: 'Lỗi', count: failCount, ...(failCount ? { countClass: 'text-bad' } : {}) },
          ]}
        />
        {canClear && entries.length > 0 && <IconButton icon="trash" label="Xoá nhật ký phiên này" size="sm" variant="danger" onClick={onClear} />}
      </header>

      {!entries.length ? (
        <EmptyState compact icon="inbox" title="Chưa gửi tin nào" className="mb-3 flex-1">
          Bấm “Bắt đầu gửi” — từng tin sẽ hiện ở đây kèm trạng thái và thông báo đẩy.
        </EmptyState>
      ) : !shown.length ? (
        <EmptyState compact icon={filter === 'fail' ? 'circleCheck' : 'inbox'} title={filter === 'fail' ? 'Không có tin lỗi' : 'Chưa có tin thành công'} className="flex-1" />
      ) : (
        <VirtualList
          items={shown}
          getKey={e => e.id}
          estimateSize={112}
          label="Các lần gửi"
          className="mx-3 mb-3 flex-1 rounded-md border border-line bg-bg"
          renderItem={(e, i) => <SendLogRow entry={e} divider={i > 0} />}
        />
      )}
    </section>
  );
}
