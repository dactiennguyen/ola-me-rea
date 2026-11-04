import { Avatar } from '../../components/Avatar.tsx';
import { Icon } from '../../components/Icon.tsx';
import { lastSeenLabel, shortTime } from '../../lib/format.ts';
import { provinceName } from '../../lib/provinces.ts';
import type { Contact } from '../../lib/sentLog.ts';
import { Badge, Button, Checkbox, cn, EmptyState, IconButton, Input, ToggleChip, VirtualList } from '../../ui/index.ts';
import type { ExportFormat } from './exportUsers.ts';
import type { Found } from './types.ts';

/** Collected people: filter, export, and tick who gets the auto-sent message. */
export function RecipientList({
  found, shown, contacts, query, onQuery, hideContacted, onHideContacted,
  isPicked, pickedCount, onToggle, onSelectAll, onSelectNone, onExport, onClear, busy,
}: {
  found: Found[];
  /** `found` after the filters below. */
  shown: Found[];
  contacts: Map<string, Contact[]>;
  query: string;
  onQuery: (query: string) => void;
  hideContacted: boolean;
  onHideContacted: (hide: boolean) => void;
  isPicked: (uid: string) => boolean;
  pickedCount: number;
  onToggle: (uid: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onExport: (format: ExportFormat) => void;
  onClear: () => void;
  /** Collecting is running. */
  busy: boolean;
}) {
  const all = shown.length > 0 && pickedCount === shown.length;
  return (
    <section aria-label="Danh sách người nhận" className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 px-4 pb-2.5 pt-3">
        <div className="relative">
          <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input type="search" compact className="w-full pl-8" placeholder={`Lọc theo tên, UID, tỉnh · ${shown.length}/${found.length} người`} aria-label="Lọc theo tên, UID, tỉnh" value={query} onChange={e => onQuery(e.target.value)} />
        </div>
        <div className="flex items-center gap-1">
          <ToggleChip pressed={hideContacted} onPressedChange={onHideContacted} title="Ẩn người đã được nhắn từ bất kỳ nick nào">Ẩn đã nhắn</ToggleChip>
          <span className="flex-1" />
          <Button size="sm" variant="subtle" icon="download" disabled={!shown.length} title="Xuất CSV (mở bằng Excel)" onClick={() => onExport('csv')}>CSV</Button>
          <Button size="sm" variant="subtle" icon="download" disabled={!shown.length} title="Xuất JSON" onClick={() => onExport('json')}>JSON</Button>
          <IconButton icon="trash" label="Xoá danh sách đã lấy" size="sm" variant="danger" disabled={!found.length || busy} onClick={onClear} />
        </div>
      </div>

      {shown.length > 0 && (
        <div className="flex items-center gap-2 border-y border-line bg-sidebar px-4 py-1">
          <Checkbox checked={all} indeterminate={pickedCount > 0} hue="sky" onChange={on => (on ? onSelectAll() : onSelectNone())}>Chọn tất cả</Checkbox>
          <span className="ml-auto text-xs tabular-nums text-muted">
            <strong className="font-semibold text-strong">{pickedCount}</strong>/{shown.length} được chọn
          </span>
        </div>
      )}

      {!found.length ? (
        <EmptyState icon="users" title={busy ? 'Đang lấy danh sách…' : 'Chưa có danh sách'} className="flex-1">
          {busy ? 'Người tìm thấy sẽ hiện ở đây.' : 'Chọn nguồn và nick ở trên rồi bấm “Lấy danh sách”.'}
        </EmptyState>
      ) : !shown.length ? (
        <EmptyState icon="search" title="Không có ai khớp bộ lọc" className="flex-1">Đổi từ khoá hoặc tắt “Ẩn đã nhắn”.</EmptyState>
      ) : (
        <VirtualList
          items={shown}
          getKey={f => f.user.uid}
          estimateSize={52}
          label="Người đã lấy"
          className="flex-1 px-2 py-1"
          renderItem={f => <RecipientRow found={f} sent={contacts.get(f.user.uid) ?? []} picked={isPicked(f.user.uid)} onToggle={onToggle} />}
        />
      )}
    </section>
  );
}

function RecipientRow({ found: f, sent, picked, onToggle }: {
  found: Found;
  sent: Contact[];
  picked: boolean;
  onToggle: (uid: string) => void;
}) {
  const name = f.user.displayName || `${f.user.uid.slice(0, 10)}…`;
  const meta = [f.user.state && provinceName(f.user.state), f.user.lastSeen ? lastSeenLabel(f.user.lastSeen) : '', `từ ${f.by.map(b => b.label).join(', ')}`].filter(Boolean).join(' · ');
  const sentCount = sent.reduce((n, c) => n + c.count, 0);
  return (
    <label
      title={`${f.via}${f.user.level ? ` · cấp ${f.user.level}` : ''}`}
      className={cn('flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-raised', !picked && 'opacity-60')}
    >
      <Checkbox hue="sky" checked={picked} onChange={() => onToggle(f.user.uid)} aria-label={`Chọn ${name}`} />
      <Avatar name={name} photo={f.user.photoURL} seed={f.user.uid} size={32} ring="var(--surface)" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1 text-sm font-semibold text-fg">
          <span className="truncate">{name}</span>
          {f.user.isVip && <Badge tone="warn" className="h-4 px-1.5">VIP</Badge>}
          {f.user.verified && <Icon name="badgeCheck" size={13} className="text-link" label="Đã xác thực" />}
        </span>
        <span className="block truncate text-xs text-muted">{meta}</span>
      </span>
      {sentCount > 0 && (
        <Badge tone="ok" icon="check" title={`Đã nhắn: ${sent.map(c => `${c.accountLabel} (${c.count} tin, ${shortTime(c.lastSentAt)})`).join(', ')}`}>
          {sentCount}
        </Badge>
      )}
    </label>
  );
}
