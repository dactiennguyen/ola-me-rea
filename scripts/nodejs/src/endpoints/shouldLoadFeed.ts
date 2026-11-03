// faApi2/shouldLoadFeed.php — POST {uid} -> có nên tải tab bài đăng (feed) của hồ sơ hay không.
//
// Body source [Quan sát]: runtime capture 2026-11-03 (luồng "xem hồ sơ"),
//   work/runtime_capture_session.log #30/#36 body {"uid":...};
//   work/api_runtime_inventory.csv + work/api_inventory.csv
//   (ola_flutter_features_profile_profile_provider.dart:6254, key uid).
//   uid = chủ hồ sơ; mặc định tài khoản đăng nhập, truyền uid khác để hỏi về người khác.
// Doc: ../../../../docs/api/endpoints/shouldLoadFeed.md

import { defineEndpoint, text } from '../endpoint.ts';

export const shouldLoadFeed = defineEndpoint({
  name: 'shouldLoadFeed',
  summary: 'Hỏi có nên tải tab bài đăng của một hồ sơ',
  method: 'POST',
  path: 'faApi2/shouldLoadFeed.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ hồ sơ đang xem'),
  },
  // Câu trả lời "không tải" là bình thường (log #30 không kéo getPostByUserV7, #36 thì có), nên không coi is_success=false là lỗi.
  success: false,
});
