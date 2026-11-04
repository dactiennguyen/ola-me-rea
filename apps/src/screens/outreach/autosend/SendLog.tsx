import { useMemo, useState } from 'react';
import { Icon, type IconName } from '../../../components/Icon.tsx';
import { shortTime } from '../../../lib/format.ts';
import { Badge, cn, EmptyState, Eyebrow, IconButton, Segmented, VirtualList, type Tone } from '../../../ui/index.ts';
import type { SendLogEntry, SendStatus } from './engine.ts';

const STATUS: Record<SendStatus, { label: string; icon: IconName; tone: Tone; color: string }> = {
  ok: { label: 'Đã gửi', icon: 'circleCheck', tone: 'ok', color: 'text-ok' },
  fail: { label: 'Lỗi', icon: 'circleX', tone: 'bad', color: 'text-bad' },
  dry: { label: 'Chạy thử', icon: 'flask', tone: 'neutral', color: 'text-muted' },
};

/** `source` column → where the message was sent from. */
const SOURCE: Record<string, string> = {
  'outreach-auto': 'Auto gửi',
  outreach: 'Tìm người',
  messages: 'Tin nhắn',
  bulk: 'Hàng loạt',
};

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

/** One sent (or failed) message: status, who, by which nick, when, what, push. */
export function SendLogRow({ entry, divider, showSource = false }: { entry: SendLogEntry; divider: boolean; showSource?: boolean }) {
  const s = STATUS[entry.status];
  return (
    <article className={cn('flex gap-2.5 px-3 py-2.5', divider && 'border-t border-line')}>
      <Icon name={s.icon} size={17} className={cn('mt-0.5', s.color)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-strong">{entry.peerName || `${entry.peerUid.slice(0, 10)}…`}</span>
          <Badge tone={s.tone}>{s.label}</Badge>
          {showSource && entry.source && <Badge>{SOURCE[entry.source] ?? entry.source}</Badge>}
          <time dateTime={new Date(entry.at).toISOString()} className="ml-auto shrink-0 text-xs tabular-nums text-muted">{shortTime(entry.at)}</time>
        </div>
        <p className="truncate text-xs text-soft" title={entry.text}>{entry.text || '—'}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="inline-flex items-center gap-1 text-muted"><Icon name="user" size={12} />qua {entry.nick}</span>
          <PushState entry={entry} />
        </div>
        {entry.note && <p className={cn('text-xs leading-normal', entry.status === 'fail' ? 'text-bad' : 'text-warn')}>{entry.note}</p>}
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
            { value: 'ok', label: 'Thành công', count: entries.length - failCount },
            { value: 'fail', label: 'Lỗi', count: failCount },
          ]}
        />
        {canClear && entries.length > 0 && <IconButton icon="trash" label="Xoá nhật ký phiên này" size="sm" variant="danger" onClick={onClear} />}
      </header>

      {!entries.length ? (
        <EmptyState compact icon="inbox" title="Chưa gửi tin nào" className="flex-1">
          Bấm “Bắt đầu gửi” — từng tin sẽ hiện ở đây kèm trạng thái và thông báo đẩy.
        </EmptyState>
      ) : !shown.length ? (
        <EmptyState compact icon={filter === 'fail' ? 'circleCheck' : 'inbox'} title={filter === 'fail' ? 'Không có tin lỗi' : 'Chưa có tin thành công'} className="flex-1" />
      ) : (
        <VirtualList
          items={shown}
          getKey={e => e.id}
          estimateSize={84}
          label="Các lần gửi"
          className="mx-3 flex-1 rounded-md border border-line bg-bg"
          renderItem={(e, i) => <SendLogRow entry={e} divider={i > 0} />}
        />
      )}
      <p className="px-4 py-2 text-xs text-muted">Mọi tin được lưu vào SQLite <code>messages.db</code>.</p>
    </section>
  );
}
