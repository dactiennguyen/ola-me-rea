# faApi2/reportPost.php

**Báo cáo một bài đăng** (post) vi phạm — luồng chat/quà (gift provider). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/reportPost.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID người báo cáo (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `userBlock` | string | UID chủ bài đăng bị báo cáo | `[Suy luận/AOT]` |
| `displayName` | string | tên hiển thị chủ bài (metadata; mặc định `""`) | `[Suy luận/AOT]` |
| `photoURL` | string | avatar chủ bài (metadata; mặc định `""`) | `[Suy luận/AOT]` |
| `id` | string | ID bài đăng bị báo cáo | `[Suy luận/AOT]` |
| `text` | string | nội dung / lý do báo cáo | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{
  "uid": "<uid>",
  "userBlock": "<peer_uid>",
  "displayName": "Phong nguyen",
  "photoURL": "https://.../avatar.jpg",
  "id": "<post_id>",
  "text": "spam/nội dung phản cảm"
}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts reportPost --userBlock <peer_uid> --id <post_id> --text "..." --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/reportPost.ts`](../../../scripts/nodejs/src/endpoints/reportPost.ts). Thiếu `userBlock`/`id`/`text` sẽ báo lỗi trước khi gửi; `displayName`/`photoURL` mặc định `""` (truyền `""` cũng được).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { reportPost } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(reportPost, {
    userBlock: '<peer-uid>', id: '<post-id>', text: 'spam',
    displayName: 'Phong nguyen', photoURL: 'https://.../avatar.jpg',
  });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts reportPost --userBlock <peer_uid> --id <post_id> --text "..." [--displayName "..."] [--photoURL <url>] [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — ghi một báo cáo bài đăng trên server (gửi tới kiểm duyệt). Đừng gọi tùy tiện.
Báo cáo *người dùng* dùng [`reportUsers.php`](reportUsers.md).

## Bằng chứng

- `work/api_inventory.csv:66` — `ola_flutter_core_chat_gift_provider.dart:1286` keys `uid;userBlock;displayName;photoURL;id;text`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
