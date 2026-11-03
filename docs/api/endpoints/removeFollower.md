# faApi2/removeFollower.php

Gỡ một người đang **theo dõi bạn** khỏi danh sách follower (nút "Gỡ" trong màn người theo dõi). [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/removeFollower.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid1` | string | Tài khoản của bạn (người đang gỡ follower); mặc định về tài khoản đăng nhập | [Suy luận/AOT] |
| `uid2` | string | UID người theo dõi cần gỡ (bắt buộc) | [Suy luận/AOT] |

```json
{ "uid1": "<uid>", "uid2": "<uid_follower>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts removeFollower --uid2 <uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }`. [Chưa xác minh]

## ⚠️ Tác dụng phụ

**MUTATE**: thay đổi quan hệ theo dõi trên server (gỡ follower thật). Đừng gọi tùy tiện.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/removeFollower.ts`](../../../scripts/nodejs/src/endpoints/removeFollower.ts). Thiếu `uid2` sẽ báo lỗi trước khi gửi; `uid1` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { removeFollower } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  await ola.call(removeFollower, { uid2: '<uid_follower>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts removeFollower --uid2 <uid_follower> [--uid1 <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Tĩnh: `work/api_inventory.csv` → `ola_flutter_features_feed_sub_follow_provider.dart:1940` (keys `uid1;uid2`).
- Cùng cặp `uid1;uid2` với [apiAddFollow.php](apiAddFollow.md): `uid1` = actor (tôi), `uid2` = đối tượng.
