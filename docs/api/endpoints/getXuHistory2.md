# faApi2/getXuHistory2.php

Lấy **lịch sử biến động xu (coin)** của tài khoản — màn **Lịch sử giao dịch** của luồng IAP (tab xu). `[Quan sát]` — đã thấy trên dây trong phiên test.

## Method + path

`POST https://sgdev.vip/faApi2/getXuHistory2.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | tài khoản cần lấy lịch sử xu (mặc định `<uid>` đăng nhập) | `[Quan sát]` — `work/api_runtime_inventory.csv` BodyKeys=`uid` |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — request body đã quan sát trên dây nhưng chưa lưu nội dung phản hồi. Chạy `node scripts/nodejs/ola.ts getXuHistory2 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }` kèm danh sách biến động xu; client ném lỗi nếu `is_success=false`. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getXuHistory2.ts`](../../../scripts/nodejs/src/endpoints/getXuHistory2.ts). `uid` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getXuHistory2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const history = await ola.call(getXuHistory2);   // uid mặc định = tài khoản đăng nhập
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getXuHistory2 [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- `[Quan sát]` `work/api_runtime_inventory.csv` → `POST faApi2/getXuHistory2.php` BodyKeys=`uid`, flow "Lịch sử giao dịch"; cũng liệt kê ở [endpoint-runtime.md](../endpoint-runtime.md).
- Tĩnh: `work/api_inventory.csv:51` — `ola_flutter_features_iap_history_provider.dart:590` key `uid`.
