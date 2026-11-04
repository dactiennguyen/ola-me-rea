// Accounts live in accounts.json in the app data dir — plain JSON, passwords
// included, by the owner's choice (no OS keychain). The file is chmod 600 after
// every save. Never store the Ola profile from users/sync here: it carries
// fields such as a password value; only the few display fields below are kept.

import { openJsonFile, restrictDataFile } from './platform.ts';

export interface StoredAccount {
  id: string;
  /** Name shown in the app; defaults to the Ola display name after sign-in. */
  label: string;
  email: string;
  password: string;
  /** Signed into every request as `deviceid` and registered by users/sync. One per account. */
  deviceId: string;
  /** Avatar color when there is no photo. */
  color: string;
  uid?: string;
  displayName?: string;
  photoURL?: string;
  lastLoginAt?: number;
  lastError?: string;
  /** Set when this app registered the account or resent the verification email; cleared at the first sign-in. */
  verificationSentAt?: number;
}

export interface AccountsData {
  version: 1;
  activeId: string | null;
  accounts: StoredAccount[];
}

const FILE = 'accounts.json';
const EMPTY: AccountsData = { version: 1, activeId: null, accounts: [] };

export const ACCOUNT_COLORS = ['#0E7490', '#B45309', '#BE185D', '#1D4ED8', '#15803D', '#7C3AED', '#BE123C', '#4338CA'];

export async function loadAccounts(): Promise<AccountsData> {
  const file = await openJsonFile(FILE);
  const data = await file.get<AccountsData>('data');
  if (!data || data.version !== 1 || !Array.isArray(data.accounts)) return structuredClone(EMPTY);
  return data;
}

export async function saveAccounts(data: AccountsData): Promise<void> {
  const file = await openJsonFile(FILE);
  await file.set('data', data);
  await file.save();
  await restrictDataFile(FILE);
}

function randomHex(bytes: number): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
}

/** 16 hex chars, the shape of an Android ID. */
export const newDeviceId = () => randomHex(8);

export function newAccount(input: Pick<StoredAccount, 'label' | 'email' | 'password'> & Partial<StoredAccount>, index: number): StoredAccount {
  return {
    id: `acc_${randomHex(6)}`,
    deviceId: newDeviceId(),
    color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]!,
    ...input,
  };
}
