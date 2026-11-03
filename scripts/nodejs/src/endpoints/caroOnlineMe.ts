// napi/caro/online/me — GET -> thống kê Caro online (PvP) của tài khoản đang đăng nhập.
//   Màn Mini game — Caro, chế độ online.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:104
//   ola_flutter_features_caro_caro_api.dart:2685 không liệt kê key nào (GET không tham số,
//   giống napi/caro/me). Chưa bắt trên dây (không có trong work/api_runtime_inventory.csv).
// Doc: ../../../../docs/api/endpoints/caroOnlineMe.md

import { defineEndpoint } from '../endpoint.ts';

export const caroOnlineMe = defineEndpoint({
  name: 'caroOnlineMe',
  summary: 'Thống kê Caro online (PvP) của tài khoản đăng nhập',
  method: 'GET',
  path: 'napi/caro/online/me',
  fields: {},
});
