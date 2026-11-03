# faApi2/getFeedNoiBatV4.php

Lấy feed "Nổi bật" ở tab **Blog** (danh sách bài viết nổi bật, có phân trang). [Quan sát] — đã bắt request trên wire trong luồng Blog.

## Method + path

`POST https://sgdev.vip/faApi2/getFeedNoiBatV4.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của tài khoản đang xem feed; mặc định về tài khoản đăng nhập | [Quan sát] runtime `uid,page,new` |
| `page` | number | Trang phân trang, bắt đầu từ 0 | [Quan sát] (giá trị mặc định 0 là [Suy luận]) |
| `new` | number | Cờ tải bản mới nhất (quan sát gửi kèm; mặc định `1` là [Suy luận]) | [Suy luận] |

```json
{ "uid": "<uid>", "page": 0, "new": 1 }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getFeedNoiBatV4 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Các endpoint `faApi2/*` khác trả `{ is_success, ... }` kèm danh sách bài viết; client ném lỗi nếu `is_success=false`. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getFeedNoiBatV4.ts`](../../../scripts/nodejs/src/endpoints/getFeedNoiBatV4.ts). `page` mặc định `0`, `new` mặc định `1`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getFeedNoiBatV4 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const feed = await ola.call(getFeedNoiBatV4, { page: 0, new: 1 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getFeedNoiBatV4 [--page 0] [--new 1] [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: [endpoint-runtime.md](../endpoint-runtime.md) dòng Blog; `work/api_runtime_inventory.csv` (BodyKeys `uid, page, new`, Flow "Blog").
- Tĩnh: `work/api_inventory.csv` → `ola_flutter_features_feed_feed_provider.dart:796` (keys `uid;page;new`).
