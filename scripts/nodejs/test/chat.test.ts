import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ChatChannel, chatProfile, directMessagePayload, normalizeConversations, normalizeMessage, normalizeUser,
  roomMessagePayload, sendDirectMessage, sendRoomMessage, type IoFactory, type SocketLike,
} from '../src/chat.ts';
import { OlaClient } from '../src/client.ts';

const SOCKET = { url: 'https://sgdev.vip:3001', key: 'test-key' };
const ME = chatProfile({ displayName: 'Minh Anh', photoURL: 'https://img/a.jpg', isVip: 0, level: 3, password: 'x' }, 'me-uid');

function fakeIo() {
  const sockets: (SocketLike & { url: string; options: Record<string, unknown>; emitted: unknown[][]; fire(e: string, ...a: unknown[]): void })[] = [];
  const io: IoFactory = (url, options) => {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    const socket = {
      url, options, connected: false, emitted: [] as unknown[][],
      on(event: string, fn: (...args: unknown[]) => void) { (handlers.get(event) ?? handlers.set(event, new Set()).get(event)!).add(fn); },
      off(event: string, fn?: (...args: unknown[]) => void) { if (fn) handlers.get(event)?.delete(fn); else handlers.delete(event); },
      emit(...args: unknown[]) { socket.emitted.push(args); },
      connect() { socket.connected = true; socket.fire('connect'); },
      disconnect() { socket.connected = false; socket.fire('disconnect'); },
      fire(event: string, ...args: unknown[]) { for (const fn of handlers.get(event) ?? []) fn(...args); },
    };
    sockets.push(socket as unknown as (typeof sockets)[number]);
    return socket as never;
  };
  return { io, sockets };
}

function fakeOla() {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname.slice(1);
    if (path === 'napi/general/getTimes') return Response.json({ serverTime: 1_700_000_000 });
    calls.push({ path, body: JSON.parse(String(init.body ?? '{}')) });
    return Response.json({ is_success: true, success: true });
  }) as typeof globalThis.fetch;
  return { ola: new OlaClient({ session: { idToken: 't', localId: 'me-uid' }, fetch }), calls };
}

describe('chatProfile', () => {
  it('keeps only chat fields from the sync profile', () => {
    assert.deepEqual(ME, { uid: 'me-uid', displayName: 'Minh Anh', photoURL: 'https://img/a.jpg', isVip: false, level: 3, isVerifyAvatar: 0 });
    assert.ok(!('password' in ME));
  });
});

describe('ChatChannel', () => {
  it('connects websocket-only with key + roomNo and emits add user on connect', () => {
    const { io, sockets } = fakeIo();
    const states: string[] = [];
    const channel = new ChatChannel({ io, socket: SOCKET, roomNo: 'peer-uid', joinAs: 'me-uid' });
    channel.onState(s => states.push(s));
    channel.connect();
    const [s] = sockets;
    assert.equal(s!.url, SOCKET.url);
    assert.deepEqual(s!.options.query, { key: 'test-key', roomNo: 'peer-uid' });
    assert.deepEqual(s!.options.transports, ['websocket']);
    assert.equal(s!.options.forceNew, true);
    assert.deepEqual(s!.emitted, [['add user', { username: 'me-uid', roomNo: 'peer-uid' }]]);
    assert.deepEqual(states, ['connecting', 'connected']);
  });

  it('refuses to start without a socket key', () => {
    assert.throws(() => new ChatChannel({ io: fakeIo().io, socket: { ...SOCKET, key: ' ' }, roomNo: 'x' }), /socket key/);
  });

  it('delivers new message events to listeners and stops after unsubscribe', () => {
    const { io, sockets } = fakeIo();
    const channel = new ChatChannel({ io, socket: SOCKET, roomNo: 'me-uid' }).connect();
    const got: unknown[] = [];
    const off = channel.onMessage(raw => got.push(raw));
    sockets[0]!.fire('new message', { username: 'x', message: { mess: 'hi' } });
    off();
    sockets[0]!.fire('new message', { username: 'x', message: { mess: 'again' } });
    assert.equal(got.length, 1);
  });
});

describe('payloads', () => {
  it('1-1 payload matches the captured shape', () => {
    const p = directMessagePayload({ from: ME, text: 'hi', recipientFcmToken: 'peer-fcm', now: 1_700_000_000_123 });
    assert.deepEqual(Object.keys(p), ['mess', 'photoURL2', 'displayName', 'photoURL', 'userID', 'send', 'read',
      'messageID', 'isSticker', 'replyID', 'replyText', 'isVip', 'isImage', 'isGift', 'isAudio', 'fcmTokenNguoiNhan']);
    assert.equal(p.messageID, '1700000000123me-uid');
    assert.equal(p.send, true);
  });

  it('room payload matches the captured shape', () => {
    const p = roomMessagePayload({ from: ME, deviceId: 'dev', text: 'hi', now: 1_700_000_000_123 });
    assert.deepEqual(Object.keys(p), ['deviceID', 'mess', 'name', 'userID', 'photoURL2', 'send', 'id', 'isVip', 'level']);
    assert.equal(p.send, 1);
  });
});

describe('normalizers', () => {
  it('reads a room history row (observed shape) and a socket wrapper', () => {
    const row = { mess: 'hi', userID: 'u2', photoURL2: 'https://p', send: 1, name: 'Hân', id: '1700000000000u2',
      deviceID: 'd', isVip: true, level: 2, timestamp: '1700000000500', isSticker: 0, isAudio: 0, fcmToken: '' };
    const m = normalizeMessage(row, 'me-uid')!;
    assert.equal(m.text, 'hi');
    assert.equal(m.at, 1700000000500);
    assert.equal(m.fromName, 'Hân');
    assert.equal(m.outgoing, false);
    const wrapped = normalizeMessage({ username: 'u2', message: { mess: 'yo', userID: 'me-uid', messageID: '1700000000999me-uid' } }, 'me-uid')!;
    assert.equal(wrapped.outgoing, true);
    assert.equal(wrapped.at, 1700000000999);
  });

  it('drops control signals and empty payloads, not real messages', () => {
    // Profile-view ping: a new message carrying an action + reserved mess token.
    assert.equal(normalizeMessage({ message: { mess: 'REQUEST_MOFIFY_MESSAGE', action: 'VIEW_PROFILE', uid: 'u2', displayName: 'Tuan' } }, 'me-uid'), null);
    // Reserved tokens without an action.
    assert.equal(normalizeMessage({ mess: 'REMOVE_MESS', userID: 'u2' }, 'me-uid'), null);
    assert.equal(normalizeMessage({ mess: 'THA_TIM', userID: 'u2' }, 'me-uid'), null);
    // Empty text, no media: a system/presence ping.
    assert.equal(normalizeMessage({ userID: 'u2', mess: '' }, 'me-uid'), null);
    // A real message and a sticker (empty text but a media flag) still pass.
    assert.equal(normalizeMessage({ mess: 'hello', userID: 'u2' }, 'me-uid')?.text, 'hello');
    assert.equal(normalizeMessage({ mess: '', isSticker: 1, userID: 'u2' }, 'me-uid')?.kind, 'sticker');
  });

  it('finds the peer in a conversation row whichever side sent it', () => {
    const rows = { is_success: true, data: [
      { uid: 'me-uid', userID: 'peer-a', content: 'mine', timestamp: '1700000000000' },
      { uid: 'peer-b', userID: 'me-uid', content: 'theirs', timestamp: '1700000009000', displayName: 'B' },
    ] };
    const list = normalizeConversations(rows, 'me-uid');
    assert.deepEqual(list.map(c => [c.peerUid, c.lastFromMe]), [['peer-b', false], ['peer-a', true]]);
  });

  it('gives a row without id or time the same id on every load', () => {
    const row = { mess: 'ok', userID: 'u2', name: 'Hân' };
    const first = normalizeMessage(row, 'me-uid')!;
    const again = normalizeMessage({ ...row }, 'me-uid')!;
    assert.equal(first.id, again.id);
    assert.notEqual(first.id, normalizeMessage({ ...row, mess: 'khác' }, 'me-uid')!.id);
  });

  it('reads a member row', () => {
    const u = normalizeUser({ uid: 'u', photoURL: 'p', displayName: 'N', isVip: true, lastSeen: 5, level: 4 });
    assert.equal(u.displayName, 'N');
    assert.equal(u.isVip, true);
    assert.equal(u.verified, false);
  });

  it('reads an Explore item: numeric flags, province, new badge', () => {
    const u = normalizeUser({ uid: 'u', displayName: 'N', isVip: 2, isVerifyAvatar: 1, state: 79, isNew: true });
    assert.deepEqual([u.isVip, u.verified, u.state, u.isNew], [true, true, '79', true]);
    assert.equal(normalizeUser({ uid: 'u', state: '0', isVip: 0 }).state, '');
    assert.equal(normalizeUser({ uid: 'u', isVip: '0' }).isVip, false);
  });
});

describe('send flows', () => {
  it('1-1: socket emit, then push, then addLastMessage5', async () => {
    const { io, sockets } = fakeIo();
    const { ola, calls } = fakeOla();
    const channel = new ChatChannel({ io, socket: SOCKET, roomNo: 'peer-uid', joinAs: 'me-uid' }).connect();
    const peer = normalizeUser({ uid: 'peer-uid', displayName: 'Hân', fcmToken: 'peer-fcm' });
    const result = await sendDirectMessage(ola, channel, { from: ME, peer, text: 'hi', now: 1_700_000_000_123 });
    assert.equal(sockets[0]!.emitted.at(-1)![0], 'new message');
    assert.deepEqual(calls.map(c => c.path), ['napi/general/send-notification', 'faApi2/addLastMessage5.php']);
    assert.equal(calls[0]!.body.token, 'peer-fcm');
    assert.equal(calls[1]!.body.id, '1700000000123me-uid');
    assert.equal(calls[1]!.body.userID, 'peer-uid');
    assert.deepEqual(result.steps.map(s => s.ok), [true, true, true]);
    assert.equal(result.message.outgoing, true);
  });

  it('1-1: nothing goes over HTTP when the socket is down', async () => {
    const { io } = fakeIo();
    const { ola, calls } = fakeOla();
    const channel = new ChatChannel({ io, socket: SOCKET, roomNo: 'peer-uid' });
    const peer = normalizeUser({ uid: 'peer-uid', fcmToken: 'peer-fcm' });
    await assert.rejects(sendDirectMessage(ola, channel, { from: ME, peer, text: 'hi' }), /not connected/);
    assert.equal(calls.length, 0);
  });

  it('room: socket emit, then apiAddMessageRoom2 with roomID', async () => {
    const { io } = fakeIo();
    const { ola, calls } = fakeOla();
    const channel = new ChatChannel({ io, socket: SOCKET, roomNo: '79', joinAs: 'Minh Anh' }).connect();
    await sendRoomMessage(ola, channel, { from: ME, roomID: '79', deviceId: 'dev', text: 'hi', now: 1_700_000_000_123 });
    assert.deepEqual(calls.map(c => c.path), ['faApi2/apiAddMessageRoom2.php']);
    assert.equal(calls[0]!.body.roomID, '79');
    assert.equal(calls[0]!.body.id, '1700000000123me-uid');
  });
});
