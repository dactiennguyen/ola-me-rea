// Tìm người & nhắn: collect people from Khám phá or chat rooms with one or more
// signed-in nicks (left), tick who gets a message, and auto-send it (right).
// Every send is logged in SQLite (messages.db) like a message sent by hand.

import { useCallback, useMemo, useState } from 'react';
import { provinceName } from '../../lib/provinces.ts';
import { useSession } from '../../lib/session.tsx';
import { useToast } from '../../ui/index.ts';
import { AutoSendPanel } from './autosend/AutoSendPanel.tsx';
import { CollectPanel } from './CollectPanel.tsx';
import { exportUsers, type ExportFormat } from './exportUsers.ts';
import { RecipientList } from './RecipientList.tsx';
import type { Nick } from './types.ts';
import { useCollector } from './useCollector.ts';
import { useSentHistory } from './useSentHistory.ts';

export function OutreachScreen({ hidden }: { hidden: boolean }) {
  const { accounts, live } = useSession();
  const toast = useToast();

  const online = useMemo<Nick[]>(() => accounts
    .filter(a => live[a.id]?.status === 'ready')
    .map(a => ({ id: a.id, label: a.label || live[a.id]?.me?.displayName || a.email })), [accounts, live]);
  const clientFor = useCallback((id: string) => live[id]?.ola ?? null, [live]);

  const collector = useCollector({ online, clientFor });
  const history = useSentHistory();

  // ---- list filters
  const [query, setQuery] = useState('');
  const [hideContacted, setHideContacted] = useState(false);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return collector.found.filter(f => (!hideContacted || !history.contacts.has(f.user.uid))
      && (!q || f.user.displayName.toLowerCase().includes(q) || f.user.uid.toLowerCase().includes(q)
        || provinceName(f.user.state).toLowerCase().includes(q)));
  }, [collector.found, query, hideContacted, history.contacts]);

  // ---- who gets the message: everyone shown, minus the unticked
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const picked = useMemo(() => shown.filter(f => !excluded.has(f.user.uid)), [shown, excluded]);
  const recipients = useMemo(() => picked.map(f => f.user), [picked]);
  const toggle = (uid: string) => setExcluded(s => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });

  const onExport = async (format: ExportFormat) => {
    try {
      const path = await exportUsers(shown, history.contacts, format);
      toast({ tone: 'ok', message: `Đã xuất ${shown.length} người: ${path ?? 'đã tải file về'}` });
    } catch (e) {
      toast({ tone: 'bad', message: `Không xuất được: ${(e as Error).message ?? e}` });
    }
  };

  const onClear = () => {
    const n = collector.found.length;
    collector.clear();
    setExcluded(new Set());
    toast({ tone: 'info', message: `Đã xoá danh sách ${n} người.` });
  };

  return (
    <div hidden={hidden} className="flex min-w-0 flex-1">
      <aside className="flex min-h-0 w-[360px] shrink-0 flex-col border-r border-line bg-surface">
        <CollectPanel collector={collector} online={online} />
        <RecipientList
          found={collector.found}
          shown={shown}
          contacts={history.contacts}
          query={query}
          onQuery={setQuery}
          hideContacted={hideContacted}
          onHideContacted={setHideContacted}
          isPicked={uid => !excluded.has(uid)}
          pickedCount={picked.length}
          onToggle={toggle}
          onSelectAll={() => setExcluded(new Set())}
          onSelectNone={() => setExcluded(new Set(shown.map(f => f.user.uid)))}
          onExport={format => void onExport(format)}
          onClear={onClear}
          busy={collector.running}
        />
      </aside>
      <AutoSendPanel
        recipients={recipients}
        listCount={shown.length}
        contacts={history.contacts}
        online={online}
        recent={history.recent}
        historyError={history.error}
      />
    </div>
  );
}
