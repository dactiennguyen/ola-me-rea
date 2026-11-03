// napi/users/notifications/{uid} — GET -> danh sách thông báo của một tài khoản
//   (màn "Thông báo"). uid nằm trên path; mặc định là tài khoản đang đăng nhập.
//
// Body source [Quan sát]: work/api_runtime_inventory.csv (GET, body "–", luồng "Thông báo");
//   docs/api/endpoint-runtime.md. AOT (work/api_inventory.csv:130, noti_provider.dart:442)
//   không list query key -> gọi không tham số. uid là path param.
// Doc: ../../../../docs/api/endpoints/usersNotifications.md

import { defineEndpoint, segment } from '../endpoint.ts';

export const usersNotifications = defineEndpoint({
  name: 'usersNotifications',
  summary: 'Danh sách thông báo của một tài khoản',
  method: 'GET',
  path: 'napi/users/notifications/:uid',
  session: { uid: 'localId' },
  fields: {
    uid: segment().describe('Chủ danh sách thông báo (nằm trong path)'),
  },
});
