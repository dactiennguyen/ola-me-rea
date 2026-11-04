import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firebaseRestLogin, restErrorCode } from '../src/auth.ts';

const config = { apiKey: 'test-key', authDomain: '', projectId: '', appId: '' } as never;

interface Call { url: string; body: string; type: string }

function fakeFetch(responses: Record<string, (body: string) => [number, unknown]>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = String(init?.body ?? '');
    calls.push({ url, body, type: new Headers(init?.headers).get('content-type') ?? '' });
    const route = Object.keys(responses).find(k => url.includes(k));
    if (!route) throw new Error(`unexpected ${url}`);
    const [status, data] = responses[route]!(body);
    return new Response(JSON.stringify(data), { status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const signedIn = { localId: 'uid-1', email: 'a@example.com', idToken: 'id-1', refreshToken: 'r-1', expiresIn: '3600' };

describe('firebaseRestLogin', () => {
  it('signs in, looks up emailVerified and sends the API key', async () => {
    const { calls, fetchImpl } = fakeFetch({
      signInWithPassword: () => [200, signedIn],
      'accounts:lookup': () => [200, { users: [{ localId: 'uid-1', emailVerified: true }] }],
    });
    const login = await firebaseRestLogin({ email: 'a@example.com', password: 'pw' }, fetchImpl, config);
    assert.equal(login.session.localId, 'uid-1');
    assert.equal(login.emailVerified, true);
    assert.equal(await login.getIdToken(), 'id-1');
    assert.equal(calls.length, 2);
    assert.match(calls[0]!.url, /accounts:signInWithPassword\?key=test-key$/);
    assert.deepEqual(JSON.parse(calls[0]!.body), { email: 'a@example.com', password: 'pw', returnSecureToken: true });
    assert.deepEqual(JSON.parse(calls[1]!.body), { idToken: 'id-1' });
  });

  it('reports an unverified email', async () => {
    const { fetchImpl } = fakeFetch({
      signInWithPassword: () => [200, signedIn],
      'accounts:lookup': () => [200, { users: [{ localId: 'uid-1', emailVerified: false }] }],
    });
    const login = await firebaseRestLogin({ email: 'a@example.com', password: 'pw' }, fetchImpl, config);
    assert.equal(login.emailVerified, false);
  });

  it('refreshes the ID token once when it is about to expire', async () => {
    const { calls, fetchImpl } = fakeFetch({
      signInWithPassword: () => [200, { ...signedIn, expiresIn: '60' }],
      'accounts:lookup': () => [200, { users: [{ emailVerified: true }] }],
      securetoken: () => [200, { id_token: 'id-2', refresh_token: 'r-2', expires_in: '3600' }],
    });
    const login = await firebaseRestLogin({ email: 'a@example.com', password: 'pw' }, fetchImpl, config);
    const [a, b] = await Promise.all([login.getIdToken(), login.getIdToken()]);
    assert.equal(a, 'id-2');
    assert.equal(b, 'id-2');
    assert.equal(await login.getIdToken(), 'id-2');
    const refreshes = calls.filter(c => c.url.includes('securetoken'));
    assert.equal(refreshes.length, 1);
    assert.equal(refreshes[0]!.type, 'application/x-www-form-urlencoded');
    assert.equal(refreshes[0]!.body, 'grant_type=refresh_token&refresh_token=r-1');
  });

  it('maps REST errors to SDK-style codes', async () => {
    const { fetchImpl } = fakeFetch({
      signInWithPassword: () => [400, { error: { code: 400, message: 'INVALID_LOGIN_CREDENTIALS' } }],
    });
    await assert.rejects(
      firebaseRestLogin({ email: 'a@example.com', password: 'bad' }, fetchImpl, config),
      /Firebase sign-in failed \(auth\/invalid-credential\)/,
    );
  });

  it('reports a failed fetch (e.g. a dead proxy) as a network error', async () => {
    const fetchImpl = (async () => { throw new Error('proxy refused'); }) as typeof fetch;
    await assert.rejects(
      firebaseRestLogin({ email: 'a@example.com', password: 'pw' }, fetchImpl, config),
      /auth\/network-request-failed/,
    );
  });
});

describe('restErrorCode', () => {
  it('reads the code before any detail text', () => {
    assert.equal(restErrorCode('TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled'), 'auth/too-many-requests');
    assert.equal(restErrorCode('USER_DISABLED'), 'auth/user-disabled');
    assert.equal(restErrorCode('WEAK_PASSWORD'), 'auth/weak-password');
    assert.equal(restErrorCode(undefined), 'unknown');
  });
});
