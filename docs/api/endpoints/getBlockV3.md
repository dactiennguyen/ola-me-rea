# faApi2/getBlockV3.php

Lấy **danh sách người dùng đã chặn** của tài khoản — màn *Cài đặt → Danh sách chặn*. `[Quan sát]`

## Method + path

`POST https://sgdev.vip/faApi2/getBlockV3.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID tài khoản cần lấy danh sách chặn (mặc định `<uid>` đăng nhập) | `[Quan sát]` |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — đã quan sát request trên dây (flow *Danh sách chặn*) nhưng chưa bắt body phản hồi. Theo quy ước nhóm `faApi2/get*`, phản hồi dạng `{ "is_success": true/false, ... }` kèm mảng người bị chặn; client sẽ ném lỗi nếu `is_success=false`. Chạy `node scripts/nodejs/ola.ts getBlockV3 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response thật. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getBlockV3.ts`](../../../scripts/nodejs/src/endpoints/getBlockV3.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getBlockV3 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(getBlockV3);                 // mặc định uid = tài khoản đăng nhập
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getBlockV3 [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- `work/api_runtime_inventory.csv:35` — `POST faApi2/getBlockV3.php` BodyKeys `uid`, Flow "Danh sách chặn" `[Quan sát]`
- `docs/api/endpoint-runtime.md:42` — cùng dòng trong bảng runtime
- `work/api_inventory.csv:27` — `ola_flutter_features_block_block_provider.dart:1142` keys `uid`
