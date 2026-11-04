import { useMemo } from 'react';
import type { SentRow } from '../../../lib/sentLog.ts';
import { EmptyState, Modal, Notice, VirtualList } from '../../../ui/index.ts';
import type { SendLogEntry } from './engine.ts';
import { SendLogRow } from './SendLog.tsx';

/** Recent rows of messages.db (every screen), in the same layout as the send log. */
export function HistoryDialog({ rows, error, onClose }: { rows: SentRow[]; error: string | null; onClose: () => void }) {
  // SQLite only holds delivered or dry-run messages; failed sends are never logged.
  const entries = useMemo<SendLogEntry[]>(() => rows.map(r => ({
    id: String(r.id), at: r.sentAt, peerUid: r.peerUid, peerName: r.peerName, nick: r.accountLabel,
    text: r.text, status: r.dryRun ? 'dry' : 'ok', pushOk: r.pushOk, note: r.error ?? undefined, source: r.source,
  })), [rows]);

  return (
    <Modal
      title="Lịch sử đã gửi"
      description={`${rows.length} tin gần nhất từ mọi màn hình · lưu trong SQLite messages.db`}
      size="lg"
      onClose={onClose}
    >
      {error && <Notice tone="bad">Không đọc được lịch sử: {error}</Notice>}
      {entries.length ? (
        <VirtualList
          items={entries}
          getKey={e => e.id}
          estimateSize={84}
          label="Tin đã gửi"
          className="max-h-[60vh] rounded-md border border-line bg-bg"
          renderItem={(e, i) => <SendLogRow entry={e} divider={i > 0} showSource />}
        />
      ) : !error && <EmptyState icon="history" title="Chưa gửi tin nào">Tin gửi tay và auto gửi đều được lưu ở đây.</EmptyState>}
    </Modal>
  );
}
