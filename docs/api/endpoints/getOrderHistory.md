# faApi2/getOrderHistory.php

Lấy **lịch sử đơn hàng / giao dịch nạp** của tài khoản — màn **Lịch sử giao dịch** của luồng IAP. `[Quan sát]` — đã thấy trên dây trong phiên test.

## Method + path

`POST https://sgdev.vip/faApi2/getOrderHistory.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | tài khoản cần lấy lịch sử (mặc định `<uid>` đăng nhập) | `[Quan sát]` — `work/api_runtime_inventory.csv` BodyKeys=`uid` |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — request body đã quan sát trên dây nhưng chưa lưu nội dung phản hồi. Chạy `node scripts/nodejs/ola.ts getOrderHistory --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }` kèm danh sách đơn hàng; client ném lỗi nếu `is_success=false`. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getOrderHistory.ts`](../../../scripts/nodejs/src/endpoints/getOrderHistory.ts). `uid` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getOrderHistory } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const history = await ola.call(getOrderHistory);   // uid mặc định = tài khoản đăng nhập
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getOrderHistory [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- `[Quan sát]` `work/api_runtime_inventory.csv` → `POST faApi2/getOrderHistory.php` BodyKeys=`uid`, flow "Lịch sử giao dịch"; cũng liệt kê ở [endpoint-runtime.md](../endpoint-runtime.md).
- Tĩnh: `work/api_inventory.csv:43` — `ola_flutter_features_iap_history_provider.dart:573` key `uid`.
