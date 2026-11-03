# faApi2/reportUsers.php

**Báo cáo một người dùng** vi phạm — luồng chat/quà (gift provider). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/reportUsers.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid1` | string | UID người báo cáo (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `uid2` | string | UID người bị báo cáo | `[Suy luận/AOT]` |
| `content` | string | nội dung / lý do báo cáo | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "uid1": "<uid>", "uid2": "<peer_uid>", "content": "quấy rối / spam" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts reportUsers --uid2 <peer_uid> --content "..." --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/reportUsers.ts`](../../../scripts/nodejs/src/endpoints/reportUsers.ts). Thiếu `uid2`/`content` sẽ báo lỗi trước khi gửi; `uid1` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { reportUsers } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(reportUsers, { uid2: '<peer-uid>', content: 'quấy rối' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts reportUsers --uid2 <peer_uid> --content "..." [--uid1 <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — ghi một báo cáo người dùng trên server (gửi tới kiểm duyệt). Đừng gọi tùy tiện.
Báo cáo *bài đăng* dùng [`reportPost.php`](reportPost.md).

## Bằng chứng

- `work/api_inventory.csv:67` — `ola_flutter_core_chat_gift_provider.dart:1739` keys `uid1;uid2;content`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
