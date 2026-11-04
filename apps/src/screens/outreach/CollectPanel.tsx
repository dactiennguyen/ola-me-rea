import { Icon, type IconName } from '../../components/Icon.tsx';
import { PROVINCES, provinceName } from '../../lib/provinces.ts';
import { Button, cn, Field, NumberInput, Segmented, Select, Spinner, Tag, ToggleChip } from '../../ui/index.ts';
import { GENDERS, TABS, type Gender, type Tab } from '../ExploreScreen.tsx';
import type { Nick, Source, StatusText } from './types.ts';
import { MAX_PAGES, type Collector } from './useCollector.ts';

const SOURCES: { value: Source; label: string }[] = [
  { value: 'explore', label: 'Khám phá' },
  { value: 'room', label: 'Phòng chat' },
];

/** Where to collect from, with which nicks, and the Lấy/Dừng action. */
export function CollectPanel({ collector, online }: { collector: Collector; online: Nick[] }) {
  const { filters: f, update, running } = collector;
  return (
    <section aria-label="Lấy danh sách người dùng" className="flex flex-col gap-3 border-b border-line p-4">
      <h1 className="text-lg">Tìm người &amp; nhắn</h1>

      <Segmented
        label="Nguồn"
        value={f.source}
        onChange={source => update({ source })}
        disabled={running}
        options={SOURCES}
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
      />

      {f.source === 'explore' ? (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Mục">
            <Select value={f.tab} disabled={running} onChange={e => update({ tab: e.target.value as Tab })}>
              {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Giới tính">
            <Select value={String(f.gender)} disabled={running} onChange={e => update({ gender: e.target.value === 'all' ? 'all' : Number(e.target.value) as Gender })}>
              {GENDERS.map(g => <option key={String(g.value)} value={String(g.value)}>{g.value === 'all' ? 'Mọi giới tính' : g.label}</option>)}
            </Select>
          </Field>
          <Field label="Tỉnh">
            <Select value={f.city} disabled={running} onChange={e => update({ city: e.target.value })}>
              <option value="all">Mọi tỉnh</option>
              {PROVINCES.map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Số trang mỗi nick">
            <NumberInput value={f.pages} onChange={pages => update({ pages })} min={1} max={MAX_PAGES} unit="trang" disabled={running} aria-label="Số trang mỗi nick" />
          </Field>
        </div>
      ) : (
        <Field as="div" label="Phòng chat" hint="Lấy hết thành viên của từng phòng (không giới hạn trang).">
          <Select
            value=""
            aria-label="Thêm phòng"
            disabled={running}
            onChange={e => { const code = e.target.value; if (code && !f.rooms.includes(code)) update({ rooms: [...f.rooms, code] }); }}
          >
            <option value="">+ Thêm phòng…</option>
            {PROVINCES.filter(p => !f.rooms.includes(p.code)).map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </Select>
          {f.rooms.length ? (
            <div className="flex flex-wrap gap-1.5">
              {f.rooms.map(code => (
                <Tag key={code} removeLabel={`Bỏ phòng ${provinceName(code)}`} disabled={running} onRemove={() => update({ rooms: f.rooms.filter(x => x !== code) })}>
                  {provinceName(code)}
                </Tag>
              ))}
            </div>
          ) : <span className="text-xs text-warn">Chọn ít nhất một phòng.</span>}
        </Field>
      )}

      <Field as="div" label="Lấy bằng nick">
        {online.length ? (
          <div className="flex flex-wrap gap-1.5">
            {online.map(a => (
              <ToggleChip key={a.id} pressed={collector.nicks.includes(a.id)} disabled={running} onPressedChange={() => collector.toggleNick(a.id)}>
                {a.label}
              </ToggleChip>
            ))}
          </div>
        ) : <span className="text-xs text-warn">Đăng nhập ít nhất một nick để lấy danh sách.</span>}
      </Field>

      {running
        ? <Button variant="danger" block icon="stop" onClick={collector.stop}>Dừng lấy</Button>
        : <Button variant="primary" block icon="download" disabled={!collector.canCollect} onClick={() => void collector.collect()}>Lấy danh sách</Button>}
      {collector.status && <StatusLine status={collector.status} busy={running} />}
    </section>
  );
}

const STATUS_ICON: Record<StatusText['tone'], IconName> = { idle: 'info', ok: 'circleCheck', warn: 'alert', bad: 'circleX' };
const STATUS_COLOR: Record<StatusText['tone'], string> = { idle: 'text-muted', ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' };

function StatusLine({ status, busy }: { status: StatusText; busy: boolean }) {
  return (
    <p role="status" title={status.text} className={cn('flex min-w-0 items-center gap-1.5 text-xs', STATUS_COLOR[status.tone])}>
      {busy ? <Spinner size={12} /> : <Icon name={STATUS_ICON[status.tone]} size={13} />}
      <span className="truncate">{status.text}</span>
    </p>
  );
}
