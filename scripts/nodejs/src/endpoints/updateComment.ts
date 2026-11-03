// faApi2/updateComment.php — POST {id[, ...]} -> cập nhật/sửa một bình luận theo id.
//
// MUTATE: thay đổi một bình luận trên server.
// Body source [Suy luận/AOT]: work/api_inventory.csv:73
//   (ola_flutter_features_comment_comment_provider.dart:2449, key `id`).
//   Chỉ khôi phục được `id` từ AOT; các trường khác (vd nội dung sửa) CHƯA xác minh —
//   truyền thêm qua extra khi phát hiện. Chưa bắt trên wire.
// Doc: ../../../../docs/api/endpoints/updateComment.md

import { defineEndpoint, extraFields, text } from '../endpoint.ts';

export const updateComment = defineEndpoint({
  name: 'updateComment',
  summary: 'Sửa/cập nhật một bình luận theo id',
  method: 'POST',
  path: 'faApi2/updateComment.php',
  mutates: true,
  fields: {
    id: text().describe('ID bình luận cần cập nhật'),
    // Trường nội dung sửa / cờ khác chưa khôi phục từ AOT.
    extra: extraFields(),
  },
});
