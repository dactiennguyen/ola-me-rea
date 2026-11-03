# faApi2/updateNotification.php

Cập nhật trạng thái **danh sách thông báo của chính tôi**: đánh dấu đã đọc một mục, đánh dấu đọc tất cả, hoặc xoá tất cả. Màn *Thông báo* (noti_provider). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/updateNotification.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

`uid` là chủ danh sách = tài khoản đăng nhập (mặc định `session.localId`). Có **ba biến thể call-site**, mỗi biến thể là một thao tác.

### Biến thể 1 — đánh dấu đã đọc 1 mục (noti_provider.dart:1055 / 1614)

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID chủ danh sách = `<uid>` | `[Suy luận/AOT]` |
| `related_id` | string \| number | ID mục thông báo cần đánh dấu đã đọc | `[Suy luận/AOT]` |

### Biến thể 2 — đọc tất cả (noti_provider.dart:2283)

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID chủ danh sách = `<uid>` | `[Suy luận/AOT]` |
| `action` | string | tên thao tác | `[Suy luận/AOT]` |
| `mark_all_read` | bool/1 | cờ đánh dấu đọc tất cả | `[Suy luận/AOT]` |

### Biến thể 3 — xoá tất cả (noti_provider.dart:1932)

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID chủ danh sách = `<uid>` | `[Suy luận/AOT]` |
| `action` | string | tên thao tác | `[Suy luận/AOT]` |
| `delete_all` | bool/1 | cờ xoá tất cả | `[Suy luận/AOT]` |

> Client yêu cầu phải nêu rõ ít nhất một trong `related_id` / `mark_all_read` / `delete_all`, tránh gọi rỗng vô nghĩa. Khi bật cờ `mark_all_read`/`delete_all` qua CLI, client tự đặt luôn `action` cùng tên (chưa xác minh tên `action` thật — xếp `[Chưa xác minh]`).

Ví dụ body (đã redact):

```json
{ "uid": "<uid>", "related_id": 9001 }
{ "uid": "<uid>", "action": "mark_all_read", "mark_all_read": true }
{ "uid": "<uid>", "action": "delete_all", "delete_all": true }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts updateNotification --mark_all_read --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/updateNotification.ts`](../../../scripts/nodejs/src/endpoints/updateNotification.ts). Mỗi lần gọi đúng một trong `related_id` / `mark_all_read` / `delete_all` (thiếu hoặc gửi lẫn sẽ báo lỗi trước khi gửi); bật `mark_all_read`/`delete_all` thì `action` cùng tên được tự thêm.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { updateNotification } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  await ola.call(updateNotification, { related_id: 9001 });        // đọc 1 mục
  await ola.call(updateNotification, { action: 'mark_all_read', mark_all_read: true }); // đọc tất cả
  await ola.call(updateNotification, { action: 'delete_all', delete_all: true });       // xoá tất cả
} finally {
  await ola.close();
}
```

CLI (`--mark_all_read`/`--delete_all` dùng như cờ trần; thêm `--dry-run` để chỉ in request):

```bash
node scripts/nodejs/ola.ts updateNotification --related_id 9001 --dry-run
node scripts/nodejs/ola.ts updateNotification --mark_all_read --dry-run
node scripts/nodejs/ola.ts updateNotification --delete_all --dry-run
```

## ⚠️ Tác dụng phụ

**Mutate** — đổi trạng thái đọc hoặc **xoá vĩnh viễn** toàn bộ thông báo của tài khoản. `delete_all` không hoàn tác được; đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:74–75` — `noti_provider.dart:1055/1614` keys `related_id;uid`.
- `work/api_inventory.csv:76` — `noti_provider.dart:1932` keys `action;delete_all;uid`.
- `work/api_inventory.csv:77` — `noti_provider.dart:2283` keys `action;mark_all_read;uid`.
- `work/api_inventory.csv:78` — call-site thứ 5 (method `unknown`, không có keys).
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây. Đọc danh sách: [usersNotifications.md](usersNotifications.md) / [getNotificationsV5.md](getNotificationsV5.md).
