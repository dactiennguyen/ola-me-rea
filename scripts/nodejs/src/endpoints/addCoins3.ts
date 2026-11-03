// faApi2/addCoins3.php — POST {uid, receipt, transID} -> cộng xu sau khi mua IAP.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_iap_AddVipNotifier.dart:891 (uid;receipt;transID).
//   Chưa bắt trên dây -> `receipt`/`transID` là biên lai + mã giao dịch của store
//   (Google Play / App Store), chưa xác minh định dạng đúng.
// Doc: ../../../../docs/api/endpoints/addCoins3.md

import { defineEndpoint, text } from '../endpoint.ts';

export const addCoins3 = defineEndpoint({
  name: 'addCoins3',
  summary: 'Cộng xu sau khi mua gói nạp IAP',
  method: 'POST',
  path: 'faApi2/addCoins3.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản được cộng xu'),
    receipt: text().describe('Biên lai mua hàng của store'),
    transID: text().describe('Mã giao dịch của store'),
  },
});
