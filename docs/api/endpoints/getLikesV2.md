# faApi2/getLikesV2.php

Lấy danh sách người đã **thích** một bài viết (mở màn "lượt thích" của một bài trong feed). [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/getLikesV2.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `postID` | string | ID bài viết cần lấy danh sách thích (bắt buộc, không suy ra được từ session) | [Suy luận/AOT] |
| `page` | number | Trang phân trang, bắt đầu từ 0 | [Suy luận/AOT] |

```json
{ "postID": "540919", "page": 0 }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getLikesV2 --postID <id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }` kèm danh sách user đã thích; client ném lỗi nếu `is_success=false`. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getLikesV2.ts`](../../../scripts/nodejs/src/endpoints/getLikesV2.ts). Thiếu `postID` sẽ báo lỗi trước khi gửi; `page` mặc định `0`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getLikesV2 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const likes = await ola.call(getLikesV2, { postID: '540919', page: 0 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getLikesV2 --postID 540919 [--page 0]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Tĩnh: `work/api_inventory.csv` → `ola_flutter_features_feed_sub_like_provider.dart:444` (keys `postID;page`).
- `postID` kiểu ID bài viết: đối chiếu socket `new message` `relateID: 540919` (contenType `post`) trong [socket-io.md](../socket-io.md).
