// faApi2/delImage.php — POST {id, uid[, isForever]} -> xoá một ảnh hồ sơ theo id.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_profile_profile_provider.dart:4856       (id;isForever;uid)
//   ola_flutter_features_setting_local_settings_provider.dart:573 (id;isForever;uid)
//   `id` = id ảnh, `uid` = chủ tài khoản (mặc định session). Key `isForever`
//   trùng y hệt blockUserV2 ở dòng kề (4829) -> [Chưa xác minh]: có thể là nhiễu
//   AOT / dùng chung builder; chỉ gửi khi caller truyền vào.
// Doc: ../../../../docs/api/endpoints/delImage.md

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const delImage = defineEndpoint({
  name: 'delImage',
  summary: 'Xoá một ảnh hồ sơ theo id',
  method: 'POST',
  path: 'faApi2/delImage.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    id: text().describe('ID ảnh cần xoá'),
    uid: text().describe('Chủ tài khoản'),
    isForever: z.boolean().optional().describe('[Chưa xác minh] có thể là nhiễu AOT; chỉ gửi khi truyền vào'),
  },
});
