import { useEffect, useRef, useState } from 'react';
import { loadRoomMembers, normalizeUser, type ChatUser } from '@ola/core/chat.ts';
import type { OlaClient } from '@ola/core/client.ts';
import type { ExploreNext, ExploreResult } from '@ola/core/endpoints/_explore.ts';
import { provinceName } from '../../lib/provinces.ts';
import { ENDPOINT, GENDERS, TABS, type Gender, type Tab } from '../ExploreScreen.tsx';
import type { Found, Nick, Source, StatusText } from './types.ts';

export const MAX_PAGES = 50;
/** Pause between page requests so collecting stays gentle on the server. */
const PAGE_PAUSE_MS = 400;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface CollectFilters {
  source: Source;
  tab: Tab;
  gender: Gender;
  /** Province code or 'all' (Khám phá). */
  city: string;
  /** Province codes of the rooms (Phòng chat). */
  rooms: string[];
  /** Pages per nick (Khám phá only; rooms are read to the end). */
  pages: number;
}

const DEFAULT_FILTERS: CollectFilters = { source: 'explore', tab: 'online', gender: 'all', city: 'all', rooms: ['79'], pages: 3 };

/** "Khám phá · Online · Nữ · Hà Nội" — where a person was found. */
function describeExplore(f: CollectFilters): string {
  return ['Khám phá', TABS.find(t => t.id === f.tab)!.label,
    f.gender !== 'all' && GENDERS.find(g => g.value === f.gender)!.label,
    f.city !== 'all' && provinceName(f.city)].filter(Boolean).join(' · ');
}

/**
 * Collects people from Khám phá or chat rooms with one or more signed-in nicks
 * into one list, de-duplicated by uid (each person remembers which nicks saw them).
 */
export function useCollector({ online, clientFor }: {
  online: Nick[];
  clientFor: (id: string) => OlaClient | null;
}) {
  const [filters, setFilters] = useState<CollectFilters>(DEFAULT_FILTERS);
  const [fetchWith, setFetchWith] = useState<string[]>([]);
  const [found, setFound] = useState<Found[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<StatusText | null>(null);
  const cancel = useRef(false);
  // The list also lives in a ref: merge() counts new people synchronously, which
  // a setState updater cannot do (StrictMode runs updaters twice).
  const foundRef = useRef<Found[]>([]);
  const setList = (next: Found[]) => { foundRef.current = next; setFound(next); };

  // Nicks that went offline cannot collect; default to the first online one.
  const nicks = fetchWith.filter(id => online.some(a => a.id === id));
  useEffect(() => {
    if (!nicks.length && online[0]) setFetchWith([online[0].id]);
  }, [online, nicks.length]);

  const update = (patch: Partial<CollectFilters>) => setFilters(f => ({ ...f, ...patch }));
  const toggleNick = (id: string) => setFetchWith(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]));

  /** Adds people; returns how many were new. */
  const merge = (users: ChatUser[], by: Nick, where: string) => {
    let added = 0;
    const next = [...foundRef.current];
    const index = new Map(next.map((f, i) => [f.user.uid, i]));
    for (const user of users) {
      const i = index.get(user.uid);
      if (i === undefined) {
        index.set(user.uid, next.length);
        next.push({ user, by: [by], via: where });
        added++;
      } else if (!next[i]!.by.some(b => b.id === by.id)) {
        next[i] = { ...next[i]!, by: [...next[i]!.by, by] };
      }
    }
    setList(next);
    return added;
  };

  const collect = async () => {
    const f = filters;
    cancel.current = false;
    setRunning(true);
    setList([]); // each run starts a fresh list; several nicks in the run merge into it
    let total = 0;
    let failed = '';
    try {
      for (const id of nicks) {
        if (cancel.current) break;
        const ola = clientFor(id);
        if (!ola) continue;
        const by = online.find(a => a.id === id) ?? { id, label: id, color: 'var(--muted)' };
        try {
          if (f.source === 'explore') {
            const where = describeExplore(f);
            let next: ExploreNext | null = null;
            for (let page = 0; page < f.pages && !cancel.current; page++) {
              setStatus({ text: `Trang ${page + 1}/${f.pages} · ${by.label} · ${total} người`, tone: 'idle' });
              const input = page === 0
                ? { page: 0, ...(f.gender !== 'all' && { gender: f.gender }), ...(f.city !== 'all' && { cityID: f.city }) }
                : next!;
              const result: ExploreResult = await ola.call(ENDPOINT[f.tab], input);
              const users = result.items.map(item => normalizeUser(item)).filter(u => u.uid);
              next = result.next;
              total += merge(users, by, where);
              if (!users.length || !next) break;
              await sleep(PAGE_PAUSE_MS);
            }
          } else {
            // Rooms: read every page of each chosen room until one comes back empty.
            for (const code of f.rooms) {
              if (cancel.current) break;
              const where = `Phòng ${provinceName(code)}`;
              for (let page = 0; page < MAX_PAGES && !cancel.current; page++) {
                setStatus({ text: `${where} · trang ${page + 1} · ${by.label} · ${total} người`, tone: 'idle' });
                const users = (await loadRoomMembers(ola, code, page)).filter(u => u.uid);
                total += merge(users, by, where);
                if (!users.length) break;
                await sleep(PAGE_PAUSE_MS);
              }
            }
          }
        } catch (e) {
          failed = `${by.label}: ${(e as Error).message}`;
        }
      }
      setStatus(cancel.current
        ? { text: `Đã dừng · lấy được ${total} người`, tone: 'warn' }
        : failed
          ? { text: `Lấy được ${total} người · lỗi ${failed}`, tone: 'bad' }
          : { text: `Xong · lấy được ${total} người`, tone: 'ok' });
    } finally {
      setRunning(false);
    }
  };

  const canCollect = nicks.length > 0 && (filters.source === 'explore' || filters.rooms.length > 0);

  return {
    filters, update,
    nicks, toggleNick,
    found, running, status, canCollect,
    collect,
    stop: () => { cancel.current = true; },
    clear: () => { setList([]); setStatus(null); },
  };
}

export type Collector = ReturnType<typeof useCollector>;
