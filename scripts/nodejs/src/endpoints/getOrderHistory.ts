// faApi2/getOrderHistory.php — POST {uid} -> lịch sử đơn hàng / giao dịch nạp của user.
//
// Body source [Quan sát]: work/api_runtime_inventory.csv (BodyKeys=uid, flow
//   "Lịch sử giao dịch") + docs/api/endpoint-runtime.md; khớp work/api_inventory.csv
//   (ola_flutter_features_iap_history_provider.dart:573). uid mặc định tài khoản đăng nhập.
// Doc: ../../../../docs/api/endpoints/getOrderHistory.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getOrderHistory = defineEndpoint({
  name: 'getOrderHistory',
  summary: 'Lịch sử đơn hàng / giao dịch nạp',
  method: 'POST',
  path: 'faApi2/getOrderHistory.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần lấy lịch sử'),
  },
});
