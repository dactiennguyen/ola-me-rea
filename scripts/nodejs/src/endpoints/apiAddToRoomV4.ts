// faApi2/apiAddToRoomV4.php — POST {uid, page, state} -> danh sách thành viên / người
//   đang online trong phòng chat (state = mã phòng, phân trang bằng page).
//
// Body source: runtime capture 2026-11-03 (rooms: open member/online list) [Quan sát]
//   work/runtime_capture_session.log #44 {"uid","page":0,"state":"79"}; khớp
//   work/api_inventory.csv (ola_flutter_features_room_listUserRoom_list_user_provider.dart:612,
//   uid;page;state). uid trên dây = tài khoản đang đăng nhập -> mặc định session.localId.
// Doc: ../../../../docs/api/endpoints/apiAddToRoomV4.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const apiAddToRoomV4 = defineEndpoint({
  name: 'apiAddToRoomV4',
  summary: 'Danh sách thành viên / người online trong phòng chat',
  method: 'POST',
  path: 'faApi2/apiAddToRoomV4.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người đang xem'),
    page: int().default(0).describe('Trang, bắt đầu từ 0'),
    state: text().describe('Mã phòng = mã tỉnh/thành, vd 79'),
  },
});
