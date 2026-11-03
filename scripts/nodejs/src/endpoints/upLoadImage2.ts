// faApi2/upLoadImage2.php — POST {uid, image} -> thêm/đặt ảnh hồ sơ cho tài khoản.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_profile_profile_provider.dart:4307 (uid;image).
//   Body là JSON (quy ước repo cho faApi2) -> `image` nhiều khả năng là base64
//   hoặc URL ảnh đã upload; chưa bắt trên dây nên chưa xác minh định dạng.
// Doc: ../../../../docs/api/endpoints/upLoadImage2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const upLoadImage2 = defineEndpoint({
  name: 'upLoadImage2',
  summary: 'Thêm/đặt ảnh hồ sơ',
  method: 'POST',
  path: 'faApi2/upLoadImage2.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ tài khoản'),
    image: text().describe('Ảnh: base64 hoặc URL đã upload (gửi nguyên chuỗi) [Chưa xác minh]'),
  },
});
