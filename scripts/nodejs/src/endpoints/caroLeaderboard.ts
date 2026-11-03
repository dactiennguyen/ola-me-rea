// napi/caro/leaderboard — GET {period?, limit?} -> bảng xếp hạng Caro đấu AI.
//   Màn Mini game — Caro, tab bảng xếp hạng.
//
// Body source [Quan sát] cho method + [Suy luận/AOT] cho tham số:
//   work/api_runtime_inventory.csv:35 (GET, flow "Mini game — Caro") xác nhận GET,
//   nhưng phiên bắt không gửi query nào. work/api_inventory.csv:101
//   ola_flutter_features_caro_caro_api.dart:839 liệt kê keys `period;limit` (tuỳ chọn).
// Doc: ../../../../docs/api/endpoints/caroLeaderboard.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const caroLeaderboard = defineEndpoint({
  name: 'caroLeaderboard',
  summary: 'Bảng xếp hạng Caro đấu AI',
  method: 'GET',
  path: 'napi/caro/leaderboard',
  fields: {
    period: text().optional().describe('Khoảng thời gian, vd week/month/all [Suy luận]'),
    limit: int().optional().describe('Số dòng tối đa'),
  },
});
