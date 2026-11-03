// faApi2/getRanking.php — POST {uid} -> bảng xếp hạng (ranking theo level) cho màn Level.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_iap_level_level_provider.dart:449 (uid). Chưa bắt trên dây
//   (leaderboard mini game trong phiên test đi qua napi/caro + napi/minigame, không
//   phải endpoint này). uid mặc định tài khoản đăng nhập.
// Doc: ../../../../docs/api/endpoints/getRanking.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getRanking = defineEndpoint({
  name: 'getRanking',
  summary: 'Bảng xếp hạng theo level (màn Level)',
  method: 'POST',
  path: 'faApi2/getRanking.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản xem bảng xếp hạng'),
  },
});
