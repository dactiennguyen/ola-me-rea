import { useEffect, useState } from 'react';
import { useSession } from '../lib/session.tsx';
import { Badge, Button, Field, NumberInput, Switch, Textarea, useToast } from '../ui/index.ts';

const MAX_LENGTH = 4000;

/**
 * Cài đặt › Tự động trả lời. Edits apply with "Lưu thay đổi". The switch applies
 * at once: on also saves what the boxes show (that is what will be sent), off
 * changes nothing else.
 */
export function AutoReplyPanel() {
  const { settings, saveSettings, accounts, live } = useSession();
  const toast = useToast();
  const [text, setText] = useState(settings.autoReplyText);
  const [max, setMax] = useState(settings.autoReplyMaxPerPerson);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setText(settings.autoReplyText); }, [settings.autoReplyText]);
  useEffect(() => { setMax(settings.autoReplyMaxPerPerson); }, [settings.autoReplyMaxPerPerson]);

  const enabled = settings.autoReplyEnabled;
  const online = accounts.filter(a => live[a.id]?.status === 'ready').length;
  const dirty = text.trim() !== settings.autoReplyText || max !== settings.autoReplyMaxPerPerson;

  const save = async (autoReplyEnabled: boolean, done: string) => {
    if (autoReplyEnabled && !text.trim()) { setError('Nhập câu trả lời trước khi bật.'); return; }
    setError(null);
    await saveSettings({ ...settings, autoReplyEnabled, autoReplyText: text.trim(), autoReplyMaxPerPerson: max });
    toast({ tone: 'ok', message: done });
  };

  const toggle = async (on: boolean) => {
    if (on) { await save(true, 'Đã bật tự động trả lời'); return; }
    setError(null);
    await saveSettings({ ...settings, autoReplyEnabled: false });
    toast({ tone: 'ok', message: 'Đã tắt tự động trả lời' });
  };

  return (
    <section aria-label="Tự động trả lời" className="panel flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 text-lg">Tự động trả lời tin nhắn</h2>
        {settings.dryRunSends && enabled && <Badge tone="warn" icon="flask">Chế độ thử</Badge>}
        <Badge tone={enabled ? 'ok' : 'neutral'}>{enabled ? `Đang bật · ${online} nick` : 'Đang tắt'}</Badge>
        <Switch
          checked={enabled}
          label="Tự động trả lời tin nhắn"
          onChange={on => void toggle(on)}
        />
      </div>

      <Field label="Câu trả lời" error={error}>
        <Textarea
          rows={3}
          maxLength={MAX_LENGTH}
          placeholder="Ví dụ: Mình đang bận, sẽ trả lời bạn sau nhé!"
          value={text}
          onChange={e => { setText(e.target.value); setError(null); }}
        />
      </Field>

      <Field label="Số lần trả lời tối đa cho mỗi người" hint="Đã trả lời đủ số lần này thì lần sau người đó nhắn sẽ không trả lời nữa.">
        <NumberInput value={max} onChange={setMax} min={1} max={100} unit="lần" aria-label="Số lần trả lời tối đa cho mỗi người" />
      </Field>

      {dirty && (
        <div>
          <Button variant="primary" onClick={() => void save(enabled, 'Đã lưu')}>Lưu thay đổi</Button>
        </div>
      )}
    </section>
  );
}
