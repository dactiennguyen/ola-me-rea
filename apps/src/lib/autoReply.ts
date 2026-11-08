// Tự trả lời: who gets an automatic reply. No React and no network here; the
// sending is in screens/AutoReplyRunner.tsx. Counts are per nick and per person,
// and are kept on disk so a person who reached the limit stays there after a restart.

import type { ChatMessage } from '@ola/core/chat.ts';
import { openJsonFile } from './platform.ts';

/** `source` column of every automatic reply in messages.db. */
export const AUTO_REPLY_SOURCE = 'auto-reply';

/** Older than this, the message is a replay, not someone waiting. Generous: the time comes from the sender's clock. */
export const MAX_MESSAGE_AGE_MS = 10 * 60_000;
/** Never answer the same person twice within this gap, whatever the limit. */
export const MIN_GAP_MS = 60_000;
/** Per nick. Stops a burst (or another bot) from making a nick send without end. */
export const MAX_REPLIES_PER_HOUR = 30;
/** Wait before replying, so it does not arrive the instant the message does. */
export const DELAY_MIN_MS = 5_000;
export const DELAY_MAX_MS = 15_000;

const SEEN_LIMIT = 2_000;
const HOUR_MS = 3_600_000;

export type ReplyCounts = Record<string, { count: number; lastAt: number }>;
export type SkipReason = 'not-text' | 'own-nick' | 'stale' | 'duplicate' | 'limit-reached' | 'too-soon' | 'hourly-limit';

export function randomDelayMs(random = Math.random): number {
  return Math.round(DELAY_MIN_MS + random() * (DELAY_MAX_MS - DELAY_MIN_MS));
}

export class AutoReplyPolicy {
  /** Replies really delivered: what is kept on disk. */
  #counts: ReplyCounts;
  #persist: (counts: ReplyCounts) => void;
  /** Replies decided but not sent yet (the delay, the send). Memory only, so quitting loses nothing. */
  #inFlight = new Map<string, number>();
  #claimedAt = new Map<string, number>();
  #seen = new Set<string>();
  #sends = new Map<string, number[]>();

  constructor(counts: ReplyCounts, persist: (counts: ReplyCounts) => void) {
    this.#counts = counts;
    this.#persist = persist;
  }

  /**
   * Decides on one incoming message. null = reply, and the reply is reserved,
   * so a second message arriving during the delay cannot get one too. Follow
   * with confirm() once delivered, or release() if nothing was delivered.
   */
  claim({ accountId, message, maxPerPerson, ownUids, now }: {
    accountId: string;
    message: Pick<ChatMessage, 'id' | 'fromUid' | 'kind' | 'at'>;
    maxPerPerson: number;
    ownUids: ReadonlySet<string>;
    now: number;
  }): SkipReason | null {
    const seenKey = `${accountId}|${message.id}`;
    if (this.#seen.has(seenKey)) return 'duplicate';
    this.#seen.add(seenKey);
    if (this.#seen.size > SEEN_LIMIT) this.#seen.delete(this.#seen.values().next().value as string);

    if (message.kind !== 'text') return 'not-text';
    if (ownUids.has(message.fromUid)) return 'own-nick';
    if (message.at < now - MAX_MESSAGE_AGE_MS) return 'stale';

    const key = `${accountId}|${message.fromUid}`;
    const entry = this.#counts[key];
    const flying = this.#inFlight.get(key) ?? 0;
    if ((entry?.count ?? 0) + flying >= maxPerPerson) return 'limit-reached';
    if (now - Math.max(entry?.lastAt ?? 0, this.#claimedAt.get(key) ?? 0) < MIN_GAP_MS) return 'too-soon';

    const sends = (this.#sends.get(accountId) ?? []).filter(at => at > now - HOUR_MS);
    if (sends.length >= MAX_REPLIES_PER_HOUR) return 'hourly-limit';

    this.#sends.set(accountId, [...sends, now]);
    this.#inFlight.set(key, flying + 1);
    this.#claimedAt.set(key, now);
    return null;
  }

  #land(key: string) {
    const flying = (this.#inFlight.get(key) ?? 0) - 1;
    if (flying > 0) this.#inFlight.set(key, flying);
    else this.#inFlight.delete(key);
  }

  /** The reserved reply was delivered: it now counts, for good. */
  confirm(accountId: string, peerUid: string, now: number): void {
    const key = `${accountId}|${peerUid}`;
    this.#land(key);
    this.#counts[key] = { count: (this.#counts[key]?.count ?? 0) + 1, lastAt: now };
    this.#persist(this.#counts);
  }

  /** The reserved reply was not delivered: gives it back. */
  release(accountId: string, peerUid: string): void {
    const key = `${accountId}|${peerUid}`;
    this.#land(key);
    this.#claimedAt.delete(key);
    this.#sends.get(accountId)?.pop();
  }
}

const FILE = 'auto-reply.json';

export async function loadReplyCounts(): Promise<ReplyCounts> {
  const file = await openJsonFile(FILE);
  const saved = (await file.get<ReplyCounts>('counts')) ?? {};
  return Object.fromEntries(Object.entries(saved).filter(([, e]) => Number.isInteger(e?.count) && typeof e?.lastAt === 'number'));
}

export async function saveReplyCounts(counts: ReplyCounts): Promise<void> {
  const file = await openJsonFile(FILE);
  await file.set('counts', counts);
  await file.save();
}
