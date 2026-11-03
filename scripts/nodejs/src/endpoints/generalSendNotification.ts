// napi/general/send-notification — POST {token,title,body,data?} -> nhờ backend bắn
//   push notification (FCM) tới một thiết bị. Dùng khi gửi tin 1-1, tương tác post,...
//
// Body source [Quan sát]: work/runtime_capture_session.log (#32, luồng "gửi tin 1-1")
//   {token,title,body,data:{action,photo,messageID,isSticker,isImage,isGift,isAudio,
//    replyText,replyID,fcmToken,user}}; biến thể `str_li_pos` từ work/api_inventory.csv
//   (ola_flutter_core_db_interaction_provider.dart:1687) [Suy luận/AOT].
// Doc: ../../../../docs/api/endpoints/generalSendNotification.md

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const generalSendNotification = defineEndpoint({
  name: 'generalSendNotification',
  summary: 'Nhờ backend bắn push FCM tới một thiết bị',
  method: 'POST',
  path: 'napi/general/send-notification',
  mutates: true,
  fields: {
    token: text().describe('FCM token thiết bị người nhận'),
    title: text().describe('Tiêu đề push (tên người gửi)'),
    body: text().describe('Nội dung push'),
    data: z.record(z.string(), z.unknown()).optional()
      .describe('Payload khi chạm thông báo, vd {action:"chat", messageID, user, ...}'),
    str_li_pos: text().optional().describe('Biến thể tương tác DB [Suy luận/AOT]'),
  },
});
