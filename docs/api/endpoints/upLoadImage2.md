# faApi2/upLoadImage2.php

Thêm/đặt **ảnh hồ sơ** cho tài khoản đang đăng nhập (màn *Chỉnh sửa hồ sơ* → thêm ảnh). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/upLoadImage2.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID chủ tài khoản (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `image` | string | dữ liệu ảnh — khả năng cao là base64 hoặc URL ảnh đã upload (body là JSON, không phải multipart) | `[Suy luận/AOT]` — chưa xác minh định dạng |

Ví dụ body (đã redact, ảnh rút gọn):

```json
{ "uid": "<uid>", "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts upLoadImage2 --image "data:image/jpeg;base64,/9j/AAA" --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

> Lưu ý: nếu luồng thật dùng `multipart/form-data` thay vì JSON thì client này phải chỉnh lại (xem [con-thieu.md](../con-thieu.md) mục FormData). Hiện giữ JSON theo quy ước repo cho `faApi2/*.php`.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/upLoadImage2.ts`](../../../scripts/nodejs/src/endpoints/upLoadImage2.ts). Thiếu `image` sẽ báo lỗi trước khi gửi. `image` được gửi nguyên chuỗi trong body JSON; `uid` mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { upLoadImage2 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(upLoadImage2, { image: '<base64-hoặc-url>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts upLoadImage2 --image "<base64-hoặc-url>" [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — thêm ảnh vào hồ sơ thật trên server. Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:97` — `profile_provider.dart:4307` keys `uid;image`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
