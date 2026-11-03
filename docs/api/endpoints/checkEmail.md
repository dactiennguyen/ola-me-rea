# faApi2/checkEmail.php

Kiểm tra một email đã tồn tại / đã đăng ký trên hệ thống hay chưa. Dùng ở màn **đăng nhập / đăng ký** (provider `ola_flutter_features_login_check_email`), thường chạy **trước** bước Firebase Auth để quyết định hiện form đăng nhập hay đăng ký.

## Method + path

`POST https://sgdev.vip/faApi2/checkEmail.php`

**Auth:** bộ header ký chung (Bearer nếu đã có phiên + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Xem [header xác thực](../auth-va-header.md). Ở luồng thật endpoint này có thể chạy trước khi có `Authorization`.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `email` | string | Email cần kiểm tra | `work/api_inventory.csv` — `check_email_provider.dart:202` [Suy luận/AOT] |

Ví dụ (đã redact):

```json
{ "email": "<email>" }
```

Client Node mặc định lấy `session.email` của phiên đăng nhập; truyền `--email` để kiểm tra một địa chỉ bất kỳ.

## Response

**Chưa bắt response** — endpoint không xuất hiện trên dây trong phiên capture 2026-11-03. Chạy `node scripts/nodejs/ola.ts checkEmail --email you@example.com --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/checkEmail.ts`](../../../scripts/nodejs/src/endpoints/checkEmail.ts). `email` mặc định = email của phiên đăng nhập; phiên không có email thì phải truyền `email`, nếu không sẽ báo lỗi trước khi gửi. `is_success`/`success` bằng false **không** bị coi là lỗi (có thể chính là câu trả lời "không"), nên `ola.call()` trả response thô — tự đọc cờ trong kết quả.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { checkEmail } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(checkEmail, { email: 'you@example.com' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts checkEmail [--email you@example.com]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- `work/api_inventory.csv`: `faApi2/checkEmail.php,POST,ola_flutter_features_login_check_email_provider.dart,202,email`
- `docs/api/endpoint-tinh.md` liệt kê `checkEmail.php` ở nhóm Account/profile.
- Không có dòng runtime (`work/api_runtime_inventory.csv`, `work/runtime_capture_session.log`) → chưa quan sát trên dây.
