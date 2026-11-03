# faApi2/addBlockV2.php

**Chặn** một người dùng từ trong luồng chat/quà (gift provider). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/addBlockV2.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID người thực hiện chặn (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `userBlock` | string | UID người bị chặn | `[Suy luận/AOT]` |
| `friendID` | string | id quan hệ bạn/hội thoại gắn với người bị chặn (ngữ nghĩa chưa chắc) | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>", "userBlock": "<peer_uid>", "friendID": "<friend_id>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addBlockV2 --userBlock <peer_uid> --friendID <friend_id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addBlockV2.ts`](../../../scripts/nodejs/src/endpoints/addBlockV2.ts). Thiếu `userBlock`/`friendID` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { addBlockV2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(addBlockV2, { userBlock: '<peer-uid>', friendID: '<friend-id>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addBlockV2 --userBlock <peer_uid> --friendID <friend_id> [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — chặn người dùng trên server (ảnh hưởng quan hệ chat/kết bạn thật). Đừng gọi tùy tiện.
So với [`blockUserV2.php`](blockUserV2.md): đây là biến thể phát từ gift provider với thêm `friendID`.

## Bằng chứng

- `work/api_inventory.csv:2` — `ola_flutter_core_chat_gift_provider.dart:1059` keys `uid;userBlock;friendID`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
