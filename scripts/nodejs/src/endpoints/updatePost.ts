// faApi2/updatePost.php — POST {action, id, value, ...} -> endpoint đa năng, chọn
//   thao tác theo trường `action` (lưu FCM token, thao tác bài viết feed, cập nhật
//   hồ sơ, chặn bạn, gỡ tin phòng, ...).
//
// Body source: runtime capture 2026-11-03 — biến thể action="token"
//   {action,id,value} đã bắt trên wire (work/runtime_capture_session.log #12/#23,
//   work/api_runtime_inventory.csv "khởi động — lưu FCM token") [Quan sát].
//   Các biến thể còn lại từ work/api_inventory.csv (11 call-site) [Suy luận/AOT].
// Doc: ../../../../docs/api/endpoints/updatePost.md

import { defineEndpoint, extraFields, identifier, scalar, text } from '../endpoint.ts';

export const updatePost = defineEndpoint({
  name: 'updatePost',
  summary: 'Endpoint đa năng theo `action` (FCM token, bài viết, hồ sơ, chặn bạn, ...)',
  method: 'POST',
  path: 'faApi2/updatePost.php',
  mutates: true,
  fields: {
    action: text().describe('Thao tác, vd token'),
    id: identifier().describe('uid (biến thể token/avatar) hoặc postID'),
    value: scalar().optional().describe('Giá trị của thao tác'),
    // Các biến thể call-site gửi thêm cờ (push, removeFriend, updateAvarta, ...).
    extra: extraFields(),
  },
});
