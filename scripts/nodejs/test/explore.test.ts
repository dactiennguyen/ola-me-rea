import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { main, parseCli } from '../explore.ts';
import type { OlaClient } from '../src/client.ts';
import type { AnyEndpoint, JsonObject, OlaRequest } from '../src/endpoint.ts';
import { getExplore3 } from '../src/endpoints/getExplore3.ts';
import { getExploreOnlineV6 } from '../src/endpoints/getExploreOnlineV6.ts';

const SESSION = { localId: 'me' };
const online = getExploreOnlineV6 as unknown as AnyEndpoint;

describe('explore paging', () => {
  it('online: next page carries the response cursor and filters', () => {
    const request = online.build(SESSION, { gender: 1, cityID: '7' });
    const result = online.handle({ is_success: true, list_data: [{}, {}], lastSeenPaging: 99 }, request);
    assert.deepEqual(result, {
      tab: 'online', page: 0, items: [{}, {}],
      next: { uid: 'me', page: 1, gender: 1, cityID: '7', lastSeenPaging: 99 },
      raw: { is_success: true, list_data: [{}, {}], lastSeenPaging: 99 },
    });
    // The next input is accepted as-is by the same endpoint.
    const nextRequest = online.build(SESSION, (result as { next: JsonObject }).next);
    assert.equal(nextRequest.body?.lastSeenPaging, 99);
  });

  it('stops on an empty page and rejects malformed responses', () => {
    const request = online.build(SESSION, {});
    assert.equal((online.handle({ list_data: [] }, request) as { next: unknown }).next, null);
    assert.throws(() => online.handle({ is_success: true }, request), /expected list_data array/);
    assert.throws(() => online.handle({ list_data: [{}], lastSeenPaging: -1 }, request), /lastSeenPaging/);
    assert.throws(() => online.handle({ is_success: false, list_data: [] }, request), /is_success=false/);
  });

  it('verified tab has no cursor', () => {
    const verified = getExplore3 as unknown as AnyEndpoint;
    const request = verified.build(SESSION, { page: 2 });
    assert.deepEqual(request.body, { uid: 'me', os: 'android', page: 2, condition: 1 });
    assert.deepEqual((verified.handle({ list_data: [1] }, request) as { next: unknown }).next, { uid: 'me', page: 3 });
  });

  it('keeps a caller-supplied uid on the next page', () => {
    const request = online.build(SESSION, { uid: 'other' });
    const next = (online.handle({ list_data: [{}], lastSeenPaging: 5 }, request) as { next: JsonObject }).next;
    assert.equal(online.build(SESSION, next).body?.uid, 'other');
  });
});

describe('explore CLI', () => {
  it('validates before login', () => {
    assert.throws(() => parseCli(['--page', '1']), /requires lastSeenPaging/);
    assert.throws(() => parseCli(['--tab', 'nope']), /tab must be/);
    assert.throws(() => parseCli(['--pages', '0']), /at least 1/);
  });

  it('follows next for up to --pages pages', async () => {
    const lines: string[] = [];
    const requests: OlaRequest[] = [];
    let closed = false;
    const fake = {
      async call(endpoint: AnyEndpoint, input: JsonObject) {
        const request = endpoint.build(SESSION, input);
        requests.push(request);
        const page = request.body!.page as number;
        return endpoint.handle({ list_data: page < 1 ? [{ id: page }] : [], lastSeenPaging: 10 + page }, request);
      },
      async close() { closed = true; },
    } as unknown as OlaClient;
    await main(['--pages', '5', '--gender', '2'], { output: line => lines.push(line), login: async () => fake });
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1]!.body, { uid: 'me', os: 'android', page: 1, condition: 2, gender: 2, lastSeenPaging: 10 });
    assert.deepEqual(lines.map(l => JSON.parse(l).count), [1, 0]);
    assert.ok(closed);
  });

  it('--dry-run prints the first request only', async () => {
    const lines: string[] = [];
    await main(['--tab', 'avatar', '--city', 'all', '--dry-run'], {
      output: line => lines.push(line), login: async () => { throw new Error('no login in dry-run'); },
    });
    assert.deepEqual(JSON.parse(lines.join('\n')).body, { uid: 'SIGNED_IN_UID', os: 'android', page: 0 });
  });
});
