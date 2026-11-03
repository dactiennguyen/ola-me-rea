// faApi2/getCoins.php — POST {uid} -> coin balance / wallet for a user.
//
// Body source: runtime capture 2026-11-03 (khởi động) + work/api_inventory.csv
//   (ola_flutter_features_config_init_provider.dart:665). uid defaults to the
//   signed-in account, which is what the app sends for its own wallet.
// Doc: ../../../../docs/api/endpoints/getCoins.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getCoins = defineEndpoint({
  name: 'getCoins',
  summary: 'Số dư xu và level của một tài khoản',
  method: 'POST',
  path: 'faApi2/getCoins.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần tra ví'),
  },
});
