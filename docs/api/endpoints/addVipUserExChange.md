# faApi2/addVipUserExChange.php

Kích hoạt **VIP** bằng cách **đổi** (exchange) thay vì thanh toán store trực tiếp — nhánh "đổi VIP" của luồng IAP. `[Suy luận/AOT]` — dựng từ Dart AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/addVipUserExChange.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | tài khoản đổi VIP (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `successRes` | string | kết quả đổi thành công (token/biên lai), bắt buộc, không suy ra được từ session | `[Suy luận/AOT]` |
| `transID` | string | mã giao dịch, bắt buộc | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>", "successRes": "<exchange-success-response>", "transID": "<transID>" }
```

So với [addVipUser7.php](./addVipUser7.md): biến thể này **không** có `uidTang` (chỉ áp cho chính tài khoản `uid`).

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addVipUserExChange --successRes <s> --transID <t> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }`. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addVipUserExChange.ts`](../../../scripts/nodejs/src/endpoints/addVipUserExChange.ts). Thiếu `successRes`/`transID` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { addVipUserExChange } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(addVipUserExChange, { successRes: '<exchange-success>', transID: '<transID>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addVipUserExChange --successRes <s> --transID <t> [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — kích hoạt VIP qua đổi trên server (đổi trạng thái tài khoản, có thể trừ tài nguyên đổi). Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:11` — `ola_flutter_features_iap_AddVipNotifier.dart:2276` keys `uid;successRes;transID`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
