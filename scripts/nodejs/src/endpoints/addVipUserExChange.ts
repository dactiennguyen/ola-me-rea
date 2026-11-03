// faApi2/addVipUserExChange.php — POST {uid, successRes, transID} -> kích hoạt VIP
// bằng cách đổi (exchange), không qua thanh toán store trực tiếp.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_iap_AddVipNotifier.dart:2276 (uid;successRes;transID).
//   Chưa bắt trên dây -> `successRes` là kết quả đổi, `transID` mã giao dịch;
//   chưa xác minh định dạng.
// Doc: ../../../../docs/api/endpoints/addVipUserExChange.md

import { defineEndpoint, text } from '../endpoint.ts';

export const addVipUserExChange = defineEndpoint({
  name: 'addVipUserExChange',
  summary: 'Kích hoạt VIP bằng cách đổi (exchange)',
  method: 'POST',
  path: 'faApi2/addVipUserExChange.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản đổi VIP'),
    successRes: text().describe('Kết quả đổi thành công'),
    transID: text().describe('Mã giao dịch'),
  },
});
