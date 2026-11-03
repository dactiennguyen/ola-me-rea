# faApi2/getViolate.php

Lấy **danh sách vi phạm** có phân trang — màn kiểm duyệt/*Danh sách vi phạm* (violation_provider). Nhiều khả năng là màn quản trị (cần quyền phù hợp). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/getViolate.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `page` | int | Trang cần lấy (mặc định `0`). | `[Suy luận/AOT]` |

Ví dụ body:

```json
{ "page": 0 }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getViolate --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Client ném lỗi nếu `is_success=false` (nhóm faApi2 thường trả `{ is_success, ... }`). `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getViolate.ts`](../../../scripts/nodejs/src/endpoints/getViolate.ts). `page` mặc định `0`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getViolate } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const page0 = await ola.call(getViolate);              // page = 0
  const page1 = await ola.call(getViolate, { page: 1 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getViolate [--page <n>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Suy luận] `work/api_inventory.csv:50` — `ola_flutter_features_violation_violation_provider.dart:1334`, CandidateKeys `page`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
- Cùng provider vi phạm với [updateStrictV2.md](updateStrictV2.md), [updateStrictDel.md](updateStrictDel.md), [getNotificationsV5.md](getNotificationsV5.md).
