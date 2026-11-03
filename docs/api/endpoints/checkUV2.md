# faApi2/checkUV2.php

Kiểm tra trạng thái tài khoản (user check) của người đang đăng nhập. App gọi khi **khởi động**, cùng lô với `getCoins`, `getNotificationsCount`.

- **Method + path:** `POST https://sgdev.vip/faApi2/checkUV2.php`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của **tài khoản đang đăng nhập**. Mặc định = `session.localId`. | [Quan sát] `runtime_capture_session.log` #4/#10 |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts checkUV2 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/checkUV2.ts`](../../../scripts/nodejs/src/endpoints/checkUV2.ts). `is_success`/`success` bằng false **không** bị coi là lỗi (có thể chính là câu trả lời "không"), nên `ola.call()` trả response thô — tự đọc cờ trong kết quả.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { checkUV2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(checkUV2);               // uid = tài khoản đang đăng nhập
  // hoặc ola.call(checkUV2, { uid: '<uid-khác>' })
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts checkUV2 [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #4, #10 (khởi động) — body `{"uid":"<uid>"}`; `work/api_runtime_inventory.csv` dòng `checkUV2.php | uid`.
- [Suy luận] `work/api_inventory.csv:23` — `ola_flutter_features_config_init_provider.dart:1243`, CandidateKeys `uid`.
- Tổng quan luồng: [endpoint-runtime.md](../endpoint-runtime.md).
