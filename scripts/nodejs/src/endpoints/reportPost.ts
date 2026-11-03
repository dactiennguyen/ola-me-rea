// faApi2/reportPost.php — POST {uid, userBlock, displayName, photoURL, id, text}
//   -> báo cáo một bài đăng (post) vi phạm.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:66
//   (ola_flutter_core_chat_gift_provider.dart:1286)
//   keys `uid;userBlock;displayName;photoURL;id;text`. `uid` = người báo cáo
//   (mặc định session), `userBlock` = UID chủ bài bị báo cáo, `id` = ID bài đăng,
//   `text` = nội dung/lý do báo cáo, `displayName`/`photoURL` = tên + avatar chủ bài
//   (metadata hiển thị). Chưa bắt trên dây.
// Doc: ../../../../docs/api/endpoints/reportPost.md

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const reportPost = defineEndpoint({
  name: 'reportPost',
  summary: 'Báo cáo một bài đăng vi phạm',
  method: 'POST',
  path: 'faApi2/reportPost.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người báo cáo'),
    userBlock: text().describe('UID chủ bài bị báo cáo'),
    // Metadata hiển thị của chủ bài; "" khi không có (ví dụ chưa có avatar).
    displayName: z.string().default('').describe('Tên hiển thị chủ bài'),
    photoURL: z.string().default('').describe('Avatar chủ bài'),
    id: text().describe('ID bài đăng'),
    text: text().describe('Nội dung/lý do báo cáo'),
  },
});
