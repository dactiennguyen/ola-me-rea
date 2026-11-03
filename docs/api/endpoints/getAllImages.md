# faApi2/getAllImages.php

Lấy **toàn bộ ảnh** của một hồ sơ cho màn "Xem tất cả ảnh" (sub-screen của hồ sơ). [Suy luận]

## Method + path

`POST https://sgdev.vip/faApi2/getAllImages.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer Firebase token + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của **chủ hồ sơ** cần lấy ảnh; mặc định tài khoản đăng nhập | [Suy luận/AOT] |

```json
{
  "uid": "<uid chủ hồ sơ>"
}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getAllImages --uid <uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Endpoint **chưa bắt được trên dây** trong phiên 2026-11-03 (không mở sub-screen "Xem tất cả ảnh"), chỉ có trong inventory AOT. Theo convention `faApi2 get*` response thường có `is_success` (client ném lỗi nếu `is_success=false`), cấu trúc danh sách ảnh **chưa kiểm chứng**. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getAllImages.ts`](../../../scripts/nodejs/src/endpoints/getAllImages.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getAllImages } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const images = await ola.call(getAllImages, { uid: '<uid chủ hồ sơ>' });
  // Bỏ uid để lấy ảnh của chính mình.
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getAllImages [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- AOT: `work/api_inventory.csv` → `ola_flutter_features_profile_sub_allphoto_provider.dart:389`, key `uid`; cũng có trong `work/php_endpoints.txt:22`.
- Runtime: **chưa có** trong `work/api_runtime_inventory.csv`; không phát sinh trong luồng "xem hồ sơ" đã bắt vì không mở sub-screen ảnh.
