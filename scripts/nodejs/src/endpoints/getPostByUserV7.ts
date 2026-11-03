// faApi2/getPostByUserV7.php — POST {uid, page} -> bài đăng của một người dùng (có phân trang).
//
// Body source [Quan sát]: runtime capture 2026-11-03 (luồng "xem hồ sơ"),
//   work/runtime_capture_session.log #37 body {"uid":...,"page":0};
//   work/api_runtime_inventory.csv + work/api_inventory.csv
//   (ola_flutter_features_profile_profile_provider.dart:1326, keys uid;page).
//   uid = chủ hồ sơ cần lấy bài; mặc định tài khoản đăng nhập, truyền uid khác để xem người khác.
// Doc: ../../../../docs/api/endpoints/getPostByUserV7.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const getPostByUserV7 = defineEndpoint({
  name: 'getPostByUserV7',
  summary: 'Bài đăng của một người dùng (phân trang)',
  method: 'POST',
  path: 'faApi2/getPostByUserV7.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ hồ sơ cần lấy bài'),
    page: int().default(0).describe('Trang, bắt đầu từ 0'),
  },
});
