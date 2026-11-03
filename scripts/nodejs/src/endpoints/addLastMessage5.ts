// faApi2/addLastMessage5.php — POST -> lưu tin cuối của hội thoại 1-1 (hiển thị
//   trong danh sách chat). Đi kèm socket `new message` + send-notification khi gửi.
//
// Body source [Quan sát]: work/runtime_capture_session.log (#33, luồng "gửi tin 1-1")
//   {fcmToken,image,timestamp,id,content,uid,userID,isSticker,replyID,replyText};
//   biến thể quà/âm thanh (isGift,isAudio,user,photoURL,displayName) từ
//   work/api_inventory.csv (ola_flutter_features_chat_chat_provider.dart:5832) [Suy luận/AOT].
// Doc: ../../../../docs/api/endpoints/addLastMessage5.md

import { z } from 'zod';
import { defineEndpoint, int, text } from '../endpoint.ts';

export const addLastMessage5 = defineEndpoint({
  name: 'addLastMessage5',
  summary: 'Lưu tin cuối của hội thoại 1-1 (danh sách chat)',
  method: 'POST',
  path: 'faApi2/addLastMessage5.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người gửi'),
    userID: text().describe('Người nhận (peer uid)'),
    // App gửi "" với tin sticker/ảnh.
    content: z.string().describe('Nội dung tin; "" với sticker/ảnh'),
    timestamp: int().optional().describe('Mốc ms client sinh; mặc định Date.now()'),
    id: text().optional().describe('messageID; mặc định "<timestamp><uid>"'),
    fcmToken: z.string().default('').describe('FCM token thiết bị người gửi'),
    image: z.string().default('').describe('URL ảnh nếu là tin ảnh'),
    isSticker: int().nullable().default(null).describe('null/0 tin thường, khác 0 nếu là sticker'),
    replyID: z.string().default('').describe('ID tin được trả lời'),
    replyText: z.string().default('').describe('Trích nội dung tin được trả lời'),
    // Biến thể quà/âm thanh: chỉ gửi khi được truyền (AOT, chưa bắt trên wire).
    isGift: int().optional().describe('1 nếu là quà tặng [Suy luận/AOT]'),
    isAudio: int().optional().describe('1 nếu là tin thoại [Suy luận/AOT]'),
  },
  // id/timestamp do client tự sinh như app (log #33: id = timestamp + uid người gửi).
  request: ({ timestamp = Date.now(), id, ...v }) => ({
    body: {
      fcmToken: v.fcmToken,
      image: v.image,
      timestamp,
      id: id ?? `${timestamp}${v.uid}`,
      content: v.content,
      uid: v.uid,
      userID: v.userID,
      isSticker: v.isSticker,
      replyID: v.replyID,
      replyText: v.replyText,
      isGift: v.isGift,
      isAudio: v.isAudio,
    },
  }),
});
