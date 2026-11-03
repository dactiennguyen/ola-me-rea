// napi/post/:commentId/like — POST (body rỗng) -> thích/bỏ thích một BÌNH LUẬN.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:115
//   (ola_flutter_features_comment_comment_provider.dart:3065, keys `COMMENT;LIKE;commentId`).
//   `COMMENT`/`LIKE` là hằng enum trong code Dart (loại đối tượng + hành động), `commentId`
//   là tham số đường dẫn → body đi rỗng. Chưa bắt trên wire.
// Doc: ../../../../docs/api/endpoints/postCommentLike.md

import { defineEndpoint, segment } from '../endpoint.ts';

export const postCommentLike = defineEndpoint({
  name: 'postCommentLike',
  summary: 'Bật/tắt lượt thích của bạn trên một bình luận',
  method: 'POST',
  path: 'napi/post/:commentId/like',
  mutates: true,
  fields: {
    commentId: segment().describe('ID bình luận (nằm trong path)'),
  },
});
