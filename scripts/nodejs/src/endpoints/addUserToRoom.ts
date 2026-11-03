// faApi2/addUserToRoom.php — POST {uid, state} -> đánh dấu người dùng đang ở trong
//   một phòng chat (state = mã phòng, vd. "79" = Hồ Chí Minh).
//
// Body source: runtime capture 2026-11-03 (rooms: enter Ho Chi Minh) [Quan sát]
//   work/runtime_capture_session.log #41 {"uid","state":"79"}; khớp
//   work/api_inventory.csv (ola_flutter_features_room_room_provider.dart:4844, uid;state).
//   uid trên dây = tài khoản đang đăng nhập -> mặc định session.localId.
// Doc: ../../../../docs/api/endpoints/addUserToRoom.md

import { defineEndpoint, text } from '../endpoint.ts';

export const addUserToRoom = defineEndpoint({
  name: 'addUserToRoom',
  summary: 'Vào phòng chat (đánh dấu đang ở phòng)',
  method: 'POST',
  path: 'faApi2/addUserToRoom.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người vào phòng'),
    state: text().describe('Mã phòng = mã tỉnh/thành, vd 79 = Hồ Chí Minh'),
  },
});
