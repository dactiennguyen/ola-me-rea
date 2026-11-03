# faApi2/getPostByUserV7.php

Lấy danh sách bài đăng của một người dùng, có phân trang. Gọi khi **mở màn xem hồ sơ** và khi cuộn tab bài đăng của người đó. [Quan sát]

## Method + path

`POST https://sgdev.vip/faApi2/getPostByUserV7.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer Firebase token + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của **chủ hồ sơ** cần lấy bài; mặc định tài khoản đăng nhập | [Quan sát] log #37 |
| `page` | integer | Trang, bắt đầu từ `0`; tăng dần khi cuộn | [Quan sát] log #37 |

```json
{
  "uid": "<uid chủ hồ sơ>",
  "page": 0
}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getPostByUserV7 --uid <uid> --page 0 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Phiên 2026-11-03 chỉ bắt request body + header. Theo convention `faApi2 get*` (xem [Khám phá](../luong-kham-pha.md)) response thường có `is_success`; client **ném lỗi nếu `is_success=false`**, còn cấu trúc trang bài đăng **chưa kiểm chứng**. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getPostByUserV7.ts`](../../../scripts/nodejs/src/endpoints/getPostByUserV7.ts). `uid` mặc định tài khoản đăng nhập, `page` mặc định `0`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getPostByUserV7 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const posts = await ola.call(getPostByUserV7, { uid: '<uid chủ hồ sơ>', page: 0 });
  // Bỏ uid để lấy bài của chính mình; page mặc định 0.
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getPostByUserV7 [--uid <uid>] [--page <n>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` #37 (`{"uid":"zGDVUA8…","page":0}`); luồng "xem hồ sơ" trong [endpoint-runtime.md](../endpoint-runtime.md).
- AOT: `work/api_inventory.csv` → `ola_flutter_features_profile_profile_provider.dart:1326`, keys `uid;page`.
