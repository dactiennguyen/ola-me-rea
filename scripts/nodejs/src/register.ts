// Email registration, as the app's RegisterScreen does it (docs/api/luong-dang-ky.md):
//
//   1. the form rules of the app (email regex, password >= 6, confirm, two checkboxes);
//   2. POST faApi2/checkEmail.php {email}, signed but without Bearer; only valid === true continues;
//   3. Firebase createUserWithEmailAndPassword, then sendEmailVerification.
//
// No users/sync here: the Ola profile is created at the first sign-in, which
// requires the verified email (OlaClient.login). Platform-neutral like client.ts.

import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, initializeAuth, inMemoryPersistence, sendEmailVerification,
  signInWithEmailAndPassword, type Auth,
} from 'firebase/auth';
import { OlaClient } from './client.ts';
import { firebaseDefaults, olaDefaults, type FirebaseConfig, type OlaConfig } from './defaults.ts';
import { checkEmail } from './endpoints/checkEmail.ts';
import type { FetchLike } from './http.ts';

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  /** "Tôi đã đọc và đồng ý với Điều khoản sử dụng" */
  agreeTerms: boolean;
  /** "Tôi xác nhận mình đủ 18 tuổi trở lên" */
  confirmAge: boolean;
}

export interface RegisterOptions {
  /** Signs the checkEmail request; deviceId should be the new account's. */
  config?: OlaConfig;
  firebaseConfig?: FirebaseConfig;
  fetch?: FetchLike;
}

export const TERMS_URL = 'https://olaachat.web.app/TermAppOlaMe.html';

/** The app's email rule (RegisterScreen and ForgotPasswordScreen). */
const EMAIL = /^[^@]+@[^@]+\.[^@]+$/;

export type RegisterErrorCode =
  | 'invalid-input' | 'email-rejected' | 'email-already-in-use' | 'weak-password'
  | 'operation-not-allowed' | 'invalid-email' | 'too-many-requests' | 'network'
  | 'invalid-credential' | 'unknown';

/** A failure with the message the app would show (vi.json / RegisterScreen). */
export class RegisterError extends Error {
  override name = 'RegisterError';
  readonly code: RegisterErrorCode;
  constructor(code: RegisterErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const FIREBASE_MESSAGES: Record<string, [RegisterErrorCode, string]> = {
  'auth/email-already-in-use': ['email-already-in-use', 'Email này đã được sử dụng bởi tài khoản khác.'],
  'auth/weak-password': ['weak-password', 'Mật khẩu quá yếu (cần ít nhất 6 ký tự).'],
  'auth/operation-not-allowed': ['operation-not-allowed', 'Tính năng đăng ký bằng email đang bị tắt.'],
  'auth/invalid-email': ['invalid-email', 'Địa chỉ email không hợp lệ.'],
  'auth/too-many-requests': ['too-many-requests', 'Quá nhiều yêu cầu. Vui lòng thử lại sau'],
  'auth/network-request-failed': ['network', 'Không kết nối được mạng.'],
  'auth/invalid-credential': ['invalid-credential', 'Sai email hoặc mật khẩu.'],
  'auth/wrong-password': ['invalid-credential', 'Sai email hoặc mật khẩu.'],
  'auth/user-not-found': ['invalid-credential', 'Sai email hoặc mật khẩu.'],
};

/** Maps a Firebase SDK error to a RegisterError; other errors pass through. */
export function firebaseError(error: unknown): Error {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && code.startsWith('auth/')) {
    const [mapped, message] = FIREBASE_MESSAGES[code] ?? ['unknown', 'Đã xảy ra lỗi không xác định.'];
    return new RegisterError(mapped, message);
  }
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * The first rule the input breaks, as the app words it, or null. The email
 * is judged trimmed (the app trims it before sending); the password is not.
 */
export function registrationProblem(input: RegisterInput): string | null {
  const email = input.email.trim();
  if (!email) return 'Vui lòng nhập email';
  if (!EMAIL.test(email)) return 'Email sai định dạng';
  if (input.password.length < 6) return 'Mật khẩu phải trên 6 ký tự';
  if (input.password !== input.confirmPassword) return 'Mật khẩu không khớp';
  if (!input.agreeTerms || !input.confirmAge) return 'Vui lòng đồng ý điều khoản và xác nhận độ tuổi.';
  return null;
}

/** faApi2/checkEmail.php without an account: true only for response.valid === true. */
export async function checkEmailAllowed(email: string, options: Pick<RegisterOptions, 'config' | 'fetch'> = {}): Promise<boolean> {
  const client = OlaClient.anonymous({ config: options.config ?? olaDefaults, fetch: options.fetch });
  const response = await client.call(checkEmail, { email }) as { valid?: unknown } | null;
  return response?.valid === true;
}

let appCount = 0;

/** A throwaway Firebase app with in-memory auth, deleted after `use`. */
async function withAuth<T>(firebaseConfig: FirebaseConfig, use: (auth: Auth) => Promise<T>): Promise<T> {
  const app = initializeApp(firebaseConfig, `ola-register-${++appCount}`);
  try {
    return await use(initializeAuth(app, { persistence: inMemoryPersistence }));
  } catch (error) {
    throw firebaseError(error);
  } finally {
    await deleteApp(app).catch(() => {});
  }
}

export interface Registered {
  uid: string;
  email: string;
}

/**
 * Registers like the app: validate, checkEmail, create the Firebase user and
 * send the verification email. The account can sign in (and sync) only after
 * the link in that email is opened.
 */
export async function registerAccount(input: RegisterInput, options: RegisterOptions = {}): Promise<Registered> {
  const problem = registrationProblem(input);
  if (problem) throw new RegisterError('invalid-input', problem);
  const email = input.email.trim();
  if (!await checkEmailAllowed(email, options)) {
    throw new RegisterError('email-rejected', 'Email không hợp lệ, hãy chọn email khác');
  }
  return withAuth(options.firebaseConfig ?? firebaseDefaults, async auth => {
    const { user } = await createUserWithEmailAndPassword(auth, email, input.password);
    await sendEmailVerification(user);
    return { uid: user.uid, email: user.email ?? email };
  });
}

/**
 * Sends the verification email again (the app has no such button; the
 * register screen sends it once). Returns false when already verified.
 */
export async function resendVerificationEmail(
  account: { email: string; password: string }, options: Pick<RegisterOptions, 'firebaseConfig'> = {},
): Promise<boolean> {
  return withAuth(options.firebaseConfig ?? firebaseDefaults, async auth => {
    const { user } = await signInWithEmailAndPassword(auth, account.email.trim(), account.password);
    if (user.emailVerified) return false;
    await sendEmailVerification(user);
    return true;
  });
}
