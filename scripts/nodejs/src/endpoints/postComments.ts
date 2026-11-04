// napi/post/{postId}/comments — POST {page} -> danh sách bình luận của một bài (phân trang).
//
// Dùng khi mở màn "xem bình luận" của một bài trong feed/blog.
// Đường dẫn ĐỘNG: postId nằm trong path; chỉ `page` ở body.
// Body source [Quan sát]: work/api_runtime_inventory.csv:31 (POST, body `page`, luồng
//   "xem bình luận"); work/api_inventory.csv:113
//   (ola_flutter_features_comment_comment_provider.dart:691, base path `napi/post/`).
//   Trang đầu = 0 [Quan sát 2026-11-04]: page 0 trả 10 bình luận đầu, page 1 trả 6 còn lại
//   (bài 16 bình luận). Response {success, data, totalComments}; xem src/blog.ts.
// Doc: ../../../../docs/api/endpoints/postComments.md

import { defineEndpoint, int, segment } from '../endpoint.ts';

export const postComments = defineEndpoint({
  name: 'postComments',
  summary: 'Danh sách bình luận của một bài (phân trang)',
  method: 'POST',
  path: 'napi/post/:postId/comments',
  fields: {
    postId: segment().describe('ID bài (nằm trong path)'),
    page: int().default(0).describe('Trang, trang đầu = 0; 10 bình luận mỗi trang'),
  },
});
