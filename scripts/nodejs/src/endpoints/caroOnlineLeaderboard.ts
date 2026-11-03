// napi/caro/online/leaderboard — GET {limit?} -> bảng xếp hạng Caro online (PvP).
//   Màn Mini game — Caro, tab bảng xếp hạng online.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:103
//   ola_flutter_features_caro_caro_api.dart:2463, key `limit` (tuỳ chọn).
//   Chưa bắt trên dây (không có trong work/api_runtime_inventory.csv).
// Doc: ../../../../docs/api/endpoints/caroOnlineLeaderboard.md

import { defineEndpoint, int } from '../endpoint.ts';

export const caroOnlineLeaderboard = defineEndpoint({
  name: 'caroOnlineLeaderboard',
  summary: 'Bảng xếp hạng Caro online (PvP)',
  method: 'GET',
  path: 'napi/caro/online/leaderboard',
  fields: {
    limit: int().optional().describe('Số dòng tối đa'),
  },
});
