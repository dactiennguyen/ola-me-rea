// faApi2/getXuHistory2.php — POST {uid} -> lịch sử biến động xu (coin) của user.
//
// Body source [Quan sát]: work/api_runtime_inventory.csv (BodyKeys=uid, flow
//   "Lịch sử giao dịch") + docs/api/endpoint-runtime.md; khớp work/api_inventory.csv
//   (ola_flutter_features_iap_history_provider.dart:590). uid mặc định tài khoản đăng nhập.
// Doc: ../../../../docs/api/endpoints/getXuHistory2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getXuHistory2 = defineEndpoint({
  name: 'getXuHistory2',
  summary: 'Lịch sử biến động xu',
  method: 'POST',
  path: 'faApi2/getXuHistory2.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần lấy lịch sử xu'),
  },
});
