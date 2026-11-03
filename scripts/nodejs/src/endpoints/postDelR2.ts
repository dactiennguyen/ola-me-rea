// napi/post/delR2 — POST {file, path} -> xoá một đối tượng đã upload khỏi kho lưu
//   trữ R2/S3 (dọn file khi huỷ gửi ảnh/voice, gỡ media bài viết...).
//
// MUTATE: xoá vĩnh viễn file trên storage.
// Body source [Suy luận/AOT]: work/api_inventory.csv:116
//   (ola_flutter_core_common_S3Storage.dart:668) CandidateKeys = file;path.
//   Chưa bắt trên wire -> ngữ nghĩa chính xác của file/path là [Chưa xác minh].
// Doc: ../../../../docs/api/endpoints/postDelR2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const postDelR2 = defineEndpoint({
  name: 'postDelR2',
  summary: 'Xoá vĩnh viễn một file đã upload khỏi kho R2/S3',
  method: 'POST',
  path: 'napi/post/delR2',
  mutates: true,
  fields: {
    file: text().describe('Tên/khoá đối tượng trong bucket'),
    path: text().describe('Đường dẫn/thư mục lưu trữ của đối tượng'),
  },
});
