// faApi2/updateNotification.php — POST {uid, ...} -> cập nhật trạng thái danh sách
//   thông báo của CHÍNH tôi: đánh dấu đã đọc 1 mục, đánh dấu đọc tất cả, hoặc xoá tất cả.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv (noti_provider.dart, dòng 74–78).
//   Ba biến thể call-site:
//     {related_id, uid}            -> đánh dấu đã đọc 1 thông báo (noti_provider.dart:1055/1614)
//     {action, mark_all_read, uid} -> đọc tất cả (noti_provider.dart:2283)
//     {action, delete_all, uid}    -> xoá tất cả (noti_provider.dart:1932)
//   `uid` = chủ danh sách = tôi. Chưa bắt trên dây.
// Doc: ../../../../docs/api/endpoints/updateNotification.md

import { defineEndpoint, oneOf, scalar, text } from '../endpoint.ts';

const isOn = (flag: unknown) => flag !== undefined && ![false, 0, '0', 'false', ''].includes(flag as never);

export const updateNotification = defineEndpoint({
  name: 'updateNotification',
  summary: 'Đánh dấu đã đọc 1 thông báo / đọc tất cả / xoá tất cả',
  method: 'POST',
  path: 'faApi2/updateNotification.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ danh sách thông báo'),
    related_id: scalar().optional().describe('Đánh dấu đã đọc 1 thông báo'),
    action: text().optional().describe('Mặc định mark_all_read / delete_all theo cờ đi kèm'),
    mark_all_read: scalar().optional().describe('Đánh dấu đọc tất cả'),
    delete_all: scalar().optional().describe('Xoá tất cả'),
  },
  // Mỗi lần gọi đúng một thao tác, tránh gửi lẫn delete_all với thao tác khác.
  validate: value => oneOf(value, ['related_id', 'mark_all_read', 'delete_all'], { required: true }),
  request: ({ action, ...body }) => {
    // Các call-site đọc tất cả / xoá tất cả luôn gửi kèm action cùng tên; chỉ thêm
    // khi cờ thật sự bật, để `delete_all: false` không bao giờ đi kèm action xoá.
    if (isOn(body.mark_all_read)) action ??= 'mark_all_read';
    if (isOn(body.delete_all)) action ??= 'delete_all';
    return { body: { ...body, action } };
  },
});
