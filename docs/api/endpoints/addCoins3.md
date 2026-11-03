# faApi2/addCoins3.php

Cộng xu (coin) cho tài khoản sau khi mua gói nạp qua IAP — màn **Nạp xu** của luồng IAP. `[Suy luận/AOT]` — dựng từ Dart AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/addCoins3.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | tài khoản được cộng xu (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `receipt` | string | biên lai mua hàng của store (Google Play / App Store), bắt buộc, không suy ra được từ session | `[Suy luận/AOT]` |
| `transID` | string | mã giao dịch của store, bắt buộc | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>", "receipt": "<purchase-receipt>", "transID": "GPA.0000-0000-0000-00000" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addCoins3 --receipt <r> --transID <t> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }` kèm số dư xu mới. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addCoins3.ts`](../../../scripts/nodejs/src/endpoints/addCoins3.ts). Thiếu `receipt`/`transID` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { addCoins3 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(addCoins3, { receipt: '<purchase-receipt>', transID: '<transID>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addCoins3 --receipt <r> --transID <t> [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — cộng xu vào ví server (đổi trạng thái/số dư tài khoản). Đừng gọi tùy tiện; chỉ gọi với biên lai mua hàng hợp lệ.

## Bằng chứng

- `work/api_inventory.csv:3` — `ola_flutter_features_iap_AddVipNotifier.dart:891` keys `uid;receipt;transID`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây (phiên test không nạp xu, xem [bao-mat-va-luu-y.md](../bao-mat-va-luu-y.md)).
- Nhắc tới trong [endpoint-tinh.md](../endpoint-tinh.md) nhóm Coin/VIP/notification.
