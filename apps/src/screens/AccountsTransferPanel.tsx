import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon.tsx';
import { exportAccounts, exportFileName, parseImport, planImport, type ImportPlan } from '../lib/accountsTransfer.ts';
import { saveExportFile } from '../lib/platform.ts';
import { useSession } from '../lib/session.tsx';

// Xuất / nhập danh sách tài khoản (lib/accountsTransfer.ts). Both carry
// passwords in plain text, like accounts.json.

export function AccountsTransferPanel({ onClose }: { onClose: () => void }) {
  const { accounts, importAccounts } = useSession();
  const [text, setText] = useState('');
  const [exported, setExported] = useState<string | null>(null);
  const [result, setResult] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => (text.trim() ? parseImport(text) : null), [text]);
  const plan = useMemo(() => (parsed ? planImport(accounts, parsed.accounts) : null), [accounts, parsed]);
  const changes = plan ? plan.added.length + plan.updated.length : 0;

  const doExport = async () => {
    setError(null);
    setExported(null);
    try {
      const path = await saveExportFile(exportFileName(), exportAccounts(accounts));
      setExported(path ?? 'đã tải file về');
    } catch (err) {
      setError(`Không xuất được file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const copyExport = () => {
    void navigator.clipboard.writeText(exportAccounts(accounts)).then(
      () => setExported('đã sao chép vào clipboard'),
      () => setError('Không sao chép được vào clipboard.'),
    );
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setError(null);
    if (file.size > 2_000_000) { setError('File quá lớn (tối đa 2 MB).'); return; }
    setText(await file.text());
  };

  const doImport = async () => {
    if (!parsed || !changes) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await importAccounts(parsed.accounts));
      setText('');
    } catch (err) {
      setError(`Không nhập được: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel form-grid" aria-label="Nhập và xuất tài khoản">
      <h2 className="panel-title">Nhập / xuất danh sách tài khoản</h2>

      <div className="span-2 transfer-block">
        <h3 className="transfer-title">Xuất</h3>
        <p className="muted small">
          Lưu {accounts.length} tài khoản (email, mật khẩu, tên, device ID) ra file JSON trong thư mục Downloads.
        </p>
        <p className="notice small"><Icon name="info" size={15} /> File chứa mật khẩu dạng chữ thường. Giữ kín, đừng gửi lên nơi công khai.</p>
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={!accounts.length} onClick={() => void doExport()}>Xuất ra file</button>
          <button type="button" className="btn btn-ghost" disabled={!accounts.length} onClick={copyExport}>Sao chép JSON</button>
          {exported && <span className="tone-ok small" role="status">Xong: <code className="break">{exported}</code></span>}
        </div>
      </div>

      <div className="span-2 transfer-block">
        <h3 className="transfer-title">Nhập</h3>
        <p className="muted small">
          Chọn file xuất từ app này, hoặc dán danh sách mỗi dòng một tài khoản <code>email|mật khẩu</code> (cũng nhận
          tab, <code>,</code>, <code>;</code> hoặc <code>:</code>). Email đã có trong danh sách thì cập nhật mật khẩu, giữ
          nguyên device ID; email mới được thêm vào.
        </p>
        <label className="btn btn-ghost btn-sm file-pick">
          <input type="file" accept=".json,.txt,.csv,application/json,text/plain" onChange={e => { void readFile(e.target.files?.[0]); e.target.value = ''; }} />
          Chọn file…
        </label>
        <textarea
          className="transfer-text"
          rows={6}
          spellCheck={false}
          placeholder={'a@example.com|matkhau1\nb@example.com|matkhau2'}
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); }}
        />
        {parsed && plan && (
          <p className="small" role="status">
            Sẽ thêm <b>{plan.added.length}</b>, cập nhật <b>{plan.updated.length}</b>, giữ nguyên {plan.unchanged}.
          </p>
        )}
        {parsed?.problems.length ? (
          <ul className="notice notice-bad small transfer-problems">
            {parsed.problems.slice(0, 8).map(p => <li key={p}>{p}</li>)}
            {parsed.problems.length > 8 && <li>… và {parsed.problems.length - 8} dòng khác</li>}
          </ul>
        ) : null}
        {result && (
          <p className="tone-ok small" role="status">
            Đã nhập: thêm {result.added.length}, cập nhật {result.updated.length}, giữ nguyên {result.unchanged}.
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={busy || !changes} onClick={() => void doImport()}>Nhập vào danh sách</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
      {error && <p className="notice notice-bad small span-2" role="alert">{error}</p>}
    </section>
  );
}
