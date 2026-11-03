# faApi2/sendGift.php

**Gửi quà** (tốn xu) cho một người dùng khác — luồng chat/quà. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/sendGift.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID người gửi quà (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `displayName` | string | tên hiển thị gắn với quà (thường là tên người nhận, dùng cho thông báo) | `[Suy luận/AOT]` |
| `uid2` | string | UID người nhận quà | `[Suy luận/AOT]` |
| `xu` | int | giá trị quà, đơn vị **xu** (coin) | `[Suy luận/AOT]` |
| `transID` | string | id giao dịch do client sinh (chống trùng/nạp lặp) | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>", "displayName": "Phong nguyen", "uid2": "<peer_uid>", "xu": 100, "transID": "<trans_id>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts sendGift --uid2 <peer_uid> --displayName "..." --xu 100 --transID <trans_id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/sendGift.ts`](../../../scripts/nodejs/src/endpoints/sendGift.ts). Thiếu `uid2`/`displayName`/`xu`/`transID` sẽ báo lỗi trước khi gửi; `uid` (người gửi) mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { sendGift } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(sendGift, {
    uid2: '<peer-uid>', displayName: 'Phong nguyen', xu: 100, transID: '<trans-id>',
  });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts sendGift --uid2 <peer_uid> --displayName "..." --xu 100 --transID <trans_id> [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — trừ xu trong ví và gửi quà thật tới người nhận. Xem số dư ví qua [`getCoins.php`](../endpoints/getCoins.md) (nếu có). Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:70` — `ola_flutter_core_chat_gift_provider.dart:724` keys `uid;displayName;uid2;xu;transID`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
