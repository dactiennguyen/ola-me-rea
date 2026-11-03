# faApi2/delImage.php

**Xoá một ảnh hồ sơ** theo `id` — màn *Chỉnh sửa hồ sơ* và *Cài đặt*. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/delImage.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `id` | string | id của ảnh cần xoá | `[Suy luận/AOT]` |
| `uid` | string | UID chủ tài khoản (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `isForever` | bool | **[Chưa xác minh]** — key này trùng y hệt `blockUserV2` ở call-site kề bên (dòng 4829 vs 4856), có thể là nhiễu trích AOT / dùng chung builder; client chỉ gửi khi caller truyền vào | `[Chưa xác minh]` |

Ví dụ body (đã redact):

```json
{ "id": "<image_id>", "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts delImage --id <image_id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/delImage.ts`](../../../scripts/nodejs/src/endpoints/delImage.ts). Thiếu `id` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { delImage } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(delImage, { id: '<image-id>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts delImage --id <image_id> [--uid <uid>] [--isForever]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — xoá ảnh khỏi hồ sơ thật trên server, không khôi phục được. Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:24` — `profile_provider.dart:4856` keys `id;isForever;uid`
- `work/api_inventory.csv:25` — `local_settings_provider.dart:573` keys `id;isForever;uid`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
