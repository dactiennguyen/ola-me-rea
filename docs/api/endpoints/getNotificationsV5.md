# faApi2/getNotificationsV5.php

Lấy **danh sách thông báo có phân trang** (phiên bản V5) — dùng ở luồng thông báo/vi phạm (violation_provider). Người gọi xác định qua Bearer token. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/getNotificationsV5.php`

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

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getNotificationsV5 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Client ném lỗi nếu `is_success=false` (nhóm faApi2 thường trả `{ is_success, ... }`). `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getNotificationsV5.ts`](../../../scripts/nodejs/src/endpoints/getNotificationsV5.ts). `page` mặc định `0`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getNotificationsV5 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const page0 = await ola.call(getNotificationsV5);              // page = 0
  const page1 = await ola.call(getNotificationsV5, { page: 1 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getNotificationsV5 [--page <n>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Suy luận] `work/api_inventory.csv:42` — `ola_flutter_features_violation_violation_provider.dart:867`, CandidateKeys `page`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
- Cùng nhóm "notification" trong [endpoint-tinh.md](../endpoint-tinh.md). Biến thể GET theo uid: [usersNotifications.md](usersNotifications.md). Danh sách vi phạm: [getViolate.md](getViolate.md).
