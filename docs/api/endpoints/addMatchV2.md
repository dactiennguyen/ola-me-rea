# faApi2/addMatchV2.php

Tạo một lượt "thích"/match giữa hai tài khoản — luồng **match ("Thích bạn")** / tặng quà trong chat. Call-site nằm trong gift provider nên nhiều khả năng gắn với hành động thích/tặng quà rồi ghi match. [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/addMatchV2.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid1` | string | Người bấm thích (actor); mặc định về tài khoản đăng nhập (`session.localId`) | [Suy luận/AOT] |
| `uid2` | string | UID người được thích (bắt buộc) | [Suy luận/AOT] |

```json
{ "uid1": "<uid>", "uid2": "<uid_muc_tieu>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addMatchV2 --uid2 <uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }`. [Chưa xác minh]

## ⚠️ Tác dụng phụ

**MUTATE**: ghi một match/like thật trên server tới `uid2` (có thể sinh thông báo "Tim" cho họ, xem [getNotiCountLove.php](getNotiCountLove.md)). Đừng gọi tùy tiện.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addMatchV2.ts`](../../../scripts/nodejs/src/endpoints/addMatchV2.ts). Thiếu `uid2` sẽ báo lỗi trước khi gửi; `uid1` mặc định = tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { addMatchV2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(addMatchV2, { uid2: '<uid_muc_tieu>' });   // body {uid1=mình, uid2}
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addMatchV2 --uid2 <uid_muc_tieu> [--uid1 <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: `work/api_inventory.csv:6` — `ola_flutter_core_chat_gift_provider.dart:1518`, CandidateKeys `uid1;uid2`.
- Cùng nhóm match: [getMatchV2.php](getMatchV2.md) (danh sách), [responseMatch.php](responseMatch.md) (phản hồi), [updateReadLoveV2.php](updateReadLoveV2.md) (đánh dấu đã đọc).
- Tổng quan nhóm match/follow/block: [endpoint-tinh.md](../endpoint-tinh.md).
