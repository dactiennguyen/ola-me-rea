// faApi2/getNotificationsCount.php — POST {uid} -> số badge thông báo của tài khoản.
//
// Body source: [Quan sát] runtime capture 2026-11-03 (khởi động) gửi
//   {"uid":"<firebase uid>"} — xem work/runtime_capture_session.log #7/#13 và
//   work/api_runtime_inventory.csv. [Suy luận] work/api_inventory.csv
//   (ola_flutter_features_config_app_badges_provider.dart:1292) liệt kê key `uid`.
//   uid mặc định = tài khoản đang đăng nhập.
// Doc: ../../../../docs/api/endpoints/getNotificationsCount.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getNotificationsCount = defineEndpoint({
  name: 'getNotificationsCount',
  summary: 'Số badge thông báo (chuông)',
  method: 'POST',
  path: 'faApi2/getNotificationsCount.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần đếm badge'),
  },
});
