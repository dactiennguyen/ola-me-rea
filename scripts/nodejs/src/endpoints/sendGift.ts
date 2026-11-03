// faApi2/sendGift.php — POST {uid, displayName, uid2, xu, transID} -> gửi quà (tốn xu)
//   cho một người dùng khác.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:70
//   (ola_flutter_core_chat_gift_provider.dart:724) keys `uid;displayName;uid2;xu;transID`.
//   `uid` = người gửi (mặc định session), `uid2` = người nhận, `xu` = giá trị quà (xu),
//   `displayName` = tên hiển thị gắn với quà (thường tên người nhận), `transID` = id
//   giao dịch do client sinh để chống trùng. Chưa bắt trên dây.
// Doc: ../../../../docs/api/endpoints/sendGift.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const sendGift = defineEndpoint({
  name: 'sendGift',
  summary: 'Gửi quà (trừ xu) cho người dùng khác',
  method: 'POST',
  path: 'faApi2/sendGift.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người gửi'),
    displayName: text().describe('Tên hiển thị gắn với quà (thường tên người nhận)'),
    uid2: text().describe('UID người nhận'),
    xu: int().describe('Giá trị quà, đơn vị xu'),
    transID: text().describe('ID giao dịch do client sinh (chống trùng)'),
  },
});
