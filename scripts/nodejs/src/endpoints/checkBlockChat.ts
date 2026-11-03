// faApi2/checkBlockChat.php — POST {uid} -> kiểm tra tài khoản có bị cấm chat không
//   (gọi mỗi lần vào phòng chat).
//
// Body source: runtime capture 2026-11-03 (rooms: enter Ho Chi Minh) [Quan sát]
//   work/runtime_capture_session.log #43 {"uid":"<uid tài khoản>"}; khớp
//   work/api_inventory.csv (ola_flutter_features_room_listUserRoom_check_block.dart:485, uid).
//   uid trên dây = tài khoản đang đăng nhập -> mặc định session.localId.
// Doc: ../../../../docs/api/endpoints/checkBlockChat.md

import { defineEndpoint, text } from '../endpoint.ts';

export const checkBlockChat = defineEndpoint({
  name: 'checkBlockChat',
  summary: 'Kiểm tra tài khoản có bị cấm chat (khi vào phòng chat)',
  method: 'POST',
  path: 'faApi2/checkBlockChat.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần kiểm tra'),
  },
  // Endpoint hỏi–đáp: `is_success`/`success` có thể chính là câu trả lời "không"
  // (chưa bắt response nào), nên không coi false là lỗi; xem response thô.
  success: false,
});
