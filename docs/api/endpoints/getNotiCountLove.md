# faApi2/getNotiCountLove.php

Lấy số badge thông báo "Tim"/tương hợp (love/match) của người đang đăng nhập. App gọi khi **khởi động** và khi cập nhật badge, cùng provider với `getNotificationsCount`.

- **Method + path:** `POST https://sgdev.vip/faApi2/getNotiCountLove.php`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của **tài khoản đang đăng nhập**. Mặc định = `session.localId`. | [Quan sát] `runtime_capture_session.log` #14/#15 |
| `count` | number | Tùy chọn. CandidateKey trong AOT, **chưa thấy trên dây**; client chỉ gửi khi được truyền. | [Suy luận] `api_inventory.csv:40` CandidateKeys `count;uid` |

Ví dụ body (đã redact) — như đã bắt trên dây:

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getNotiCountLove --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getNotiCountLove.ts`](../../../scripts/nodejs/src/endpoints/getNotiCountLove.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getNotiCountLove } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(getNotiCountLove);              // body {uid}
  // biến thể AOT: ola.call(getNotiCountLove, { count: 0 })  // [Suy luận] chưa xác minh
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getNotiCountLove [--uid <uid>] [--count 0]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #14, #15 (khởi động) — body `{"uid":"<uid>"}`; `work/api_runtime_inventory.csv` dòng `getNotiCountLove.php | uid`.
- [Suy luận] `work/api_inventory.csv:40` — `ola_flutter_features_config_app_badges_provider.dart:1362`, CandidateKeys `count;uid` (`count` chưa quan sát).
- Cùng provider badge với [getNotificationsCount.php](getNotificationsCount.md). Tổng quan: [endpoint-runtime.md](../endpoint-runtime.md).
