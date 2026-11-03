// faApi2/getContactV3.php — POST {uid} -> danh bạ / danh sách liên hệ của một user.
//
// Body source: [Quan sát] runtime capture 2026-11-03 (khởi động) — body thật
//   {"uid":"<uid>"} ở work/runtime_capture_session.log #8/#19 và
//   work/api_runtime_inventory.csv. [Suy luận] work/api_inventory.csv
//   (ola_flutter_features_contact_contact_provider.dart:398) key `uid`.
//   uid mặc định = tài khoản đang đăng nhập (app tự nạp danh bạ của chính mình).
// Doc: ../../../../docs/api/endpoints/getContactV3.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getContactV3 = defineEndpoint({
  name: 'getContactV3',
  summary: 'Danh bạ / danh sách liên hệ của một user',
  method: 'POST',
  path: 'faApi2/getContactV3.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ danh bạ'),
  },
});
