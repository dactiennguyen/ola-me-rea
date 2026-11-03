// Node-only helpers for the CLIs: sign in with the .env account and the
// env-resolved config (see config.ts). Library code that must also run in a
// webview imports client.ts directly and passes these values itself.

import { OlaClient, dryRunSession, type LoginOptions } from './client.ts';
import { accountFromEnv, firebaseConfig, olaConfig } from './config.ts';

export type EnvLoginOptions = Omit<LoginOptions, 'account'> & Partial<Pick<LoginOptions, 'account'>>;

/** OlaClient.login() with the .env account, OLA_* config and Firebase config. */
export function loginFromEnv(options: EnvLoginOptions = {}): Promise<OlaClient> {
  return OlaClient.login({
    config: olaConfig,
    firebaseConfig,
    ...options,
    account: options.account ?? accountFromEnv(),
  });
}

/** dryRunSession() with the env-resolved device identity (OLA_DEVICE_ID, ...). */
export const envDryRunSession = () => dryRunSession(olaConfig);
