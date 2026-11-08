// Auto gửi engine: no React here. One send = the app's 1-1 flow (socket emit
// → push when the peer has an FCM token → addLastMessage5), recorded in the
// SQLite sent log exactly like a message sent by hand.

import { directMessagePayload, loadChatUser, localTextMessage, sendDirectMessage, type ChatChannel, type ChatMessage, type ChatProfile, type ChatUser } from '@ola/core/chat.ts';
import type { OlaClient } from '@ola/core/client.ts';
import { logSent } from '../../../lib/sentLog.ts';
import type { Nick } from '../types.ts';

/** `source` column of every auto-sent row in messages.db. */
export const AUTO_SOURCE = 'outreach-auto';
/** Time to wait for a fresh realtime channel to connect. */
const CONNECT_TIMEOUT_MS = 15_000;
/** Typical connect + send time of one message, for the estimate only. */
const SEND_SECONDS = 1.8;

/** A signed-in nick, captured when a run starts so a later state change cannot shift it. */
export interface Sender extends Nick { ola: OlaClient; me: ChatProfile }

export type SendStatus = 'ok' | 'fail' | 'dry';

/** One row of the send log (also used to show SQLite history). */
export interface SendLogEntry {
  id: string;
  at: number;
  peerUid: string;
  peerName: string;
  /** Label of the sending nick. */
  nick: string;
  /** The sending nick's identity color (account avatar color), when known. */
  nickColor?: string;
  text: string;
  status: SendStatus;
  /** true: push sent · false: push failed · null: no push (no FCM token, dry run or failed send). */
  pushOk: boolean | null;
  /** Partial failure ("lastMessage") or the error of a failed send. */
  note?: string;
  /** Where it was sent from, for history rows (messages, outreach, outreach-auto…). */
  source?: string;
}

export type OpenChannel = (accountId: string, roomNo: string, joinAs?: string) => ChatChannel | null;

/** Resolves once the channel connects; rejects after a timeout (it keeps retrying until then). */
export function connectChannel(channel: ChatChannel, timeoutMs = CONNECT_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    if (channel.connected) { resolve(); return; }
    const off = channel.onState(state => {
      if (state === 'connected') { off(); clearTimeout(timer); resolve(); }
    });
    const timer = setTimeout(() => { off(); reject(new Error('Hết thời gian chờ kết nối realtime.')); }, timeoutMs);
    channel.connect();
  });
}

/** sleep(ms) that returns early as soon as `cancel.current` is set. */
export function sleepUnlessCancelled(ms: number, cancel: { readonly current: boolean }): Promise<void> {
  return new Promise(resolve => {
    const start = Date.now();
    const tick = () => {
      if (cancel.current || Date.now() - start >= ms) resolve();
      else setTimeout(tick, Math.min(150, ms));
    };
    tick();
  });
}

/**
 * Sends one message and logs it. Throws when nothing was delivered (lookup,
 * connect or socket emit failed); a failed push/lastMessage only adds a note.
 */
export async function sendOne({ sender, user, text, dryRun, openChannel, source = AUTO_SOURCE }: {
  sender: Sender;
  user: ChatUser;
  text: string;
  dryRun: boolean;
  openChannel: OpenChannel;
  /** `source` column of the logged row. */
  source?: string;
}): Promise<{ message: ChatMessage; pushOk: boolean | null; note?: string }> {
  const now = Date.now();
  if (dryRun) {
    const payload = directMessagePayload({ from: sender.me, text, now });
    await logSent({
      sentAt: now, accountId: sender.id, accountUid: sender.me.uid, accountLabel: sender.label,
      peerUid: user.uid, peerName: user.displayName, messageId: String(payload.messageID), text,
      source, pushOk: null, lastMessageOk: null, error: null, dryRun: true,
    });
    return { message: localTextMessage(String(payload.messageID), sender.me, text, now), pushOk: null };
  }

  // Prefer a token from the lookup; fall back to one the collected user carried
  // (Khám phá/room rows have none, so those sends get no push).
  const loaded = await loadChatUser(sender.ola, user.uid);
  const peer = { ...loaded, fcmToken: loaded.fcmToken || user.fcmToken };
  const channel = openChannel(sender.id, peer.uid, sender.me.uid);
  if (!channel) throw new Error('Thiếu socket key (Cài đặt › Nâng cao).');
  try {
    await connectChannel(channel);
    const result = await sendDirectMessage(sender.ola, channel, { from: sender.me, peer, text, now });
    const stepOk = (name: string) => result.steps.find(s => s.name === name)?.ok ?? null;
    const failed = result.steps.filter(s => !s.ok);
    // Delivered from here on: a failed write must not look like a failed send.
    let logError: string | undefined;
    await logSent({
      sentAt: result.message.at, accountId: sender.id, accountUid: sender.me.uid, accountLabel: sender.label,
      peerUid: peer.uid, peerName: peer.displayName || user.displayName, messageId: result.message.id, text: result.message.text,
      source, pushOk: stepOk('push'), lastMessageOk: stepOk('lastMessage'),
      error: failed.map(f => `${f.name}: ${f.error ?? 'lỗi'}`).join('; ') || null, dryRun: false,
    }).catch((e: unknown) => { logError = `Đã gửi, nhưng không lưu được lịch sử: ${(e as Error).message ?? e}`; });
    return {
      message: result.message,
      pushOk: stepOk('push'),
      note: [failed.length ? `Đã gửi realtime, nhưng lỗi: ${failed.map(f => STEP_NAMES[f.name] ?? f.name).join(', ')}` : '', logError ?? ''].filter(Boolean).join(' · ') || undefined,
    };
  } finally {
    channel.close();
  }
}

const STEP_NAMES: Record<string, string> = { push: 'thông báo đẩy', lastMessage: 'lưu tin cuối' };

/** Rough run time in seconds: connect+send per message plus the gaps between them. */
export function estimateSeconds(count: number, delaySec: number, dryRun: boolean): number {
  if (count <= 0) return 0;
  return Math.round(count * (dryRun ? 0.2 : SEND_SECONDS) + (count - 1) * delaySec);
}

/** 45 → "45 giây", 125 → "2 phút 5 giây", 3720 → "1 giờ 2 phút". */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} giây`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `${m} phút ${s} giây` : `${m} phút`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

/** About how many messages a minute the run sends with this gap. */
export function messagesPerMinute(delaySec: number, dryRun: boolean): number {
  return Math.max(1, Math.round(60 / ((dryRun ? 0.2 : SEND_SECONDS) + delaySec)));
}
