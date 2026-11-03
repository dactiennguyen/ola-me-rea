// faApi2/getUserInfoForChatV2.php — POST {id} -> thông tin người dùng để hiển thị
//   khi mở hội thoại 1-1 (header chat, trạng thái, avatar...).
//
// Body source [Quan sát]: work/runtime_capture_session.log (#26/#31, luồng "mở chat 1-1")
//   {"id":"<peer_uid>"}; work/api_inventory.csv
//   (ola_flutter_features_chat_chat_user_provider.dart:525) xác nhận key `id`.
// Doc: ../../../../docs/api/endpoints/getUserInfoForChatV2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getUserInfoForChatV2 = defineEndpoint({
  name: 'getUserInfoForChatV2',
  summary: 'Thông tin người dùng cho header chat 1-1',
  method: 'POST',
  path: 'faApi2/getUserInfoForChatV2.php',
  fields: {
    id: text().describe('UID người cần xem (peer của hội thoại)'),
  },
});
