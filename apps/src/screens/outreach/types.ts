import type { ChatUser } from '@ola/core/chat.ts';

/** Where people are collected from. */
export type Source = 'explore' | 'room';

/** A signed-in account usable for collecting or sending. */
export interface Nick { id: string; label: string }

/** One collected person. */
export interface Found {
  user: ChatUser;
  /** Accounts whose list contained this person. */
  by: Nick[];
  /** Where it was found first, e.g. "Khám phá · Online · Nữ · Hà Nội". */
  via: string;
}

/** A one-line status with a tone, shown next to an action. */
export interface StatusText { text: string; tone: 'idle' | 'ok' | 'warn' | 'bad' }
