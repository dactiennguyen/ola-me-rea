// faApi2/reportUsers.php — POST {uid1, uid2, content} -> báo cáo một người dùng.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:67
//   (ola_flutter_core_chat_gift_provider.dart:1739) keys `uid1;uid2;content`.
//   `uid1` = người báo cáo (mặc định session), `uid2` = UID người bị báo cáo,
//   `content` = nội dung/lý do báo cáo. Chưa bắt trên dây.
// Doc: ../../../../docs/api/endpoints/reportUsers.md

import { defineEndpoint, text } from '../endpoint.ts';

export const reportUsers = defineEndpoint({
  name: 'reportUsers',
  summary: 'Báo cáo một người dùng vi phạm',
  method: 'POST',
  path: 'faApi2/reportUsers.php',
  mutates: true,
  session: { uid1: 'localId' },
  fields: {
    uid1: text().describe('Người báo cáo'),
    uid2: text().describe('UID người bị báo cáo'),
    content: text().describe('Nội dung/lý do báo cáo'),
  },
});
