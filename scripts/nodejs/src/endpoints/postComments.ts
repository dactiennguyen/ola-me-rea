// napi/post/{postId}/comments — POST {page} -> danh sách bình luận của một bài (phân trang).
//
// Dùng khi mở màn "xem bình luận" của một bài trong feed/blog.
// Đường dẫn ĐỘNG: postId nằm trong path; chỉ `page` ở body.
// Body source [Quan sát]: work/api_runtime_inventory.csv:31 (POST, body `page`, luồng
//   "xem bình luận"); work/api_inventory.csv:113
//   (ola_flutter_features_comment_comment_provider.dart:691, base path `napi/post/`).
//   Trang đầu = 1 là [Suy luận] (chưa xác minh trên wire). Chưa bắt response.
// Doc: ../../../../docs/api/endpoints/postComments.md

import { defineEndpoint, int, segment } from '../endpoint.ts';

export const postComments = defineEndpoint({
  name: 'postComments',
  summary: 'Danh sách bình luận của một bài (phân trang)',
  method: 'POST',
  path: 'napi/post/:postId/comments',
  fields: {
    postId: segment().describe('ID bài (nằm trong path)'),
    page: int().default(1).describe('Trang, trang đầu = 1 [Suy luận]'),
  },
});
