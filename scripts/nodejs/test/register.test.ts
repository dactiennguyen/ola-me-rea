import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OlaClient } from '../src/client.ts';
import { defineEndpoint, InputError, text } from '../src/endpoint.ts';
import {
  checkEmailAllowed, firebaseError, RegisterError, registerAccount, registrationProblem, type RegisterInput,
} from '../src/register.ts';

const SERVER_TIME = 1_700_000_000;

function fakeServer(checkEmailReply: unknown) {
  const sent: { path: string; headers: Record<string, string>; body: unknown }[] = [];
  const fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    sent.push({ path: url.pathname, headers: init.headers as Record<string, string>, body: init.body && JSON.parse(String(init.body)) });
    if (url.pathname === '/napi/general/getTimes') return Response.json({ serverTime: SERVER_TIME });
    if (url.pathname === '/faApi2/checkEmail.php') return Response.json(checkEmailReply);
    throw new Error(`unexpected request to ${url.href}`);
  }) as typeof globalThis.fetch;
  return { fetch, sent, calls: () => sent.filter(s => s.path !== '/napi/general/getTimes') };
}

const VALID: RegisterInput = {
  email: '  new@example.com ', password: 'secret1', confirmPassword: 'secret1', agreeTerms: true, confirmAge: true,
};

describe('registrationProblem (RegisterScreen rules)', () => {
  it('accepts a valid form and judges the email trimmed', () => {
    assert.equal(registrationProblem(VALID), null);
  });

  it('reports the first broken rule with the app wording', () => {
    assert.equal(registrationProblem({ ...VALID, email: '   ' }), 'Vui lòng nhập email');
    assert.equal(registrationProblem({ ...VALID, email: 'a@b' }), 'Email sai định dạng');
    assert.equal(registrationProblem({ ...VALID, password: '12345', confirmPassword: '12345' }), 'Mật khẩu phải trên 6 ký tự');
    assert.equal(registrationProblem({ ...VALID, password: '123456', confirmPassword: '123456' }), null, '6 characters is enough');
    assert.equal(registrationProblem({ ...VALID, confirmPassword: 'secret2' }), 'Mật khẩu không khớp');
    assert.equal(registrationProblem({ ...VALID, agreeTerms: false }), 'Vui lòng đồng ý điều khoản và xác nhận độ tuổi.');
    assert.equal(registrationProblem({ ...VALID, confirmAge: false }), 'Vui lòng đồng ý điều khoản và xác nhận độ tuổi.');
  });

  it('does not trim the password', () => {
    assert.equal(registrationProblem({ ...VALID, password: ' abcde', confirmPassword: 'abcde' }), 'Mật khẩu không khớp');
  });
});

describe('checkEmailAllowed', () => {
  it('signs checkEmail without Authorization and reads valid', async () => {
    const server = fakeServer({ valid: true });
    assert.equal(await checkEmailAllowed('new@example.com', { fetch: server.fetch }), true);
    const [call] = server.calls();
    assert.equal(call!.path, '/faApi2/checkEmail.php');
    assert.deepEqual(call!.body, { email: 'new@example.com' });
    assert.equal(call!.headers.Authorization, undefined);
    assert.ok(call!.headers.hash && call!.headers.key2 && call!.headers.timestamp);
  });

  it('is false unless valid is exactly true', async () => {
    for (const reply of [{ valid: false }, { valid: 'true' }, { valid: 1 }, {}, { is_success: true }]) {
      assert.equal(await checkEmailAllowed('x@example.com', { fetch: fakeServer(reply).fetch }), false, JSON.stringify(reply));
    }
  });
});

describe('OlaClient.anonymous', () => {
  it('refuses endpoints that default to the signed-in uid', async () => {
    const server = fakeServer({});
    const getPost = defineEndpoint({
      name: 'getPost', summary: '', method: 'POST', path: 'faApi2/getPostByID.php',
      session: { uid: 'localId' }, fields: { uid: text(), postID: text() },
    });
    await assert.rejects(OlaClient.anonymous({ fetch: server.fetch }).call(getPost, { postID: 'p' }), InputError);
    assert.equal(server.sent.length, 0);
  });
});

describe('registerAccount', () => {
  it('stops on an invalid form before any request', async () => {
    const server = fakeServer({ valid: true });
    await assert.rejects(
      registerAccount({ ...VALID, confirmAge: false }, { fetch: server.fetch }),
      (error: unknown) => error instanceof RegisterError && error.code === 'invalid-input',
    );
    assert.equal(server.sent.length, 0);
  });

  it('stops when checkEmail is not valid, before Firebase', async () => {
    const server = fakeServer({ valid: false });
    await assert.rejects(
      registerAccount(VALID, { fetch: server.fetch }),
      (error: unknown) => error instanceof RegisterError && error.code === 'email-rejected'
        && error.message === 'Email không hợp lệ, hãy chọn email khác',
    );
    assert.deepEqual(server.calls().map(c => c.body), [{ email: 'new@example.com' }]);
  });
});

describe('firebaseError', () => {
  it('maps Firebase codes to the app messages', () => {
    const mapped = firebaseError({ code: 'auth/email-already-in-use' }) as RegisterError;
    assert.equal(mapped.code, 'email-already-in-use');
    assert.equal(mapped.message, 'Email này đã được sử dụng bởi tài khoản khác.');
    assert.equal((firebaseError({ code: 'auth/weak-password' }) as RegisterError).code, 'weak-password');
    assert.equal((firebaseError({ code: 'auth/something-new' }) as RegisterError).message, 'Đã xảy ra lỗi không xác định.');
  });

  it('passes other errors through', () => {
    const error = new Error('boom');
    assert.equal(firebaseError(error), error);
  });
});
