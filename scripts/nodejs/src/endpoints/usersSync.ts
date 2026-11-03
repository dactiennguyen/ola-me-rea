// napi/users/sync — POST {os,deviceId,ver,displayName,photoURL} -> đồng bộ hồ sơ user.
// ⚠️ Mutate: tạo/cập nhật bản ghi user và đăng ký thiết bị trên server.
//
// Body source: work/runtime_capture_session.log #16 [Quan sát]
//   body = {"os":"android","deviceId":"<deviceId>","ver":"13","displayName":"","photoURL":""}
//   + work/api_inventory.csv (login_user_provider.dart:2170). OlaClient.login() gọi endpoint này.
// Doc: ../../../../docs/api/endpoints/usersSync.md

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const usersSync = defineEndpoint({
  name: 'usersSync',
  summary: 'Đồng bộ hồ sơ user và đăng ký thiết bị (login gọi tự động)',
  method: 'POST',
  path: 'napi/users/sync',
  mutates: true,
  // Phải trùng header `deviceid` đã ký: OlaClient điền cả hai từ cùng config của nó.
  session: { deviceId: 'deviceId', ver: 'androidVersion' },
  fields: {
    os: text().default('android'),
    deviceId: text().describe('Phải trùng header deviceid đã ký'),
    // Phiên bản Android, khác header `ver` (phiên bản app).
    ver: text().describe('Phiên bản Android'),
    // App gửi "" khi không cập nhật.
    displayName: z.string().default(''),
    photoURL: z.string().default(''),
  },
});
