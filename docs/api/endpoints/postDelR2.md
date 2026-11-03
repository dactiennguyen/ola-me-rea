# napi/post/delR2

**Xoá một đối tượng đã upload** khỏi kho lưu trữ R2/S3 — dùng khi huỷ gửi ảnh/voice đang tải lên hoặc gỡ media. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/napi/post/delR2`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `file` | string | tên/khoá đối tượng trong bucket cần xoá | `[Suy luận/AOT]` |
| `path` | string | đường dẫn/thư mục lưu trữ của đối tượng | `[Suy luận/AOT]` |

Ví dụ body:

```json
{ "file": "chat/abc.jpg", "path": "uploads/2026" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts postDelR2 --file <file> --path <path> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postDelR2.ts`](../../../scripts/nodejs/src/endpoints/postDelR2.ts). Thiếu `file`/`path` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { postDelR2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(postDelR2, { file: '<file>', path: '<path>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postDelR2 --file <file> --path <path>` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — xoá vĩnh viễn file trên storage, không khôi phục được. Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:116` — `ola_flutter_core_common_S3Storage.dart:668` keys `file;path`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
