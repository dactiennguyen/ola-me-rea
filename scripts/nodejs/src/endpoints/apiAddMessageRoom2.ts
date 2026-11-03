// faApi2/apiAddMessageRoom2.php — POST -> lưu một tin nhắn vào phòng chat (bản HTTP của
//   socket "new message"; app emit socket rồi POST cùng payload + roomID + isVerifyAvatar).
//
// Body source: runtime capture 2026-11-03 (rooms: send room message) [Quan sát]
//   work/runtime_capture_session.log #45:
//   {"deviceID","mess","name","userID","photoURL2","send":1,"id","isVip":false,"level":1,
//    "roomID":"79","isVerifyAvatar":0}; khớp work/api_inventory.csv
//   (ola_flutter_features_room_room_provider.dart:2648, deviceID;roomID;isVerifyAvatar).
//   userID trên dây = tài khoản đang đăng nhập -> mặc định session.localId.
// Doc: ../../../../docs/api/endpoints/apiAddMessageRoom2.md

import { z } from 'zod';
import { defineEndpoint, int, text } from '../endpoint.ts';

export const apiAddMessageRoom2 = defineEndpoint({
  name: 'apiAddMessageRoom2',
  summary: 'Gửi một tin nhắn vào phòng chat',
  method: 'POST',
  path: 'faApi2/apiAddMessageRoom2.php',
  mutates: true,
  session: { userID: 'localId' },
  fields: {
    userID: text().describe('Người gửi'),
    roomID: text().describe('Mã phòng = mã tỉnh/thành, vd 79'),
    mess: text().describe('Nội dung tin nhắn'),
    name: text().describe('Tên hiển thị người gửi'),
    // deviceID/photoURL2 có thể rỗng trên dây.
    deviceID: z.string().default('').describe('Android ID máy gửi (broadcast cho cả phòng)'),
    photoURL2: z.string().default('').describe('URL avatar người gửi'),
    id: text().optional().describe('Định danh tin; mặc định "<Date.now()><userID>"'),
    send: int().default(1).describe('Cờ gửi, luôn 1'),
    level: int().default(1).describe('Cấp độ người gửi'),
    isVerifyAvatar: int().default(0).describe('Avatar đã xác thực 0/1'),
    isVip: z.boolean().default(false).describe('Người gửi có VIP không'),
  },
  // id do client tự sinh dạng "<ms_timestamp><uid>" (xem log #45) nếu không truyền.
  request: ({ id, ...v }) => ({
    body: {
      deviceID: v.deviceID,
      mess: v.mess,
      name: v.name,
      userID: v.userID,
      photoURL2: v.photoURL2,
      send: v.send,
      id: id ?? `${Date.now()}${v.userID}`,
      isVip: v.isVip,
      level: v.level,
      roomID: v.roomID,
      isVerifyAvatar: v.isVerifyAvatar,
    },
  }),
});
