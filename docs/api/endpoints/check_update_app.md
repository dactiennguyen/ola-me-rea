# faApi2/check_update_app.php

Kiểm tra bản cập nhật app. App gọi ngay khi **khởi động** (trước cả khi đồng bộ tài khoản) để biết có bản mới / bắt buộc cập nhật hay không.

- **Method + path:** `POST https://sgdev.vip/faApi2/check_update_app.php`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | number | **Hằng số `1`** — không phải Firebase UID của tài khoản. Là cờ/kênh kiểm tra phiên bản. | [Quan sát] `runtime_capture_session.log` #3/#9 gửi `{"uid":1}` |

> Lưu ý: khác với mọi endpoint `faApi2/*` khác trong nhóm khởi động, `uid` ở đây là số `1` cố định. Client vẫn cho phép override qua `--uid` nhưng mặc định giữ đúng giá trị đã bắt.

Ví dụ body (đã redact):

```json
{ "uid": 1 }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts check_update_app --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/check_update_app.ts`](../../../scripts/nodejs/src/endpoints/check_update_app.ts). `uid` mặc định là hằng số `1` đã bắt trên dây. `is_success`/`success` bằng false **không** bị coi là lỗi (có thể chính là câu trả lời "không"), nên `ola.call()` trả response thô — tự đọc cờ trong kết quả.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { check_update_app } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(check_update_app);        // body {uid:1}
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts check_update_app [--uid <uid>]` (thêm `--dry-run` để chỉ in request). Cờ `--uid 2` gửi chuỗi `"2"`; cần số thì dùng `--json '{"uid":2}'`.

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #3, #9 (khởi động) — body `{"uid":1}`; `work/api_runtime_inventory.csv` dòng `uid (=1)`.
- [Suy luận] `work/api_inventory.csv:20` — `ola_flutter_features_config_init_provider.dart:1684`, CandidateKeys `uid`.
- Tổng quan luồng: [endpoint-runtime.md](../endpoint-runtime.md).
