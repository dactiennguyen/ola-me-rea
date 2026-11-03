// napi/caro/me — GET -> the signed-in account's Caro (gomoku vs AI) stats.
//
// Body source: runtime capture 2026-11-03 (Mini game — Caro) confirmed GET with
//   no parameters; work/api_inventory.csv (caro_api.dart:408) lists no keys.
// Doc: ../../../../docs/api/endpoints/caroMe.md

import { defineEndpoint } from '../endpoint.ts';

export const caroMe = defineEndpoint({
  name: 'caroMe',
  summary: 'Thống kê Caro (đấu với AI) của tài khoản đăng nhập',
  method: 'GET',
  path: 'napi/caro/me',
  fields: {},
});
