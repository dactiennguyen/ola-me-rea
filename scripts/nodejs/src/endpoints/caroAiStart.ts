// napi/caro/ai/start — POST {difficulty, humanFirst} -> mở một ván Caro (cờ caro / gomoku)
//   đấu với AI; server trả gameId + thế cờ ban đầu. Màn Mini game — Caro (đấu máy).
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:100
//   ola_flutter_features_caro_caro_api.dart:582, keys `difficulty;humanFirst`.
//   Chưa bắt trên dây (không có trong work/api_runtime_inventory.csv). Kiểu của
//   `difficulty` (mức độ, int) và mặc định `humanFirst=true` là suy luận.
// Doc: ../../../../docs/api/endpoints/caroAiStart.md

import { z } from 'zod';
import { defineEndpoint, int } from '../endpoint.ts';

export const caroAiStart = defineEndpoint({
  name: 'caroAiStart',
  summary: 'Mở một ván Caro đấu AI',
  method: 'POST',
  path: 'napi/caro/ai/start',
  mutates: true,
  fields: {
    difficulty: int().describe('Mức độ AI'),
    humanFirst: z.boolean().default(true).describe('Người chơi đi trước [Suy luận]'),
  },
});
