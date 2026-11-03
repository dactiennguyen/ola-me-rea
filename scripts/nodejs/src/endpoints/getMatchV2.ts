// faApi2/getMatchV2.php — POST {uid, page} -> danh sách match/"Thích bạn" (có phân trang).
//
// Body source [Quan sát]: work/api_runtime_inventory.csv — body `uid, page`, luồng "Thích bạn";
//   work/api_inventory.csv:38 — ola_flutter_features_match_match_provider.dart:891, keys uid;page.
//   uid = tài khoản cần lấy danh sách match; mặc định tài khoản đăng nhập. page mặc định 0.
// Doc: ../../../../docs/api/endpoints/getMatchV2.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const getMatchV2 = defineEndpoint({
  name: 'getMatchV2',
  summary: 'Danh sách match / "Thích bạn" (phân trang)',
  method: 'POST',
  path: 'faApi2/getMatchV2.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần lấy danh sách match'),
    page: int().default(0).describe('Trang, bắt đầu từ 0'),
  },
});
