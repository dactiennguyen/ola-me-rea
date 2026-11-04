import { useCallback, useEffect, useState } from 'react';
import { onSentLogged, recentSent, sentContacts, type Contact, type SentRow } from '../../lib/sentLog.ts';

/** How many recent rows the history dialog shows. */
const RECENT_LIMIT = 100;

export interface SentHistory {
  /** peerUid → per-account contact summary (real sends only, not dry runs). */
  contacts: Map<string, Contact[]>;
  /** Newest sent rows, all screens. */
  recent: SentRow[];
  error: string | null;
}

/** The SQLite sent log (messages.db), reloaded after every logged send. */
export function useSentHistory(): SentHistory {
  const [contacts, setContacts] = useState<Map<string, Contact[]>>(new Map());
  const [recent, setRecent] = useState<SentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    Promise.all([sentContacts(), recentSent(RECENT_LIMIT)])
      .then(([list, rows]) => {
        const map = new Map<string, Contact[]>();
        for (const c of list) map.set(c.peerUid, [...(map.get(c.peerUid) ?? []), c]);
        setContacts(map);
        setRecent(rows);
        setError(null);
      })
      .catch(e => setError(String((e as Error).message ?? e)));
  }, []);

  useEffect(() => { reload(); return onSentLogged(reload); }, [reload]);
  return { contacts, recent, error };
}
