// faApi2/getNotiCountLove.php — POST {uid[, count]} -> số badge thông báo "Tim"/match của tài khoản.
//
// Body source: [Quan sát] runtime capture 2026-11-03 (khởi động) gửi
//   {"uid":"<firebase uid>"} — xem work/runtime_capture_session.log #14/#15 và
//   work/api_runtime_inventory.csv. [Suy luận] work/api_inventory.csv
//   (ola_flutter_features_config_app_badges_provider.dart:1362) liệt kê key `count;uid`;
//   `count` CHƯA thấy trên dây nên để tùy chọn. uid mặc định = tài khoản đang đăng nhập.
// Doc: ../../../../docs/api/endpoints/getNotiCountLove.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const getNotiCountLove = defineEndpoint({
  name: 'getNotiCountLove',
  summary: 'Số badge thông báo "Tim"/match',
  method: 'POST',
  path: 'faApi2/getNotiCountLove.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần đếm badge'),
    count: int().optional().describe('CandidateKey AOT, chưa thấy trên dây [Suy luận]'),
  },
});
