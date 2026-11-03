// faApi2/updateUserInfo.php — POST {condition, value, uid[, isHideFollow]}
//   -> cập nhật một trường hồ sơ/cài đặt theo kiểu key/value cho tài khoản.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_profile_profile_provider.dart:3739   (condition;uid;value)
//   ola_flutter_features_setting_local_settings_provider.dart:2204 (condition;isHideFollow;uid;value)
//   Chưa bắt trên dây -> chưa xác minh kiểu của `value` (string/number/bool).
// Doc: ../../../../docs/api/endpoints/updateUserInfo.md

import { z } from 'zod';
import { defineEndpoint, scalar, text } from '../endpoint.ts';

export const updateUserInfo = defineEndpoint({
  name: 'updateUserInfo',
  summary: 'Cập nhật một trường hồ sơ/cài đặt (condition = value)',
  method: 'POST',
  path: 'faApi2/updateUserInfo.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    condition: text().describe('Tên trường cần đổi, vd bio'),
    value: scalar().describe('Giá trị mới của trường [Chưa xác minh kiểu]'),
    uid: text().describe('Chủ tài khoản'),
    isHideFollow: z.boolean().optional().describe('Ẩn danh sách theo dõi (biến thể cài đặt)'),
  },
});
