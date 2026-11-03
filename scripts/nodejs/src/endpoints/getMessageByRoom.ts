// faApi2/getMessageByRoom.php — POST {roomID} -> tải lịch sử tin nhắn của một phòng chat.
//
// Body source: runtime capture 2026-11-03 (rooms: enter Ho Chi Minh) [Quan sát]
//   work/runtime_capture_session.log #42 {"roomID":"79"}; work/api_inventory.csv
//   (ola_flutter_features_room_room_provider.dart:4593) liệt kê thêm `incognito`
//   (chưa bắt trên dây -> tuỳ chọn [Suy luận/AOT]).
// Doc: ../../../../docs/api/endpoints/getMessageByRoom.md

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const getMessageByRoom = defineEndpoint({
  name: 'getMessageByRoom',
  summary: 'Lịch sử tin nhắn của một phòng chat',
  method: 'POST',
  path: 'faApi2/getMessageByRoom.php',
  fields: {
    roomID: text().describe('Mã phòng = mã tỉnh/thành, vd 79'),
    incognito: z.boolean().optional().describe('Cờ ẩn danh [Suy luận/AOT], chưa thấy trên dây'),
  },
});
