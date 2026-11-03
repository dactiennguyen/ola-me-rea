// faApi2/getLastMessage2.php — POST {roomID} -> danh sách tin cuối của các hội thoại.
//
// Body source: runtime capture 2026-11-03 (khởi động — danh sách hội thoại) [Quan sát]
//   body thật `{"roomID":"<uid>"}` với roomID = uid tài khoản đang đăng nhập;
//   work/api_inventory.csv (ola_flutter_features_message_message_provider.dart:826) list `roomID`.
// roomID mặc định = session.localId (uid của mình) — app dùng chính uid của mình làm khoá hội thoại.
// Doc: ../../../../docs/api/endpoints/getLastMessage2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getLastMessage2 = defineEndpoint({
  name: 'getLastMessage2',
  summary: 'Tin cuối của các hội thoại 1-1 (danh sách hội thoại)',
  method: 'POST',
  path: 'faApi2/getLastMessage2.php',
  session: { roomID: 'localId' },
  fields: {
    roomID: text().describe('Khoá hội thoại; mặc định uid của mình'),
  },
});
