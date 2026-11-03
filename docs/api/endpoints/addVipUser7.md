# faApi2/addVipUser7.php

Kích hoạt gói **VIP** cho tài khoản sau khi mua qua IAP — có thể tặng cho user khác qua `uidTang`. Màn **Mua VIP** của luồng IAP. `[Suy luận/AOT]` — dựng từ Dart AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/addVipUser7.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | tài khoản đứng mua (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `successRes` | string | kết quả mua thành công từ store (token/biên lai), bắt buộc, không suy ra được từ session | `[Suy luận/AOT]` |
| `uidTang` | string | người **nhận** VIP; mặc định tài khoản đăng nhập (mua cho bản thân, kể cả khi truyền `uid` khác), truyền uid khác để tặng | `[Suy luận/AOT]` |
| `transID` | string | mã giao dịch của store, bắt buộc | `[Suy luận/AOT]` |

Ví dụ body (đã redact) — mua cho chính mình:

```json
{ "uid": "<uid>", "successRes": "<store-success-response>", "uidTang": "<uid>", "transID": "GPA.0000-0000-0000-00000" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addVipUser7 --successRes <s> --transID <t> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }` kèm trạng thái VIP mới. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addVipUser7.ts`](../../../scripts/nodejs/src/endpoints/addVipUser7.ts). Thiếu `successRes`/`transID` sẽ báo lỗi trước khi gửi; `uid` và `uidTang` mặc định = tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { addVipUser7 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  // Mua cho bản thân (uid/uidTang mặc định = tài khoản đăng nhập):
  const res = await ola.call(addVipUser7, { successRes: '<store-success>', transID: '<transID>' });
  // Tặng cho user khác: thêm { uidTang: '<targetUid>' }.
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addVipUser7 --successRes <s> --transID <t> [--uidTang <uid>] [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — kích hoạt VIP trên server (đổi trạng thái tài khoản, có thể trừ/áp giao dịch). Đừng gọi tùy tiện; chỉ gọi với kết quả mua hàng hợp lệ.

## Bằng chứng

- `work/api_inventory.csv:10` — `ola_flutter_features_iap_AddVipNotifier.dart:1834` keys `uid;successRes;uidTang;transID`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
