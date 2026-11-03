// faApi2/getPostByID.php — POST {postID} -> một bài đăng (feed/blog) theo ID.
//
// Dùng ở màn bình luận: nạp lại bài đang được bình luận để hiển thị đầu trang.
// Body source [Suy luận/AOT]: work/api_inventory.csv:44
//   (ola_flutter_features_comment_comment_provider.dart:3582, key `postID`).
//   Chưa bắt trên wire trong phiên 2026-11-03.
// Doc: ../../../../docs/api/endpoints/getPostByID.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getPostByID = defineEndpoint({
  name: 'getPostByID',
  summary: 'Một bài đăng (feed/blog) theo ID',
  method: 'POST',
  path: 'faApi2/getPostByID.php',
  fields: {
    postID: text().describe('ID bài đăng'),
  },
});
