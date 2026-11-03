// napi/post/upload-post — POST -> upload media (ảnh/video) khi tạo bài viết feed;
//   server trả URL để đính vào bài trong luồng tạo post.
//
// MUTATE: tạo đối tượng mới trên storage.
// Body source [Suy luận/AOT]: work/api_inventory.csv:125
//   (ola_flutter_features_create_create_post_provider.dart:348) CandidateKeys =
//   content-type;x-file-name. Giống postUploadChat: hai key này trông giống HTTP
//   HEADER (Content-Type, X-File-Name) của uploader raw-binary hơn là field JSON.
//   Transport thật = body nhị phân + 2 header -> OlaClient (JSON, header cố định)
//   KHÔNG tái hiện đủ. Client gửi JSON xấp xỉ để minh hoạ; định dạng thật [Chưa xác minh].
//   Xem docs/api/con-thieu.md mục FormData + upload-post.
// Doc: ../../../../docs/api/endpoints/postUploadPost.md

import { defineEndpoint, text } from '../endpoint.ts';

export const postUploadPost = defineEndpoint({
  name: 'postUploadPost',
  summary: 'Upload media bài viết lên R2/S3 [JSON xấp xỉ, chưa xác minh]',
  method: 'POST',
  path: 'napi/post/upload-post',
  mutates: true,
  // Input dùng tên camelCase cho dễ gọi; request() đổi sang key trên dây (x-file-name, content-type).
  fields: {
    fileName: text().describe('Tên file gốc -> x-file-name'),
    contentType: text().default('application/octet-stream').describe('MIME của media -> content-type'),
    content: text().describe('Nội dung file (base64/đường dẫn) [Chưa xác minh]'),
  },
  request: ({ fileName, contentType, content }) => ({
    body: { 'content-type': contentType, 'x-file-name': fileName, content },
  }),
});
