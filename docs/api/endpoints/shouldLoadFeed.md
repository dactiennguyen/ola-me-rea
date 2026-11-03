# faApi2/shouldLoadFeed.php

Hỏi backend **có nên tải tab bài đăng (feed)** của một hồ sơ hay không. Gọi khi **mở màn xem hồ sơ**, ngay sau `getUserInfoV7`. [Quan sát]

## Method + path

`POST https://sgdev.vip/faApi2/shouldLoadFeed.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer Firebase token + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của **chủ hồ sơ** đang xem; mặc định tài khoản đăng nhập | [Quan sát] log #30/#36 |

```json
{
  "uid": "<uid chủ hồ sơ>"
}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts shouldLoadFeed --uid <uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Phiên 2026-11-03 chỉ bắt request body + header; tên endpoint gợi ý trả về cờ boolean quyết định có gọi tiếp `getPostByUserV7` hay không, nhưng **chưa kiểm chứng** cấu trúc. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/shouldLoadFeed.ts`](../../../scripts/nodejs/src/endpoints/shouldLoadFeed.ts). `uid` mặc định là tài khoản đăng nhập. Endpoint không coi `is_success=false` là lỗi (câu trả lời "không tải feed" là bình thường) nên luôn trả nguyên response.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { shouldLoadFeed } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const flag = await ola.call(shouldLoadFeed, { uid: '<uid chủ hồ sơ>' });
  // Bỏ uid để hỏi về chính mình.
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts shouldLoadFeed [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` #30 (`{"uid":"Zg7…"}`) và #36; luồng "xem hồ sơ" trong [endpoint-runtime.md](../endpoint-runtime.md).
- AOT: `work/api_inventory.csv` → `ola_flutter_features_profile_profile_provider.dart:6254`, key `uid`.
