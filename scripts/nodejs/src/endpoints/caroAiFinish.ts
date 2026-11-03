// napi/caro/ai/finish — POST {gameId, moves} -> kết thúc một ván Caro đấu AI đã mở
//   bằng napi/caro/ai/start; gửi lại chuỗi nước đi để server chấm thắng/thua + ghi điểm.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:99
//   ola_flutter_features_caro_caro_api.dart:261, keys `gameId;moves`.
//   Chưa bắt trên dây (không có trong work/api_runtime_inventory.csv). `gameId` lấy từ
//   response của ai/start; `moves` là mảng nước đi (cấu trúc phần tử là suy luận).
// Doc: ../../../../docs/api/endpoints/caroAiFinish.md

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const caroAiFinish = defineEndpoint({
  name: 'caroAiFinish',
  summary: 'Kết thúc một ván Caro đấu AI và ghi điểm',
  method: 'POST',
  path: 'napi/caro/ai/finish',
  mutates: true,
  fields: {
    gameId: text().describe('Mã ván từ response của caroAiStart'),
    moves: z.array(z.unknown()).describe('Mảng nước đi, vd [[7,7],[8,8]] (cấu trúc phần tử là suy luận)'),
  },
});
