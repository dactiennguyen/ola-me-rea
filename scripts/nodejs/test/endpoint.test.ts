import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import {
  ApiError, InputError, defineEndpoint, extraFields, int, oneOf, scalar, segment, text,
} from '../src/endpoint.ts';

const SESSION = { localId: 'me-uid', email: 'me@example.com' };

describe('defineEndpoint build()', () => {
  const ep = defineEndpoint({
    name: 'demo', summary: 'demo', method: 'POST', path: 'faApi2/demo.php',
    session: { uid: 'localId' },
    fields: { uid: text(), postID: text(), page: int().default(0), note: z.string().optional() },
  });

  it('fills session defaults and lets the caller override them', () => {
    assert.deepEqual(ep.build(SESSION, { postID: 'p' }),
      { method: 'POST', path: 'faApi2/demo.php', body: { uid: 'me-uid', postID: 'p', page: 0 } });
    assert.equal(ep.build(SESSION, { postID: 'p', uid: 'other' }).body?.uid, 'other');
  });

  it('treats explicit undefined as not given', () => {
    assert.deepEqual(ep.build(SESSION, { postID: 'p', note: undefined }).body, { uid: 'me-uid', postID: 'p', page: 0 });
  });

  it('rejects missing, mistyped and unknown fields with InputError', () => {
    assert.throws(() => ep.build(SESSION, {} as never), (e: Error) => e instanceof InputError && /postID/.test(e.message));
    assert.throws(() => ep.build(SESSION, { postID: '   ' }), /non-empty/);
    assert.throws(() => ep.build(SESSION, { postID: 'p', page: -1 }), /page/);
    assert.throws(() => ep.build(SESSION, { postID: 'p', bogus: 1 } as never), /Unrecognized key/);
  });

  it('does not invent a value when the session lacks one', () => {
    const byEmail = defineEndpoint({
      name: 'byEmail', summary: '', method: 'POST', path: 'faApi2/x.php',
      session: { email: 'email' }, fields: { email: text() },
    });
    assert.throws(() => byEmail.build({ localId: 'u', email: null }), /email/);
  });
});

describe('path params', () => {
  const ep = defineEndpoint({
    name: 'story', summary: '', method: 'POST', path: 'napi/post/stories/:storyId/:action?',
    fields: { storyId: segment(), action: segment().optional(), body: z.string().optional() },
  });

  it('fills the path and leaves params out of the body', () => {
    assert.deepEqual(ep.build(SESSION, { storyId: 's1', action: 'view', body: 'x' }),
      { method: 'POST', path: 'napi/post/stories/s1/view', body: { body: 'x' } });
  });

  it('drops an optional segment that is not given', () => {
    assert.equal(ep.build(SESSION, { storyId: 's1' }).path, 'napi/post/stories/s1');
  });

  it('rejects dot segments', () => {
    for (const storyId of ['.', '..', 'a/b', '']) {
      assert.throws(() => ep.build(SESSION, { storyId }), InputError, storyId);
    }
  });

  it('checks params declared without segment() too', () => {
    const loose = defineEndpoint({ name: 'loose', summary: '', method: 'GET', path: 'napi/x/:id', fields: { id: text() } });
    assert.throws(() => loose.build(SESSION, { id: '..' }), /path segment/);
    assert.deepEqual(loose.build(SESSION, { id: 'a1' }), { method: 'GET', path: 'napi/x/a1', query: {} });
  });

  it('refuses a template param without a field', () => {
    assert.throws(() => defineEndpoint({ name: 'bad', summary: '', method: 'GET', path: 'napi/:nope', fields: {} }),
      /:nope has no matching field/);
  });
});

describe('extra', () => {
  const ep = defineEndpoint({
    name: 'upd', summary: '', method: 'POST', path: 'faApi2/upd.php',
    fields: { action: text(), id: text(), value: scalar().optional(), extra: extraFields() },
  });

  it('spreads scalar flags into the body', () => {
    assert.deepEqual(ep.build(SESSION, { action: 'a', id: '1', extra: { push: 1, FRIEND: true } }).body,
      { action: 'a', id: '1', push: 1, FRIEND: true });
  });

  it('may not set declared fields, given or not', () => {
    assert.throws(() => ep.build(SESSION, { action: 'a', id: '1', extra: { action: 'x' } }), /declared field\(s\) action/);
    assert.throws(() => ep.build(SESSION, { action: 'a', id: '1', extra: { value: 'x' } }), /declared field\(s\) value/);
  });

  it('accepts only scalar values', () => {
    assert.throws(() => ep.build(SESSION, { action: 'a', id: '1', extra: { x: { y: 1 } as never } }), /extra/);
  });
});

describe('validate / oneOf / request', () => {
  const ep = defineEndpoint({
    name: 'noti', summary: '', method: 'POST', path: 'faApi2/noti.php',
    fields: { a: scalar().optional(), b: scalar().optional(), tag: text().optional() },
    validate: value => oneOf(value, ['a', 'b'], { required: true }),
    request: ({ tag, ...body }) => ({ body: { ...body, tag } }),
  });

  it('wraps validation errors as InputError with the endpoint name', () => {
    assert.throws(() => ep.build(SESSION, { a: 1, b: 2 }), (e: Error) =>
      e instanceof InputError && e.message === 'noti: a and b cannot be used together.');
    assert.throws(() => ep.build(SESSION, {}), /noti: Provide one of: a, b\./);
  });

  it('drops undefined values from a custom body', () => {
    assert.deepEqual(ep.build(SESSION, { a: 1 }).body, { a: 1 });
  });
});

describe('handle()', () => {
  const faApi = defineEndpoint({ name: 'f', summary: '', method: 'POST', path: 'faApi2/f.php', fields: {} });
  const napi = defineEndpoint({ name: 'n', summary: '', method: 'GET', path: 'napi/n', fields: {} });
  const unchecked = defineEndpoint({ name: 'u', summary: '', method: 'POST', path: 'faApi2/u.php', fields: {}, success: false });
  const parsed = defineEndpoint({
    name: 'p', summary: '', method: 'GET', path: 'napi/p', fields: {},
    parse: raw => (raw as { n: number }).n * 2,
  });
  const req = (path: string) => ({ method: 'POST' as const, path });

  it('fails on an explicit is_success=false for faApi2', () => {
    for (const flag of [false, 0, '0', 'false']) {
      assert.throws(() => faApi.handle({ is_success: flag, msg: 'x' }, req('faApi2/f.php')), (e: Error) =>
        e instanceof ApiError && (e.response as { msg: string }).msg === 'x');
    }
    assert.deepEqual(faApi.handle({ is_success: true }, req('faApi2/f.php')), { is_success: true });
    assert.deepEqual(faApi.handle({ list: [] }, req('faApi2/f.php')), { list: [] });
  });

  it('fails on success=false for napi', () => {
    assert.throws(() => napi.handle({ success: false }, req('napi/n')), /success=false/);
    assert.deepEqual(napi.handle({ serverTime: 1 }, req('napi/n')), { serverTime: 1 });
  });

  it('can opt out and can parse', () => {
    assert.deepEqual(unchecked.handle({ is_success: false }, req('faApi2/u.php')), { is_success: false });
    assert.equal(parsed.handle({ n: 21 }, req('napi/p')), 42);
  });
});
