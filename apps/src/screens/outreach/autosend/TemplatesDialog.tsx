import { useState } from 'react';
import { useSession } from '../../../lib/session.tsx';
import { Button, cn, EmptyState, Field, IconButton, Modal, Textarea, useToast } from '../../../ui/index.ts';

/** Add / edit / delete saved message texts (settings.json `messageTemplates`). */
export function TemplatesDialog({ onClose }: { onClose: () => void }) {
  const { settings, saveSettings } = useSession();
  const toast = useToast();
  const templates = settings.messageTemplates;
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (next: string[], done: string) => {
    setSaving(true);
    try {
      await saveSettings({ ...settings, messageTemplates: next });
      setError(null);
      toast({ tone: 'ok', message: done });
      return true;
    } catch (e) {
      setError(String((e as Error).message ?? e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    const next = editing === null ? [...templates, text] : templates.map((t, i) => (i === editing ? text : t));
    if (await save(next, editing === null ? 'Đã thêm mẫu tin' : 'Đã lưu mẫu tin')) {
      setDraft('');
      setEditing(null);
    }
  };

  const cancelEdit = () => { setEditing(null); setDraft(''); };

  return (
    <Modal
      title="Tin nhắn mẫu"
      description="Dùng cho “Ngẫu nhiên từ mẫu” khi auto gửi và nút mẫu trong ô chat."
      size="lg"
      onClose={onClose}
      footer={<Button variant="ghost" onClick={onClose}>Đóng</Button>}
    >
      {templates.length ? (
        <ol className="flex flex-col gap-1.5">
          {templates.map((t, i) => (
            <li key={i} className={cn('flex items-start gap-2 rounded-md border bg-bg px-3 py-2', editing === i ? 'border-accent' : 'border-line')}>
              <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold tabular-nums text-muted">{i + 1}.</span>
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">{t}</p>
              <IconButton icon="pencil" label={`Sửa mẫu ${i + 1}`} size="sm" variant="ghost" disabled={saving} onClick={() => { setEditing(i); setDraft(t); }} />
              <IconButton
                icon="trash"
                label={`Xoá mẫu ${i + 1}`}
                size="sm"
                variant="danger"
                disabled={saving}
                onClick={() => { if (editing === i) cancelEdit(); void save(templates.filter((_, j) => j !== i), 'Đã xoá mẫu tin'); }}
              />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState compact icon="template" title="Chưa có mẫu nào">Thêm các câu hay dùng; auto gửi có thể chọn ngẫu nhiên giữa các mẫu.</EmptyState>
      )}

      <Field label={editing === null ? 'Thêm mẫu mới' : `Sửa mẫu ${editing + 1}`} error={error}>
        <Textarea rows={3} maxLength={4000} placeholder="Nội dung mẫu" value={draft} onChange={e => setDraft(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" icon={editing === null ? 'plus' : 'check'} loading={saving} disabled={!draft.trim()} onClick={() => void submit()}>
          {editing === null ? 'Thêm mẫu' : 'Lưu thay đổi'}
        </Button>
        {editing !== null && <Button variant="ghost" onClick={cancelEdit}>Huỷ sửa</Button>}
      </div>
    </Modal>
  );
}
