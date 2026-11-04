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

[Quan sát 2026-11-04] `{is_success: true, message: "done", list_data: [bài]}`; page 0 trả 20 bài mới, các trang sau 10–15 bài cũ hơn, hết thì mảng rỗng. Mỗi bài:

```json
{ "id": 541209, "text": "…", "timePost": "1793784704341", "likeCount": 1, "commentCount": 0,
  "listImage": "https://…/a.jpg,https://…/b.jpg", "imgSize": "1280:1368,1080:1440",
  "location": 79, "uid": "<uid>", "displayName": "…", "photoURL": "https://…", "fcmToken": "…",
  "isVerifyAvatar": true, "isVip": false, "level": 1, "isTrust": 0, "feeling": "", "checkIn": "",
  "requestNewFeed": 2, "receivePush": 1, "totalAcc": 0 }
```

`listImage` và `imgSize` là chuỗi nối bằng dấu phẩy (cùng thứ tự); `location` là mã tỉnh, `-1` khi không có; `timePost` là ms dạng chuỗi. Đọc bằng `loadFeed()` trong [`src/blog.ts`](../../../scripts/nodejs/src/blog.ts).

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getFeedNoiBatV4.ts`](../../../scripts/nodejs/src/endpoints/getFeedNoiBatV4.ts). `page` mặc định `0`, `new` mặc định `1`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getFeedNoiBatV4 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
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
