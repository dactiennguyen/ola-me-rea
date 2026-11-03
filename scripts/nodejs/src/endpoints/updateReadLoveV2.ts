// faApi2/updateReadLoveV2.php — POST {uid} -> đánh dấu đã đọc thông báo "Tim"/love (xoá badge).
//
// MUTATE: đổi trạng thái đã đọc của luồng thông báo love trên server (cặp với getNotiCountLove.php).
// Body source: work/api_inventory.csv:91 — ola_flutter_features_match_match_provider.dart:1154,
//   CandidateKey uid [Suy luận/AOT]. Chưa bắt trên wire. uid = tài khoản đang đăng nhập.
// Doc: ../../../../docs/api/endpoints/updateReadLoveV2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const updateReadLoveV2 = defineEndpoint({
  name: 'updateReadLoveV2',
  summary: 'Đánh dấu đã đọc thông báo Tim/love (reset badge)',
  method: 'POST',
  path: 'faApi2/updateReadLoveV2.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ các thông báo love'),
  },
});
