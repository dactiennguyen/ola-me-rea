# faApi2/getCreatePostInfo2.php

Lấy dữ liệu khởi tạo cho **màn tạo bài viết** (quyền đăng, hạn mức ảnh, danh sách cảm xúc/feeling, gợi ý check-in...). App gọi ngay khi **mở màn tạo bài**, trước khi người dùng bấm đăng. [Quan sát]

- **Method + path:** `POST https://sgdev.vip/faApi2/getCreatePostInfo2.php`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của **tài khoản đang đăng nhập**. Mặc định = `session.localId`. | [Quan sát] `api_runtime_inventory.csv` (mở màn tạo bài) |

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getCreatePostInfo2 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Theo convention `faApi2 get*`, response thường có `is_success`; client **ném lỗi nếu `is_success=false`**, phần dữ liệu còn lại **chưa kiểm chứng**. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getCreatePostInfo2.ts`](../../../scripts/nodejs/src/endpoints/getCreatePostInfo2.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getCreatePostInfo2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const info = await ola.call(getCreatePostInfo2);   // body {uid}, uid mặc định chính mình
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getCreatePostInfo2 [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/api_runtime_inventory.csv` — dòng `faApi2/getCreatePostInfo2.php | uid | "mở màn tạo bài (không đăng)"`.
- [Suy luận] `work/api_inventory.csv` — `ola_flutter_features_create_create_post_provider.dart:1969`, CandidateKey `uid`.
- Cùng provider với [apiAddPostV9.php](apiAddPostV9.md) (luồng tạo bài viết).
