// faApi2/addVipUser7.php — POST {uid, successRes, uidTang, transID} -> kích hoạt VIP
// sau khi mua IAP (có thể tặng cho user khác qua `uidTang`).
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_iap_AddVipNotifier.dart:1834 (uid;successRes;uidTang;transID).
//   Chưa bắt trên dây -> `successRes` là kết quả mua của store, `uidTang` là người
//   nhận VIP (mặc định chính mình), `transID` mã giao dịch; chưa xác minh định dạng.
// Doc: ../../../../docs/api/endpoints/addVipUser7.md

import { defineEndpoint, text } from '../endpoint.ts';

export const addVipUser7 = defineEndpoint({
  name: 'addVipUser7',
  summary: 'Kích hoạt VIP sau khi mua IAP (có thể tặng)',
  method: 'POST',
  path: 'faApi2/addVipUser7.php',
  mutates: true,
  session: { uid: 'localId', uidTang: 'localId' },
  fields: {
    uid: text().describe('Tài khoản đứng mua'),
    successRes: text().describe('Kết quả mua thành công của store'),
    uidTang: text().describe('Người nhận VIP; truyền uid khác để tặng'),
    transID: text().describe('Mã giao dịch của store'),
  },
});
