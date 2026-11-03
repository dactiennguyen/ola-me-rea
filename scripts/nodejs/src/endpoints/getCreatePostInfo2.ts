// faApi2/getCreatePostInfo2.php — POST {uid} -> dữ liệu khởi tạo màn "tạo bài"
//   (quyền đăng, hạn mức ảnh, cảm xúc/feeling, gợi ý check-in, ...).
//
// Body source [Quan sát]: runtime capture 2026-11-03 — luồng "mở màn tạo bài
//   (không đăng)" gửi POST {uid} (work/api_runtime_inventory.csv). Khớp
//   work/api_inventory.csv (ola_flutter_features_create_create_post_provider.dart:1969, key uid).
//   uid mặc định tài khoản đăng nhập (app gửi uid của chính mình khi mở màn tạo bài).
// Doc: ../../../../docs/api/endpoints/getCreatePostInfo2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getCreatePostInfo2 = defineEndpoint({
  name: 'getCreatePostInfo2',
  summary: 'Dữ liệu khởi tạo màn tạo bài viết',
  method: 'POST',
  path: 'faApi2/getCreatePostInfo2.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản mở màn tạo bài'),
  },
});
