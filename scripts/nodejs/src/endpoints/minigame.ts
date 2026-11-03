// napi/minigame/:gameKey/... — kho mini game (Bay lên/Flappy, Kẹo ngọt/Sweet, ...).
//   Hai endpoint:
//     - GET  napi/minigame/:gameKey/leaderboard  -> bảng xếp hạng một game  (read)
//     - POST napi/minigame/:gameKey/score        -> nộp điểm một ván        (mutate)
//
// Body source:
//   - GET leaderboard: [Quan sát] work/api_runtime_inventory.csv:40-41 bắt được
//     `napi/minigame/flappy/leaderboard` và `napi/minigame/sweet/leaderboard` (GET),
//     tức mẫu `napi/minigame/{gameKey}/leaderboard`, gameKey ∈ {flappy, sweet, ...};
//     phiên bắt không gửi query. Tham số `limit` là [Suy luận].
//   - POST score: [Chưa xác minh] work/api_inventory.csv:109-112
//     ola_flutter_features_minigame_minigame_score_api.dart (dòng 604/960/1159 GET,
//     1317 POST) chỉ cho path gốc `napi/minigame/`, KHÔNG liệt kê key nào. Hậu tố
//     `/score` và body `{score}` là SUY LUẬN — phải xác minh lại trên dây.
// Doc: ../../../../docs/api/endpoints/minigame.md

import { defineEndpoint, int, segment } from '../endpoint.ts';

const gameKey = () => segment().describe('Mã game: flappy | sweet | ...');

export const minigameLeaderboard = defineEndpoint({
  name: 'minigameLeaderboard',
  summary: 'Bảng xếp hạng một mini game',
  method: 'GET',
  path: 'napi/minigame/:gameKey/leaderboard',
  fields: {
    gameKey: gameKey(),
    limit: int().optional().describe('Giới hạn số dòng [Suy luận]'),
  },
});

export const minigameScore = defineEndpoint({
  name: 'minigameScore',
  summary: 'Nộp điểm một ván mini game [Chưa xác minh path/body]',
  method: 'POST',
  path: 'napi/minigame/:gameKey/score',
  mutates: true,
  fields: {
    gameKey: gameKey(),
    score: int(),
  },
});
