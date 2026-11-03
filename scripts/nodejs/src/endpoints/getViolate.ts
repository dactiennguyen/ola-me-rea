// faApi2/getViolate.php — POST {page} -> danh sách vi phạm (màn kiểm duyệt/"Danh sách
//   vi phạm"), có phân trang. Người gọi xác định qua Bearer token.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:50
//   (ola_flutter_features_violation_violation_provider.dart:1334, CandidateKeys `page`).
//   Chưa bắt trên dây. Nhiều khả năng là màn quản trị (cần quyền phù hợp).
// Doc: ../../../../docs/api/endpoints/getViolate.md

import { defineEndpoint, int } from '../endpoint.ts';

export const getViolate = defineEndpoint({
  name: 'getViolate',
  summary: 'Danh sách vi phạm có phân trang',
  method: 'POST',
  path: 'faApi2/getViolate.php',
  fields: {
    page: int().default(0).describe('Trang cần lấy'),
  },
});
