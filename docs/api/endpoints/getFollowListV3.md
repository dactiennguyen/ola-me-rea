# faApi2/getFollowListV3.php

Lấy danh sách **đang theo dõi** / **người theo dõi** của một tài khoản (màn hình Follow trong feed/hồ sơ). [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/getFollowListV3.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID của tài khoản đang được xem danh sách; mặc định về tài khoản đăng nhập | [Suy luận/AOT] |
| `page` | number | Trang phân trang, bắt đầu từ 0 | [Suy luận/AOT] |
| `isFollowing` | number | `1` = danh sách "đang theo dõi", `0` = danh sách "người theo dõi" | [Suy luận] |
| `myUid` | string | UID của người đang xem (để đánh dấu trạng thái theo dõi của tôi với từng mục); mặc định về tài khoản đăng nhập | [Suy luận/AOT] |

```json
{ "uid": "<uid>", "page": 0, "isFollowing": 1, "myUid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getFollowListV3 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }` kèm danh sách user; client ném lỗi nếu `is_success=false`. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getFollowListV3.ts`](../../../scripts/nodejs/src/endpoints/getFollowListV3.ts). `uid` và `myUid` mặc định = tài khoản đăng nhập; `page` mặc định `0`, `isFollowing` mặc định `1`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getFollowListV3 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const following = await ola.call(getFollowListV3, { isFollowing: 1, page: 0 });
  const followers = await ola.call(getFollowListV3, { isFollowing: 0, page: 0 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getFollowListV3 [--isFollowing 1|0] [--page 0] [--uid <uid_khac>] [--myUid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Tĩnh: `work/api_inventory.csv` → `ola_flutter_features_feed_sub_follow_provider.dart:592` (keys `uid;page;isFollowing;myUid`).
