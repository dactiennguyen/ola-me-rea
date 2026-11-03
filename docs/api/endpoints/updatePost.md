# faApi2/updatePost.php

Endpoint **đa năng** dùng chung cho nhiều thao tác ghi: lưu FCM token, thao tác bài viết feed, cập nhật hồ sơ, chặn bạn, gỡ tin khỏi phòng, chỉnh cài đặt push... Thao tác được chọn bằng trường `action`.

Biến thể `action="token"` đã bắt trên wire lúc khởi động [Quan sát]; các biến thể còn lại suy từ AOT [Suy luận].

## Method + path

`POST https://sgdev.vip/faApi2/updatePost.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Hợp đồng chung

Mọi call-site đều gửi tối thiểu `action` và `id`; đa số kèm `value`. Một số call-site đặt thêm cờ phụ (tên cờ liệt kê ở bảng biến thể).

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `action` | string | Tên thao tác (chọn nhánh xử lý phía server) | [Quan sát] với `token`, còn lại [Suy luận] |
| `id` | string \| number | Đối tượng của thao tác: `uid` (token/avatar) hoặc `postID` (feed) | [Quan sát]/[Suy luận] |
| `value` | string \| number \| boolean | Giá trị kèm theo thao tác (token, cờ bật/tắt, nội dung...) | [Quan sát]/[Suy luận] |

> Phân tích: trong biến thể đã bắt, body đúng bằng `{action, id, value}` với `action="token"`. Vì vậy các chuỗi như `removeFriend`, `push`, `updateAvarta`, `removeMessFromRoom`, `updatePushStranger`, `removeNoti` nhiều khả năng là **giá trị của `action`** (hoặc cờ phụ cùng tên), không phải field cố định. Xếp vào [Suy luận].

### Ví dụ (biến thể `token` — đã kiểm chứng)

```json
{ "action": "token", "id": "<uid>", "value": "<fcmToken>" }
```

(Giá trị token thật đã bị redact `***` trong log; không sao chép ra ngoài.)

## Các biến thể theo call-site

| action / cờ | id là gì | value / cờ kèm | Nơi gọi (AOT) | Tag |
|---|---|---|---|---|
| `token` | `uid` của tôi | FCM token | `fcm_provider.dart:336` | [Quan sát] |
| thao tác bài viết feed | `postID` | giá trị thao tác | `feed_provider.dart:1826 / 2019 / 2647` | [Suy luận] |
| bật/tắt push của bài | `postID` | `value`, kèm cờ `push` | `feed_provider.dart:3323` | [Suy luận] |
| chặn / gỡ bạn | `uid` đối tượng | kèm cờ `removeFriend` (không có `value`) | `block_provider.dart:530` | [Suy luận] |
| cập nhật hồ sơ | `uid`/`postID` | giá trị cập nhật | `profile_provider.dart:403` | [Suy luận] |
| cập nhật avatar | `uid` | kèm cờ `updateAvarta` | `profile_provider.dart:5026` | [Suy luận] |
| gỡ tin khỏi phòng | `id` tin/phòng | kèm cờ `removeMessFromRoom` | `room_provider.dart:3942` | [Suy luận] |
| bật/tắt nhận push từ người lạ | `uid` | kèm cờ `updatePushStranger` | `local_settings_provider.dart:2627` | [Suy luận] |
| gỡ thông báo | `id` thông báo | kèm cờ `removeNoti` | `violation_provider.dart:393` | [Suy luận] |

Call-site `ViolationListScreen.dart:2216` còn ghép thêm `label, admin, uid, photoURL, score` — là màn quản trị vi phạm, ngoài phạm vi nhóm feed.

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts updatePost --action token --id <uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Biến thể `token` lúc khởi động trả HTTP 200 nhưng body không được ghi trong log. [Chưa xác minh]

## ⚠️ Tác dụng phụ

**MUTATE**: thay đổi trạng thái server tùy `action` (lưu token, like/xoá bài, chặn bạn, gỡ tin phòng, đổi cài đặt...). Phải biết chính xác ngữ nghĩa `action` trước khi gọi; đừng gọi tùy tiện.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/updatePost.ts`](../../../scripts/nodejs/src/endpoints/updatePost.ts). Thiếu `action`/`id` sẽ báo lỗi trước khi gửi. Cờ phụ truyền qua `extra` (giá trị scalar, gộp vào body); `extra` không được trùng `action`/`id`/`value`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { updatePost } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  // Biến thể cơ bản action/id/value:
  await ola.call(updatePost, { action: '<action>', id: '<id>', value: '<value>' });

  // Biến thể có cờ phụ (push, removeFriend, updateAvarta, ...):
  await ola.call(updatePost, { action: '<action>', id: '<id>', extra: { push: 1 } });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts updatePost --action <action> --id <id> [--value <value>] [--extra '{"push":1}']` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` #12 và #23 — `{"action":"token","id":"<uid>","value":"***"}`; `work/api_runtime_inventory.csv` (BodyKeys `action, id, value`, Flow "khởi động — lưu FCM token"); [endpoint-runtime.md](../endpoint-runtime.md).
- Tĩnh: `work/api_inventory.csv` → 11 call-site của `faApi2/updatePost.php` (feed/profile/block/room/setting/violation/fcm).
