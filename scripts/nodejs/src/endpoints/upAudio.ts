// faApi2/upAudio.php — POST {uid, audio} -> tải lên tin nhắn thoại (voice) của chat.
//   Sau khi upload, client gửi tin với isAudio=1 (xem addLastMessage5).
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   (ola_flutter_core_chat_upload_provider.dart:618) CandidateKeys = uid;audio.
//   Chưa bắt được trên wire -> cách mã hoá `audio` (base64/multipart) là [Chưa xác minh].
//   Client gửi JSON {uid, audio}; `audio` đi nguyên chuỗi, không đọc file.
// Doc: ../../../../docs/api/endpoints/upAudio.md

import { defineEndpoint, text } from '../endpoint.ts';

export const upAudio = defineEndpoint({
  name: 'upAudio',
  summary: 'Tải lên tin nhắn thoại (voice) của chat',
  method: 'POST',
  path: 'faApi2/upAudio.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ tài khoản gửi voice'),
    audio: text().describe('Dữ liệu/đường dẫn audio (gửi nguyên chuỗi) [Chưa xác minh mã hoá]'),
  },
});
