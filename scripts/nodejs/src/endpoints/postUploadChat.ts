// napi/post/uploadChat — POST -> upload file đính kèm của chat (ảnh/voice/sticker)
//   lên kho R2/S3; server trả URL để gắn vào tin nhắn (xem addLastMessage5).
//
// MUTATE: tạo đối tượng mới trên storage.
// Body source [Suy luận/AOT]: work/api_inventory.csv:124
//   (ola_flutter_core_common_S3Storage.dart:1687) CandidateKeys = content-type;x-file-name.
//   LƯU Ý: hai key này trông giống HTTP HEADER của uploader raw-binary (Content-Type,
//   X-File-Name) hơn là field JSON. Transport thật là PUT/POST body nhị phân + 2 header
//   trên -> OlaClient (chỉ gửi JSON, header cố định) KHÔNG tái hiện đủ. Client này gửi
//   JSON xấp xỉ gồm metadata + nội dung để minh hoạ; định dạng thật là [Chưa xác minh].
//   Xem docs/api/con-thieu.md mục FormData.
// Doc: ../../../../docs/api/endpoints/postUploadChat.md

import { defineEndpoint, text } from '../endpoint.ts';

export const postUploadChat = defineEndpoint({
  name: 'postUploadChat',
  summary: 'Upload file đính kèm chat lên R2/S3 [JSON xấp xỉ, chưa xác minh]',
  method: 'POST',
  path: 'napi/post/uploadChat',
  mutates: true,
  // Input dùng tên camelCase cho dễ gọi; request() đổi sang key trên dây (x-file-name, content-type).
  fields: {
    fileName: text().describe('Tên file gốc -> x-file-name'),
    contentType: text().default('application/octet-stream').describe('MIME của file -> content-type'),
    content: text().describe('Nội dung file (base64/đường dẫn) [Chưa xác minh]'),
  },
  request: ({ fileName, contentType, content }) => ({
    body: { 'content-type': contentType, 'x-file-name': fileName, content },
  }),
});
