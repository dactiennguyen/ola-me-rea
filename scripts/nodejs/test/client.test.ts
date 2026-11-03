import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it, mock } from 'node:test';
import { OlaClient } from '../src/client.ts';
import { olaConfig } from '../src/config.ts';
import { ApiError, defineEndpoint, text } from '../src/endpoint.ts';
import { usersSync } from '../src/endpoints/usersSync.ts';

const SERVER_TIME = 1_700_000_000;

interface Sent { url: URL; init: RequestInit; headers: Record<string, string> }

function fakeServer(reply: (url: URL) => unknown = () => ({ ok: 1 })) {
  const sent: Sent[] = [];
  const fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    sent.push({ url, init, headers: init.headers as Record<string, string> });
    if (url.pathname === '/napi/general/getTimes') return Response.json({ serverTime: SERVER_TIME });
    return Response.json(reply(url));
  }) as typeof globalThis.fetch;
  const client = new OlaClient({ session: { idToken: 'tok', localId: 'me-uid' }, fetch });
  const calls = () => sent.filter(s => s.url.pathname !== '/napi/general/getTimes');
  const timeCalls = () => sent.filter(s => s.url.pathname === '/napi/general/getTimes');
  return { client, sent, calls, timeCalls };
}

const getPost = defineEndpoint({
  name: 'getPost', summary: '', method: 'POST', path: 'faApi2/getPostByID.php',
  session: { uid: 'localId' }, fields: { uid: text(), postID: text() },
});

describe('OlaClient', () => {
  it('signs with server time: md5(timestamp - 888 + deviceId + last path segment)', async () => {
    const { client, calls } = fakeServer();
    await client.call(getPost, { postID: 'p1' });
    const [call] = calls();
    const h = call!.headers;
    const ts = Number(h.timestamp);
    assert.ok(ts >= SERVER_TIME && ts <= SERVER_TIME + 1, `timestamp ${ts} should follow the server clock`);
    const expected = createHash('md5').update(`${ts - 888}${olaConfig.deviceId}/getPostByID.php`).digest('hex');
    assert.equal(h.hash, expected);
    assert.equal(h.Authorization, 'Bearer tok');
    assert.equal(h.key2, olaConfig.publicKey);
    assert.equal(h.deviceid, olaConfig.deviceId);
    assert.equal(h.ver, olaConfig.appVersion);
    assert.equal(h.os, 'android');
    assert.deepEqual(JSON.parse(String(call!.init.body)), { uid: 'me-uid', postID: 'p1' });
  });

  it('fetches the server clock once, not before every request', async () => {
    const { client, calls, timeCalls } = fakeServer();
    await client.call(getPost, { postID: 'a' });
    await client.call(getPost, { postID: 'b' });
    await client.request({ method: 'GET', path: 'napi/caro/me' });
    assert.equal(timeCalls().length, 1);
    assert.equal(calls().length, 3);
    // getTimes itself is signed with local time and carries no token.
    assert.equal(timeCalls()[0]!.headers.Authorization, undefined);
  });

  it('retries the clock after a failed getTimes', async () => {
    let fail = true;
    const fetch = (async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/napi/general/getTimes') {
        return Response.json({ serverTime: fail ? 'nope' : SERVER_TIME });
      }
      return Response.json({ ok: 1 });
    }) as typeof globalThis.fetch;
    const client = new OlaClient({ session: { idToken: 'tok', localId: 'me' }, fetch });
    await assert.rejects(client.request({ method: 'GET', path: 'napi/caro/me' }), /Unexpected serverTime/);
    fail = false;
    assert.deepEqual(await client.request({ method: 'GET', path: 'napi/caro/me' }), { ok: 1 });
  });

  it('takes the signed timestamp after a slow getTimes, not before it', async () => {
    let nowMs = 1_000_000_000;
    mock.method(Date, 'now', () => nowMs);
    try {
      const fetch = (async (input: string | URL, init: RequestInit = {}) => {
        if (String(input).endsWith('getTimes')) {
          nowMs += 5_000; // 5 s round trip
          return Response.json({ serverTime: 2_000_000 });
        }
        return Response.json({ timestamp: (init.headers as Record<string, string>).timestamp });
      }) as typeof globalThis.fetch;
      const client = new OlaClient({ session: { idToken: 't', localId: 'me' }, fetch });
      assert.deepEqual(await client.request({ method: 'GET', path: 'napi/caro/me' }), { timestamp: '2000000' });
    } finally {
      mock.restoreAll();
    }
  });

  it('rejects object query values instead of sending "[object Object]"', async () => {
    const { client, sent } = fakeServer();
    await assert.rejects(client.request({ method: 'GET', path: 'napi/x', query: { a: { b: 1 } } }), /must be a scalar/);
    assert.equal(sent.length, 0);
  });

  it('sync registers the same deviceId it signs, from its own config', async () => {
    const config = { ...olaConfig, deviceId: 'custom-dev', androidVersion: '14' };
    const sent: RequestInit[] = [];
    const fetch = (async (input: string | URL, init: RequestInit = {}) => {
      if (String(input).endsWith('getTimes')) return Response.json({ serverTime: SERVER_TIME });
      sent.push(init);
      return Response.json({ user: { uid: 'me' } });
    }) as typeof globalThis.fetch;
    const client = new OlaClient({ session: { idToken: 't', localId: 'me' }, config, fetch });
    assert.deepEqual(await client.sync(), { uid: 'me' });
    const [init] = sent;
    assert.equal((init!.headers as Record<string, string>).deviceid, 'custom-dev');
    assert.deepEqual(JSON.parse(String(init!.body)),
      { os: 'android', deviceId: 'custom-dev', ver: '14', displayName: '', photoURL: '' });
    assert.ok(usersSync.mutates);
  });

  it('appends the query after signing and sends no GET body', async () => {
    const { client, calls } = fakeServer();
    await client.request({ method: 'GET', path: 'napi/minigame/flappy/leaderboard', query: { limit: 10, skip: undefined, x: null } });
    const [call] = calls();
    assert.equal(call!.url.search, '?limit=10');
    assert.equal(call!.init.body, undefined);
    assert.equal(call!.headers.hash,
      createHash('md5').update(`${Number(call!.headers.timestamp) - 888}${olaConfig.deviceId}/leaderboard`).digest('hex'));
  });

  it('refuses paths outside napi/ and faApi2/ or with dot segments', async () => {
    const { client, sent } = fakeServer();
    for (const path of ['other/x', 'napi/post/stories/..', 'napi/./x', 'napi//x', 'faApi2/']) {
      await assert.rejects(client.request({ method: 'DELETE', path }), /Invalid Ola API path/, path);
    }
    assert.equal(sent.length, 0);
  });

  it('raises ApiError with the response when the API reports failure', async () => {
    const { client } = fakeServer(() => ({ is_success: false, msg: 'nope' }));
    await assert.rejects(client.call(getPost, { postID: 'p' }), (e: Error) =>
      e instanceof ApiError && (e.response as { msg: string }).msg === 'nope');
  });

  it('validates before sending anything', async () => {
    const { client, sent } = fakeServer();
    await assert.rejects(client.call(getPost, {} as never), /postID/);
    assert.equal(sent.length, 0);
  });

  it('uses a fresh token from getToken for every request', async () => {
    const sent: string[] = [];
    let n = 0;
    const fetch = (async (input: string | URL, init: RequestInit = {}) => {
      if (String(input).endsWith('getTimes')) return Response.json({ serverTime: SERVER_TIME });
      sent.push((init.headers as Record<string, string>).Authorization!);
      return Response.json({});
    }) as typeof globalThis.fetch;
    const client = new OlaClient({ session: { idToken: 't0', localId: 'me' }, getToken: async () => `t${++n}`, fetch });
    await client.request({ method: 'GET', path: 'napi/caro/me' });
    await client.request({ method: 'GET', path: 'napi/caro/me' });
    assert.deepEqual(sent, ['Bearer t1', 'Bearer t2']);
  });

  it('closes once', async () => {
    let closed = 0;
    const client = new OlaClient({ session: { idToken: 't', localId: 'me' }, close: async () => { closed++; } });
    await client.close();
    await client.close();
    assert.equal(closed, 1);
  });
});
