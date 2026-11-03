// faApi2/getNotificationsV5.php — POST {page} -> danh sách thông báo có phân trang
//   (phiên bản V5, dùng ở luồng thông báo/vi phạm). Người gọi xác định qua Bearer token.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:42
//   (ola_flutter_features_violation_violation_provider.dart:867, CandidateKeys `page`).
//   Chưa bắt trên dây.
// Doc: ../../../../docs/api/endpoints/getNotificationsV5.md

import { defineEndpoint, int } from '../endpoint.ts';

export const getNotificationsV5 = defineEndpoint({
  name: 'getNotificationsV5',
  summary: 'Danh sách thông báo có phân trang (V5)',
  method: 'POST',
  path: 'faApi2/getNotificationsV5.php',
  fields: {
    page: int().default(0).describe('Trang cần lấy'),
  },
});
