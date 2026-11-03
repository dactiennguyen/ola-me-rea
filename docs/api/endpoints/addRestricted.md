# faApi2/addRestricted.php

Hạn chế (**restrict**) một người dùng theo `id` — màn hồ sơ. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/addRestricted.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Danh tính người gọi đi qua Bearer token nên body không có `uid`.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `id` | string | UID người bị hạn chế | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "id": "<peer_uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addRestricted --id <peer_uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addRestricted.ts`](../../../scripts/nodejs/src/endpoints/addRestricted.ts). Thiếu `id` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { addRestricted } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(addRestricted, { id: '<peer-uid>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addRestricted --id <peer_uid>` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — đặt người dùng vào trạng thái hạn chế trên server. Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:7` — `profile_provider.dart:5148` keys `id`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
