# faApi2/getNotificationsCount.php

Lấy số badge thông báo (notifications) của người đang đăng nhập — số đỏ trên biểu tượng chuông. App gọi khi **khởi động** và khi cập nhật badge.

- **Method + path:** `POST https://sgdev.vip/faApi2/getNotificationsCount.php`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của **tài khoản đang đăng nhập**. Mặc định = `session.localId`. | [Quan sát] `runtime_capture_session.log` #7/#13 |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getNotificationsCount --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getNotificationsCount.ts`](../../../scripts/nodejs/src/endpoints/getNotificationsCount.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getNotificationsCount } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(getNotificationsCount);   // uid = tài khoản đang đăng nhập
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getNotificationsCount [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #7, #13 (khởi động) — body `{"uid":"<uid>"}`; `work/api_runtime_inventory.csv` dòng `getNotificationsCount.php | uid`.
- [Suy luận] `work/api_inventory.csv:41` — `ola_flutter_features_config_app_badges_provider.dart:1292`, CandidateKeys `uid`.
- Cùng provider badge với [getNotiCountLove.php](getNotiCountLove.md). Tổng quan: [endpoint-runtime.md](../endpoint-runtime.md).
