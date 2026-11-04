# faApi2/checkEmail.php

Hỏi backend xem một email có được phép dùng để **đăng ký** không. Theo AOT, chỉ màn **đăng ký** gọi endpoint này (`RegisterScreenState._addUser`, qua `CheckEmailProvider`), **trước** `createUserWithEmailAndPassword`; màn đăng nhập không gọi. App đọc `response.data["valid"]` (bool): `true` thì tạo tài khoản Firebase, còn lại hiện "Email không hợp lệ, hãy chọn email khác". Xem [luồng đăng ký](../luong-dang-ky.md). [Suy luận/AOT]

## Method + path

`POST https://sgdev.vip/faApi2/checkEmail.php`

**Auth:** bộ header ký chung `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`. Xem [header xác thực](../auth-va-header.md). Ở luồng đăng ký, endpoint chạy khi **chưa có phiên Firebase**, nên app gửi không có `Authorization`.

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

**Chưa bắt response** — endpoint không xuất hiện trên dây trong phiên capture 2026-11-03. Theo AOT (`CheckEmailProvider.checkEmail` `0xad6c00`), app chỉ đọc key **`valid`** và ép kiểu `bool`; chưa biết các key khác và trường hợp nào trả `false`. Chạy `node scripts/nodejs/ola.ts checkEmail --email you@example.com --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

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
