// node --test: restoring a Firebase session exported from the owner's phone.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseGoogleSession, restoreGoogleSession, type GoogleSessionExport } from '../src/firebase-session.ts';

const valid: GoogleSessionExport = {
  format: 'ola-google-session', version: 1, projectId: 'olaachat', provider: 'google.com',
  uid: 'uid-123', email: 'me@gmail.com', refreshToken: 'r'.repeat(40), deviceId: 'android-id-01',
  appVersion: '27.7.8', androidVersion: '14', displayName: 'Me',
};

describe('parseGoogleSession', () => {
  it('accepts a valid export and keeps only known fields', () => {
    const out = parseGoogleSession({ ...valid, extra: 'DROP ME' } as object);
    assert.deepEqual(out, valid);
    assert.equal('extra' in out, false);
  });

  it('accepts an empty email', () => {
    assert.equal(parseGoogleSession({ ...valid, email: '', displayName: undefined }).email, '');
  });

  it('rejects the wrong format, project or provider', () => {
    for (const bad of [{ format: 'x' }, { projectId: 'other' }, { provider: 'password' }, { version: 2 }]) {
      assert.throws(() => parseGoogleSession({ ...valid, ...bad }));
    }
  });

  it('rejects a malformed email, a short token and control characters', () => {
    assert.throws(() => parseGoogleSession({ ...valid, email: 'not-an-email' }));
    assert.throws(() => parseGoogleSession({ ...valid, refreshToken: 'short' }));
    assert.throws(() => parseGoogleSession({ ...valid, deviceId: 'bad\u0000id' }));
  });
});

/** Fake Firebase: securetoken returns a rotating token, identitytoolkit confirms the user. */
function firebaseStub(over: { uid?: string; email?: string; provider?: string } = {}) {
  const uid = over.uid ?? valid.uid;
  const email = over.email ?? valid.email;
  const provider = over.provider ?? 'google.com';
  let issued = 0;
  const rotations: string[] = [];
  const fetchImpl = (async (url: string, init: { body: string }) => {
    if (String(url).includes('securetoken')) {
      issued += 1;
      const next = `refresh-${issued}`;
      rotations.push(next);
      return new Response(JSON.stringify({ id_token: `id-${issued}`, refresh_token: next, user_id: uid, expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({ users: [{ localId: uid, email, providerUserInfo: [{ providerId: provider }] }] }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, rotations, issued: () => issued };
}

describe('restoreGoogleSession', () => {
  it('signs in, verifies identity and persists the rotated refresh token', async () => {
    const stub = firebaseStub();
    const persisted: string[] = [];
    const login = await restoreGoogleSession(valid, stub.fetchImpl, async t => { persisted.push(t); });
    assert.equal(await login.getIdToken(), 'id-1');
    assert.equal((login.user as { email: string }).email, 'me@gmail.com');
    assert.deepEqual(persisted, ['refresh-1']); // rotation saved before use
    await login.close();
  });

  it('adopts the email Firebase confirms when the export had none', async () => {
    const stub = firebaseStub({ email: 'found@gmail.com' });
    const login = await restoreGoogleSession({ ...valid, email: '' }, stub.fetchImpl, async () => {});
    assert.equal((login.user as { email: string }).email, 'found@gmail.com');
    await login.close();
  });

  it('reuses a fresh token instead of refreshing again', async () => {
    const stub = firebaseStub();
    const login = await restoreGoogleSession(valid, stub.fetchImpl, async () => {});
    await login.getIdToken();
    await login.getIdToken();
    assert.equal(stub.issued(), 1);
    await login.close();
  });

  it('rejects when the uid or provider does not match', async () => {
    const wrongUid = firebaseStub({ uid: 'someone-else' });
    await assert.rejects(restoreGoogleSession(valid, wrongUid.fetchImpl, async () => {}));
    const notGoogle = firebaseStub({ provider: 'password' });
    await assert.rejects(restoreGoogleSession(valid, notGoogle.fetchImpl, async () => {}));
  });

  it('rejects an expired or revoked refresh token', async () => {
    const dead = (async () => new Response('{}', { status: 400 })) as unknown as typeof fetch;
    await assert.rejects(restoreGoogleSession(valid, dead, async () => {}), /không còn hợp lệ/);
  });
});
