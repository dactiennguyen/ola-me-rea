import { useEffect, useRef } from 'react';
import { normalizeUser, type ChatMessage } from '@ola/core/chat.ts';
import { AUTO_REPLY_SOURCE, AutoReplyPolicy, loadReplyCounts, randomDelayMs, saveReplyCounts } from '../lib/autoReply.ts';
import { appendThread, publishLocalMessage } from '../lib/messageCache.ts';
import { useSession } from '../lib/session.tsx';
import { useToast } from '../ui/index.ts';
import { sendOne } from './outreach/autosend/engine.ts';

/**
 * Tự trả lời (Cài đặt): listens to every signed-in nick while it is switched
 * on, whichever screen is open. Renders nothing.
 */
export function AutoReplyRunner() {
  const { accounts, live, settings, onIncoming, openChannel } = useSession();
  const toast = useToast();
  const latest = useRef({ accounts, live, settings, openChannel, toast });
  latest.current = { accounts, live, settings, openChannel, toast };

  const policy = useRef<Promise<AutoReplyPolicy> | null>(null);
  const warnedAt = useRef(new Map<string, number>());

  const on = settings.autoReplyEnabled && Boolean(settings.autoReplyText.trim());
  const online = accounts.filter(a => live[a.id]?.status === 'ready').map(a => a.id).join('|');

  useEffect(() => {
    if (!on || !online) return;
    const loadPolicy = () => (policy.current ??= loadReplyCounts()
      .then(counts => new AutoReplyPolicy(counts, next => { void saveReplyCounts(next).catch(() => {}); })));

    const reply = async (accountId: string, message: ChatMessage) => {
      const now = Date.now();
      let rules: AutoReplyPolicy;
      try {
        rules = await loadPolicy();
      } catch (error) {
        // Without the counts the per-person limit is unknown: do not reply, and try again next message.
        policy.current = null;
        latest.current.toast({ tone: 'bad', message: `Tự trả lời tạm dừng: không đọc được số lần đã trả lời (${(error as Error).message}).` });
        return;
      }
      // Saved nicks too: one that is signed out here can still message from a phone.
      const ownUids = new Set([
        ...latest.current.accounts.flatMap(a => (a.uid ? [a.uid] : [])),
        ...Object.values(latest.current.live).flatMap(s => (s?.me ? [s.me.uid] : [])),
      ]);
      const skip = rules.claim({ accountId, message, maxPerPerson: latest.current.settings.autoReplyMaxPerPerson, ownUids, now });
      const account = latest.current.accounts.find(a => a.id === accountId);
      const nickName = account?.label || latest.current.live[accountId]?.me?.displayName || account?.email || accountId;
      if (skip === 'hourly-limit' && now - (warnedAt.current.get(accountId) ?? 0) > 3_600_000) {
        warnedAt.current.set(accountId, now);
        latest.current.toast({ tone: 'warn', message: `Tự trả lời của ${nickName} đã đạt giới hạn trong giờ này, tạm dừng.` });
      }
      if (skip) return;

      await new Promise(resolve => setTimeout(resolve, randomDelayMs()));

      // Everything may have changed during the wait: switched off, signed out…
      const { settings: current, live: states, openChannel: open } = latest.current;
      const state = states[accountId];
      const text = current.autoReplyText.trim();
      if (!current.autoReplyEnabled || !text || state?.status !== 'ready' || !state.ola || !state.me) {
        rules.release(accountId, message.fromUid);
        return;
      }
      let sent: Awaited<ReturnType<typeof sendOne>>;
      try {
        sent = await sendOne({
          sender: { id: accountId, label: nickName, color: account?.color ?? 'var(--muted)', ola: state.ola, me: state.me },
          user: normalizeUser({ uid: message.fromUid, displayName: message.fromName, photoURL: message.fromPhoto }, message.fromUid),
          text,
          dryRun: current.dryRunSends,
          openChannel: open,
          source: AUTO_REPLY_SOURCE,
        });
      } catch (error) {
        rules.release(accountId, message.fromUid);
        latest.current.toast({ tone: 'bad', message: `Tự trả lời của ${nickName} lỗi: ${(error as Error).message}` });
        return;
      }
      // A test run sends nothing, so it must not use up the person's replies.
      if (current.dryRunSends) rules.release(accountId, message.fromUid);
      else rules.confirm(accountId, message.fromUid, Date.now());
      // Only the local copy from here: the reply is already delivered.
      await appendThread(state.me.uid, message.fromUid, [sent.message]).catch(() => {});
      publishLocalMessage(state.me.uid, message.fromUid, sent.message);
    };

    const offs = online.split('|').map(id => onIncoming(id, message => { void reply(id, message); }));
    return () => { offs.forEach(off => off()); };
  }, [on, online, onIncoming]);

  return null;
}
