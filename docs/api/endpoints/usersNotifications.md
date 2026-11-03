# napi/users/notifications/{uid}

Danh sách **thông báo** của một tài khoản — nạp khi mở màn *Thông báo*. `uid` nằm trên path; mặc định là tài khoản đang đăng nhập. `[Quan sát]`

## Method + path

`GET https://sgdev.vip/napi/users/notifications/{uid}`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request

GET, không có body. `uid` là **path segment** (client khai báo bằng `segment()` để chặn path traversal). Runtime bắt được request đi với query rỗng.

| phần | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `{uid}` (path) | string | UID chủ danh sách thông báo. Mặc định = `session.localId`. | [Quan sát] `api_runtime_inventory.csv` luồng "Thông báo" |

> Cấu trúc đặt `uid` trên path **không** tự chứng minh có thể đọc chéo tài khoản — server vẫn kiểm Bearer token (xem [bao-mat-va-luu-y.md](../bao-mat-va-luu-y.md)).

```text
GET /napi/users/notifications/<uid>
```

## Response

**Chưa bắt response** — runtime chỉ thấy request (body `–`), logger không ghi response. Chạy `node scripts/nodejs/ola.ts usersNotifications --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/usersNotifications.ts`](../../../scripts/nodejs/src/endpoints/usersNotifications.ts). `uid` (path) mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { usersNotifications } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const data = await ola.call(usersNotifications);               // uid = tài khoản đăng nhập
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts usersNotifications [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/api_runtime_inventory.csv` — `GET napi/users/notifications/{uid}`, body `–`, luồng "Thông báo"; [endpoint-runtime.md](../endpoint-runtime.md) dòng 41/57.
- [Suy luận] `work/api_inventory.csv:130` — `noti_provider.dart:442` (method `unknown`, không list query key).
- Ghi trạng thái/đọc/xoá: [updateNotification.md](updateNotification.md). Biến thể POST có phân trang: [getNotificationsV5.md](getNotificationsV5.md).
