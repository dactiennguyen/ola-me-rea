// faApi2/getAllImages.php — POST {uid} -> toàn bộ ảnh của một hồ sơ (màn "Xem tất cả ảnh").
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   (ola_flutter_features_profile_sub_allphoto_provider.dart:389, key uid).
//   Chưa bắt trên dây trong phiên 2026-11-03 (không có trong api_runtime_inventory.csv).
//   uid = chủ hồ sơ; mặc định tài khoản đăng nhập, truyền uid khác để xem ảnh người khác.
// Doc: ../../../../docs/api/endpoints/getAllImages.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getAllImages = defineEndpoint({
  name: 'getAllImages',
  summary: 'Toàn bộ ảnh của một hồ sơ',
  method: 'POST',
  path: 'faApi2/getAllImages.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ hồ sơ'),
  },
});
