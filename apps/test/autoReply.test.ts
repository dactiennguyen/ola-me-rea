// node --test (yarn test): who gets an automatic reply.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AutoReplyPolicy, MAX_MESSAGE_AGE_MS, MAX_REPLIES_PER_HOUR, MIN_GAP_MS, type ReplyCounts } from '../src/lib/autoReply.ts';

const NOW = 1_800_000_000_000;
const none = new Set<string>();
let nextId = 0;
const msg = (fromUid: string, over: Partial<{ id: string; kind: 'text' | 'image'; at: number }> = {}) => ({
  id: over.id ?? `m${++nextId}`, fromUid, kind: over.kind ?? 'text' as const, at: over.at ?? NOW,
});
const policy = (counts: ReplyCounts = {}) => new AutoReplyPolicy(counts, () => {});
const claim = (p: AutoReplyPolicy, message: ReturnType<typeof msg>, maxPerPerson = 1, now = NOW, accountId = 'a', ownUids: ReadonlySet<string> = none) =>
  p.claim({ accountId, message, maxPerPerson, ownUids, now });

describe('AutoReplyPolicy', () => {
  it('replies once, then never again with a limit of 1', () => {
    const p = policy();
    assert.equal(claim(p, msg('u1')), null);
    p.confirm('a', 'u1', NOW);
    const later = NOW + 86_400_000 * 30;
    assert.equal(claim(p, msg('u1', { at: later }), 1, later), 'limit-reached');
  });

  it('allows up to the configured number of replies', () => {
    const p = policy();
    assert.equal(claim(p, msg('u1'), 2), null);
    p.confirm('a', 'u1', NOW);
    assert.equal(claim(p, msg('u1', { at: NOW + MIN_GAP_MS }), 2, NOW + MIN_GAP_MS), null);
    p.confirm('a', 'u1', NOW + MIN_GAP_MS);
    assert.equal(claim(p, msg('u1', { at: NOW + 2 * MIN_GAP_MS }), 2, NOW + 2 * MIN_GAP_MS), 'limit-reached');
  });

  it('remembers the count across restarts', () => {
    const saved: { counts?: ReplyCounts } = {};
    const first = new AutoReplyPolicy({}, c => { saved.counts = structuredClone(c); });
    assert.equal(claim(first, msg('u1')), null);
    first.confirm('a', 'u1', NOW);
    assert.equal(claim(policy(saved.counts), msg('u1')), 'limit-reached');
  });

  it('writes nothing to disk until the reply is delivered', () => {
    let writes = 0;
    const p = new AutoReplyPolicy({}, () => { writes += 1; });
    assert.equal(claim(p, msg('u1')), null);
    assert.equal(writes, 0, 'quitting during the delay must not use up the reply');
    p.confirm('a', 'u1', NOW);
    assert.equal(writes, 1);
  });

  it('reserves the reply during the delay', () => {
    const p = policy();
    assert.equal(claim(p, msg('u1')), null);
    assert.equal(claim(p, msg('u1'), 1, NOW + MIN_GAP_MS), 'limit-reached');
  });

  it('counts each nick separately', () => {
    const p = policy();
    assert.equal(claim(p, msg('u1'), 1, NOW, 'a'), null);
    assert.equal(claim(p, msg('u1'), 1, NOW, 'b'), null);
  });

  it('keeps a minimum gap for one person even with a higher limit', () => {
    const p = policy();
    assert.equal(claim(p, msg('u1'), 5), null);
    assert.equal(claim(p, msg('u1'), 5, NOW + MIN_GAP_MS - 1), 'too-soon');
  });

  it('skips media, own nicks, old messages and repeats', () => {
    const p = policy();
    assert.equal(claim(p, msg('u1', { kind: 'image' })), 'not-text');
    assert.equal(claim(p, msg('me'), 1, NOW, 'a', new Set(['me'])), 'own-nick');
    assert.equal(claim(p, msg('u2', { at: NOW - MAX_MESSAGE_AGE_MS - 1 })), 'stale');
    assert.equal(claim(p, msg('u3', { id: 'same' }), 9), null);
    assert.equal(claim(p, msg('u3', { id: 'same' }), 9, NOW + MIN_GAP_MS), 'duplicate');
  });

  it('caps the replies of a nick per hour', () => {
    const p = policy();
    for (let i = 0; i < MAX_REPLIES_PER_HOUR; i++) assert.equal(claim(p, msg(`u${i}`)), null);
    assert.equal(claim(p, msg('over')), 'hourly-limit');
    assert.equal(claim(p, msg('later', { at: NOW + 3_600_001 }), 1, NOW + 3_600_001), null);
  });

  it('gives a failed reply back', () => {
    const p = policy();
    assert.equal(claim(p, msg('u1')), null);
    p.release('a', 'u1');
    assert.equal(claim(p, msg('u1')), null, 'a failed send can be retried on the next message');
  });
});
