import { useEffect, useRef, useState } from 'react';
import type { ChatUser } from '@ola/core/chat.ts';
import type { StatusText } from '../types.ts';
import { sendOne, sleepUnlessCancelled, type OpenChannel, type Sender, type SendLogEntry } from './engine.ts';

/** The log keeps the newest rows of the session. */
const LOG_LIMIT = 1000;

export interface AutoSendJob {
  senders: Sender[];
  targets: ChatUser[];
  /** Text for the next message (fixed, or a random template). */
  pickText: () => string;
  delaySec: number;
}

export interface Progress {
  done: number;
  total: number;
  ok: number;
  fail: number;
  /** The message being sent right now. */
  current: { name: string; photo: string; nick: string; text: string } | null;
}

const IDLE: Progress = { done: 0, total: 0, ok: 0, fail: 0, current: null };

/**
 * Runs an auto-send job: one message at a time, nicks taken in turn, a pause
 * between messages, stoppable at any moment (also during the pause).
 */
export function useAutoSend({ dryRun, openChannel }: { dryRun: boolean; openChannel: OpenChannel }) {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState<Progress>(IDLE);
  const [log, setLog] = useState<SendLogEntry[]>([]);
  const [result, setResult] = useState<StatusText | null>(null);
  const cancel = useRef(false);
  // Leaving the screen for good stops a run instead of sending on unseen.
  useEffect(() => () => { cancel.current = true; }, []);

  const add = (entry: SendLogEntry) => setLog(list => [entry, ...list].slice(0, LOG_LIMIT));

  /** Runs the job; resolves with the summary that is also kept in `result`. */
  const start = async ({ senders, targets, pickText, delaySec }: AutoSendJob): Promise<StatusText> => {
    cancel.current = false;
    setRunning(true);
    setStopping(false);
    setResult(null);
    setLog([]);
    let ok = 0;
    let fail = 0;
    setProgress({ ...IDLE, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancel.current) break;
        const user = targets[i]!;
        const sender = senders[i % senders.length]!;
        const text = pickText();
        const at = Date.now();
        const name = user.displayName || `${user.uid.slice(0, 10)}…`;
        setProgress({ done: i, total: targets.length, ok, fail, current: { name, photo: user.photoURL, nick: sender.label, text } });
        const base = { id: `${at}-${user.uid}`, at, peerUid: user.uid, peerName: user.displayName, nick: sender.label, text };
        try {
          const { pushOk, note } = await sendOne({ sender, user, text, dryRun, openChannel });
          ok++;
          add({ ...base, status: dryRun ? 'dry' : 'ok', pushOk, note });
        } catch (e) {
          fail++;
          add({ ...base, status: 'fail', pushOk: null, note: (e as Error).message });
        }
        setProgress({ done: i + 1, total: targets.length, ok, fail, current: null });
        if (i < targets.length - 1 && !cancel.current) await sleepUnlessCancelled(delaySec * 1000, cancel);
      }
      const stopped = cancel.current;
      const left = targets.length - ok - fail;
      const summary: StatusText = {
        text: [
          stopped ? 'Đã dừng.' : 'Hoàn tất.',
          dryRun ? `Chạy thử ${ok} tin` : `Đã gửi ${ok} tin`,
          fail ? `lỗi ${fail}` : '',
          left > 0 ? `chưa gửi ${left}` : '',
        ].filter(Boolean).join(' · '),
        tone: fail ? 'bad' : stopped ? 'warn' : 'ok',
      };
      setResult(summary);
      return summary;
    } finally {
      setProgress(p => ({ ...p, current: null }));
      setRunning(false);
      setStopping(false);
    }
  };

  return {
    running, stopping, progress, log, result, start,
    stop: () => { cancel.current = true; setStopping(true); },
    clearLog: () => { setLog([]); setResult(null); setProgress(IDLE); },
  };
}
