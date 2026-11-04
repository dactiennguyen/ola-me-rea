import { useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon.tsx';
import { dayLabel } from '../../../lib/format.ts';
import type { SentRow } from '../../../lib/sentLog.ts';
import { useSession } from '../../../lib/session.tsx';
import { EmptyState, Input, Modal, Notice, Segmented, VirtualList, type SegmentOption } from '../../../ui/index.ts';
import type { SendLogEntry } from './engine.ts';
import { SendLogRow, SOURCE_LABEL } from './SendLog.tsx';

type Item =
  | { kind: 'day'; key: string; label: string; count: number }
  | { kind: 'row'; key: string; entry: SendLogEntry };

/** Lower-case and strip Vietnamese diacritics, so "nguyen" finds "Nguyễn". */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * Recent rows of messages.db (every screen), newest first, grouped by day.
 * Search by name, UID, nick or text; filter by the screen it was sent from.
 */
export function HistoryDialog({ rows, error, onClose }: { rows: SentRow[]; error: string | null; onClose: () => void }) {
  const { accounts } = useSession();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');

  // SQLite only holds delivered or dry-run messages; failed sends are never logged.
  const entries = useMemo<SendLogEntry[]>(() => {
    const colorOf = new Map(accounts.map(a => [a.id, a.color]));
    return rows.map(r => ({
      id: String(r.id), at: r.sentAt, peerUid: r.peerUid, peerName: r.peerName,
      nick: r.accountLabel, nickColor: colorOf.get(r.accountId),
      text: r.text, status: r.dryRun ? 'dry' : 'ok', pushOk: r.pushOk, note: r.error ?? undefined, source: r.source,
    }));
  }, [rows, accounts]);

  const sources = useMemo<SegmentOption<string>[]>(() => {
    const counts = new Map<string, number>();
    for (const e of entries) if (e.source) counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
    return [
      { value: 'all', label: 'Tất cả', count: entries.length },
      ...[...counts].map(([value, count]) => ({ value, label: SOURCE_LABEL[value] ?? value, count })),
    ];
  }, [entries]);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    return entries.filter(e =>
      (source === 'all' || e.source === source)
      && (!q || fold(`${e.peerName} ${e.peerUid} ${e.nick} ${e.text}`).includes(q)));
  }, [entries, source, query]);

  // Day headers between rows ("Hôm nay · 12 tin").
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const headers = new Map<string, Extract<Item, { kind: 'day' }>>();
    for (const entry of shown) {
      const label = dayLabel(entry.at);
      let header = headers.get(label);
      if (!header) { header = { kind: 'day', key: `day-${label}`, label, count: 0 }; headers.set(label, header); out.push(header); }
      header.count += 1;
      out.push({ kind: 'row', key: entry.id, entry });
    }
    return out;
  }, [shown]);

  return (
    <Modal
      title="Lịch sử đã gửi"
      size="xl"
      onClose={onClose}
    >
      {error && <Notice tone="bad">Không đọc được lịch sử: {error}</Notice>}
      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-56 flex-1">
            <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              className="w-full pl-8"
              placeholder="Tìm theo tên, UID, nick hoặc nội dung"
              aria-label="Tìm trong lịch sử"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </label>
          {sources.length > 2 && <Segmented size="sm" label="Lọc theo nơi gửi" value={source} onChange={setSource} options={sources} />}
        </div>
      )}
      {items.length ? (
        <VirtualList
          items={items}
          getKey={item => item.key}
          estimateSize={112}
          label="Tin đã gửi"
          className="h-[60vh] rounded-md border border-line bg-bg"
          renderItem={(item, i) => item.kind === 'day' ? (
            <h3 className={`flex items-center gap-2 bg-sidebar px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted ${i > 0 ? 'border-t border-line' : ''}`}>
              {item.label}
              <span className="font-semibold normal-case tracking-normal tabular-nums">· {item.count} tin</span>
            </h3>
          ) : <SendLogRow entry={item.entry} divider={items[i - 1]?.kind === 'row'} showSource={source === 'all'} />}
        />
      ) : entries.length ? (
        <EmptyState icon="search" title="Không có tin khớp">Thử từ khoá khác hoặc chọn “Tất cả”.</EmptyState>
      ) : !error && <EmptyState icon="history" title="Chưa gửi tin nào">Tin gửi tay và auto gửi đều được lưu ở đây.</EmptyState>}
    </Modal>
  );
}
