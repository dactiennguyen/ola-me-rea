import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import type { ChatUser } from '@ola/core/chat.ts';
import { Avatar } from '../../../components/Avatar.tsx';
import { Icon } from '../../../components/Icon.tsx';
import type { Contact, SentRow } from '../../../lib/sentLog.ts';
import { useSession } from '../../../lib/session.tsx';
import {
  Badge, Button, Checkbox, cn, EmptyState, Eyebrow, Field, Modal, Notice, NumberInput, ProgressBar,
  Segmented, Textarea, ToggleChip, useToast,
} from '../../../ui/index.ts';
import type { Nick, StatusText } from '../types.ts';
import { estimateSeconds, formatDuration, messagesPerMinute, type Sender } from './engine.ts';
import { HistoryDialog } from './HistoryDialog.tsx';
import { SendLog } from './SendLog.tsx';
import { TemplatesDialog } from './TemplatesDialog.tsx';
import { useAutoSend } from './useAutoSend.ts';

type MessageMode = 'single' | 'random';
type Dialog = 'history' | 'templates' | 'confirm' | null;

const NOTICE_TONE = { idle: 'info', ok: 'ok', warn: 'warn', bad: 'bad' } as const;

/**
 * Auto gửi composer. Left: 4 numbered steps (who, from which nicks, what, how
 * fast). Right: preview, progress, the send log and the one main action.
 */
export function AutoSendPanel({ recipients, listCount, contacts, online, recent, historyError }: {
  /** People ticked in the list. */
  recipients: ChatUser[];
  /** People shown in the list (after its filters). */
  listCount: number;
  contacts: Map<string, Contact[]>;
  online: Nick[];
  recent: SentRow[];
  historyError: string | null;
}) {
  const { live, settings, openChannel } = useSession();
  const toast = useToast();
  const dryRun = settings.dryRunSends;
  const templates = settings.messageTemplates;
  const engine = useAutoSend({ dryRun, openChannel });
  const locked = engine.running;
  const [dialog, setDialog] = useState<Dialog>(null);
  const skippedId = useId();

  // ① recipients
  const [skipContacted, setSkipContacted] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);
  const [cap, setCap] = useState(0); // 0 = everyone
  const skipped = useMemo(() => (skipContacted ? recipients.filter(u => contacts.has(u.uid)) : []), [recipients, skipContacted, contacts]);
  const eligible = useMemo(() => (skipContacted ? recipients.filter(u => !contacts.has(u.uid)) : recipients), [recipients, skipContacted, contacts]);
  const targets = useMemo(() => (cap > 0 ? eligible.slice(0, cap) : eligible), [eligible, cap]);

  // ② sender nicks: all online by default; a nick that goes offline drops out
  const [senderIds, setSenderIds] = useState<string[]>([]);
  useEffect(() => {
    const ids = online.map(o => o.id);
    setSenderIds(prev => {
      const kept = prev.filter(id => ids.includes(id));
      const next = kept.length ? kept : ids;
      return next.length === prev.length && next.every((v, i) => v === prev[i]) ? prev : next;
    });
  }, [online]);
  const senders = useMemo(() => senderIds.filter(id => live[id]?.status === 'ready' && live[id]?.ola && live[id]?.me), [senderIds, live]);
  const nickNames = senders.map(id => online.find(o => o.id === id)?.label ?? id);

  // ③ message: one text, or a random pick from the ticked templates
  const [mode, setMode] = useState<MessageMode>('single');
  const [text, setText] = useState('');
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  useEffect(() => { setTicked(new Set(templates.map((_, i) => i))); }, [templates]);
  const pool = useMemo(() => templates.filter((_, i) => ticked.has(i)).map(t => t.trim()).filter(Boolean), [templates, ticked]);
  const hasMessage = mode === 'single' ? Boolean(text.trim()) : pool.length > 0;

  // ④ pace
  const [delaySec, setDelaySec] = useState(1);

  const reason = !targets.length
    ? (recipients.length
      ? 'Mọi người đã tick đều đã được nhắn trước đây. Bỏ tick “Bỏ qua người đã được nhắn” nếu muốn gửi lại.'
      : 'Chưa có người nhận: bấm “Lấy danh sách” ở cột trái rồi tick người cần gửi.')
    : !senders.length ? 'Chọn ít nhất một nick đang online ở bước 2.'
      : !hasMessage ? (mode === 'single' ? 'Nhập nội dung tin nhắn ở bước 3.' : 'Tick ít nhất một mẫu tin ở bước 3.')
        : null;

  const { progress } = engine;
  const plannedCount = locked ? progress.total : targets.length;
  const estimate = estimateSeconds(plannedCount, delaySec, dryRun);
  const previewText = progress.current?.text ?? (mode === 'single' ? text.trim() : pool[0] ?? '');

  const run = async () => {
    setDialog(null);
    const job = {
      senders: senders.map((id): Sender => ({ id, label: online.find(o => o.id === id)?.label ?? id, ola: live[id]!.ola!, me: live[id]!.me! })),
      targets,
      delaySec,
      pickText: mode === 'single'
        ? () => text.trim()
        : () => pool[Math.floor(Math.random() * pool.length)] ?? '',
    };
    const summary = await engine.start(job);
    toast({ tone: NOTICE_TONE[summary.tone], message: summary.text });
  };
  // Real sends cannot be taken back: confirm first. Dry runs start right away.
  const onStart = () => { if (!reason) { if (dryRun) void run(); else setDialog('confirm'); } };

  return (
    <main aria-label="Auto gửi" className="@container flex min-h-0 min-w-0 flex-1 bg-bg">
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto @3xl:grid-cols-[minmax(320px,1.1fr)_minmax(300px,0.9fr)] @3xl:overflow-hidden">

        {/* ---------------- configuration ---------------- */}
        <div className="flex min-w-0 flex-col @3xl:min-h-0 @3xl:overflow-y-auto">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-bg/95 px-5 py-3 backdrop-blur">
            <h2 className="text-lg">Auto gửi</h2>
            {dryRun && <Badge tone="warn" icon="flask" title="Cài đặt › Chế độ thử: tin chỉ lưu trên máy, không gửi lên server">Chế độ thử</Badge>}
            <span className="flex-1" />
            <Button size="sm" variant="ghost" icon="template" onClick={() => setDialog('templates')}>Mẫu tin</Button>
            <Button size="sm" variant="ghost" icon="history" onClick={() => setDialog('history')}>Lịch sử</Button>
          </header>

          <ol className="flex flex-col px-5 pb-6">
            <Step n={1} title="Người nhận" done={targets.length > 0} meta={`${targets.length} người`}>
              <p className="text-sm text-soft">
                Sẽ gửi tới <strong className="tabular-nums text-strong">{targets.length}</strong> người
                <span className="text-muted"> · đã tick {recipients.length}/{listCount} trong danh sách</span>
              </p>
              <Checkbox checked={skipContacted} onChange={setSkipContacted} disabled={locked}>Bỏ qua người đã được nhắn trước đây</Checkbox>
              {skipContacted && skipped.length > 0 && (
                <div className="rounded-md border border-line bg-surface">
                  <button
                    type="button"
                    aria-expanded={showSkipped}
                    aria-controls={skippedId}
                    onClick={() => setShowSkipped(v => !v)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-accent-text hover:bg-raised"
                  >
                    <Icon name={showSkipped ? 'chevronDown' : 'chevronRight'} size={14} />
                    {skipped.length} người bị bỏ qua vì đã được nhắn
                    <span className="ml-auto font-normal text-muted">{showSkipped ? 'Ẩn' : 'Xem'}</span>
                  </button>
                  {showSkipped && (
                    <ul id={skippedId} className="max-h-48 overflow-y-auto border-t border-line p-1">
                      {skipped.map(u => {
                        const sent = contacts.get(u.uid) ?? [];
                        const count = sent.reduce((n, c) => n + c.count, 0);
                        return (
                          <li key={u.uid} className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-raised">
                            <Avatar name={u.displayName || u.uid} photo={u.photoURL} seed={u.uid} size={24} ring="var(--surface)" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{u.displayName || `${u.uid.slice(0, 10)}…`}</span>
                              <span className="block truncate text-xs text-muted">đã nhắn bởi {sent.map(c => c.accountLabel).join(', ') || '—'} · {count} tin</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              <Field label="Gửi tối đa" hint={cap > 0 && eligible.length > cap ? `Gửi ${cap} người đầu danh sách, bỏ qua ${eligible.length - cap} người còn lại.` : 'Để trống = gửi hết.'}>
                <NumberInput
                  value={cap}
                  onChange={setCap}
                  min={0}
                  max={eligible.length > 0 ? eligible.length : undefined}
                  emptyMeansZero
                  placeholder="Tất cả"
                  unit="người"
                  className="w-20"
                  disabled={locked}
                  aria-label="Gửi tối đa bao nhiêu người"
                />
              </Field>
            </Step>

            <Step n={2} title="Gửi bằng nick" done={senders.length > 0} meta={`${senders.length} nick`}>
              {online.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {online.map(o => (
                    <ToggleChip
                      key={o.id}
                      pressed={senderIds.includes(o.id)}
                      disabled={locked}
                      onPressedChange={on => setSenderIds(ids => (on ? [...ids, o.id] : ids.filter(x => x !== o.id)))}
                    >
                      {o.label}
                    </ToggleChip>
                  ))}
                </div>
              ) : <Notice tone="warn">Chưa có nick nào online — đăng nhập ở cột tài khoản bên trái.</Notice>}
              {nickNames.length > 1 && (
                <p className="text-xs text-muted">Các nick gửi lần lượt: tin 1 bằng {nickNames[0]}, tin 2 bằng {nickNames[1]}{nickNames.length > 2 ? ', …' : ''}</p>
              )}
            </Step>

            <Step n={3} title="Nội dung" done={hasMessage} meta={mode === 'single' ? '1 nội dung' : `${pool.length} mẫu`}>
              <Segmented
                label="Kiểu nội dung"
                value={mode}
                onChange={setMode}
                disabled={locked}
                className="self-start"
                options={[{ value: 'single', label: 'Một nội dung' }, { value: 'random', label: 'Ngẫu nhiên từ mẫu', count: templates.length }]}
              />
              {mode === 'single' ? (
                <Textarea rows={4} maxLength={4000} placeholder="Nội dung gửi cho mọi người" value={text} disabled={locked} onChange={e => setText(e.target.value)} aria-label="Nội dung tin nhắn" />
              ) : templates.length ? (
                <>
                  <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {templates.map((t, i) => (
                      <li key={i}>
                        <Checkbox
                          checked={ticked.has(i)}
                          disabled={locked}
                          onChange={on => setTicked(s => { const n = new Set(s); if (on) n.add(i); else n.delete(i); return n; })}
                          className="w-full items-start rounded-md border border-line bg-surface px-3 py-2"
                        >
                          <span className="whitespace-pre-wrap break-words text-sm">{t}</span>
                        </Checkbox>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted">Mỗi người nhận 1 mẫu ngẫu nhiên trong {pool.length} mẫu đã tick.</p>
                </>
              ) : (
                <EmptyState compact icon="template" title="Chưa có mẫu tin" action={<Button size="sm" icon="plus" onClick={() => setDialog('templates')}>Thêm mẫu</Button>} />
              )}
            </Step>

            <Step n={4} title="Giãn cách" done meta={`${delaySec} giây/tin`}>
              <Field label="Mỗi tin cách nhau" hint={`Khoảng ${messagesPerMinute(delaySec, dryRun)} tin/phút.`}>
                <NumberInput value={delaySec} onChange={setDelaySec} min={0} step={0.5} integer={false} unit="giây" disabled={locked} aria-label="Giãn cách giữa 2 tin (giây)" />
              </Field>
            </Step>
          </ol>
        </div>

        {/* ---------------- live: preview, progress, log, action ---------------- */}
        <div className="flex min-w-0 flex-col border-t border-line bg-surface @3xl:min-h-0 @3xl:border-l @3xl:border-t-0">
          <section aria-label="Xem trước" className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5">
            <Eyebrow>{progress.current ? 'Đang gửi' : 'Xem trước'}</Eyebrow>
            {progress.current && (
              <div className="flex items-center gap-2.5">
                <Avatar name={progress.current.name} photo={progress.current.photo} seed={progress.current.name} size={32} ring="var(--surface)" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-strong">{progress.current.name}</p>
                  <p className="truncate text-xs text-muted">qua {progress.current.nick}</p>
                </div>
              </div>
            )}
            {previewText ? (
              <p className="max-w-full self-end whitespace-pre-wrap break-words rounded-lg rounded-br-xs bg-accent px-3 py-2 text-sm text-on-accent">{previewText}</p>
            ) : (
              <p className="py-3 text-center text-sm text-muted">{mode === 'single' ? 'Nhập nội dung ở bước 3 để xem trước.' : 'Tick mẫu ở bước 3 để xem trước.'}</p>
            )}
            {mode === 'random' && !progress.current && previewText && <p className="self-end text-xs text-muted">Ví dụ mẫu đầu tiên · mỗi người nhận 1 mẫu ngẫu nhiên</p>}
            <div className="flex flex-wrap gap-1.5">
              <Badge icon="users">{plannedCount} người</Badge>
              <Badge icon="user">{senders.length} nick</Badge>
              <Badge icon="clock">{delaySec} giây/tin</Badge>
              {estimate > 0 && <Badge icon="history" title="Thời gian ước tính">≈ {formatDuration(estimate)}</Badge>}
            </div>
          </section>

          {(locked || progress.total > 0) && (
            <section aria-label="Tiến độ" className="flex flex-col gap-2 border-b border-line px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold tabular-nums text-strong">{progress.done}/{progress.total}</span>
                <span className="text-muted">tin đã xử lý</span>
                <span className="flex-1" />
                <Badge tone="ok" icon="circleCheck">{progress.ok} thành công</Badge>
                {progress.fail > 0 && <Badge tone="bad" icon="circleX">{progress.fail} lỗi</Badge>}
              </div>
              <ProgressBar label="Tiến độ gửi" value={progress.done} max={progress.total} tone={progress.fail ? 'warn' : locked ? 'accent' : 'ok'} />
            </section>
          )}

          <SendLog entries={engine.log} canClear={!locked} onClear={engine.clearLog} className="max-h-96 flex-1 @3xl:max-h-none" />

          <footer className="flex flex-col gap-2.5 border-t border-line px-4 py-3">
            {!locked && engine.result && <ResultNotice result={engine.result} />}
            {!locked && (reason
              ? <Notice tone="warn">{reason}</Notice>
              : (
                <p className="text-sm leading-normal text-soft">
                  Gửi tới <strong className="text-strong">{targets.length}</strong> người · mỗi tin cách <strong className="text-strong">{delaySec}</strong> giây ·
                  bằng <strong className="text-strong">{senders.length}</strong> nick ({nickNames.join(', ')}) ·{' '}
                  {mode === 'single' ? '1 nội dung' : `ngẫu nhiên ${pool.length} mẫu`}
                </p>
              ))}
            {locked ? (
              <Button variant="danger" size="lg" block icon="stop" loading={engine.stopping} onClick={engine.stop}>
                {engine.stopping ? 'Đang dừng…' : `Dừng gửi · ${progress.done}/${progress.total}`}
              </Button>
            ) : (
              <Button variant="primary" size="lg" block icon={dryRun ? 'flask' : 'send'} disabled={Boolean(reason)} onClick={onStart}>
                {dryRun ? `Chạy thử với ${targets.length} người` : `Bắt đầu gửi tới ${targets.length} người`}
              </Button>
            )}
          </footer>
        </div>
      </div>

      {dialog === 'confirm' && (
        <Modal
          title="Xác nhận gửi tin"
          onClose={() => setDialog(null)}
          footer={(
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>Huỷ</Button>
              <Button variant="primary" icon="send" onClick={() => void run()}>Gửi {targets.length} tin</Button>
            </>
          )}
        >
          <p className="text-sm leading-normal text-soft">
            Gửi tin thật tới <strong className="text-strong">{targets.length}</strong> người bằng{' '}
            <strong className="text-strong">{senders.length}</strong> nick ({nickNames.join(', ')}), mỗi tin cách {delaySec} giây —
            khoảng {formatDuration(estimateSeconds(targets.length, delaySec, dryRun))}.
          </p>
          <Notice tone="warn">Tin đã gửi không thu hồi được. Bạn có thể bấm “Dừng gửi” bất cứ lúc nào.</Notice>
        </Modal>
      )}
      {dialog === 'history' && <HistoryDialog rows={recent} error={historyError} onClose={() => setDialog(null)} />}
      {dialog === 'templates' && <TemplatesDialog onClose={() => setDialog(null)} />}
    </main>
  );
}

/** A numbered step of the composer; the number turns into a check once it is complete. */
function Step({ n, title, done, meta, children }: { n: number; title: string; done: boolean; meta?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2.5 border-t border-line py-4 first:border-t-0">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn('grid size-5.5 shrink-0 place-items-center rounded-full text-xs font-bold', done ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent-text')}
        >
          {done ? <Icon name="check" size={12} /> : n}
        </span>
        <h3 className="flex-1 truncate">{title}</h3>
        {meta && <span className="shrink-0 text-xs tabular-nums text-muted">{meta}</span>}
      </div>
      {children}
    </li>
  );
}

function ResultNotice({ result }: { result: StatusText }) {
  return <Notice tone={NOTICE_TONE[result.tone]}>{result.text}</Notice>;
}
