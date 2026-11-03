# faApi2/apiAddFollow.php

Theo dõi một tài khoản (nút "Theo dõi" trong feed và trong hồ sơ người dùng). Nhiều khả năng là toggle theo dõi/bỏ theo dõi. [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/apiAddFollow.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid1` | string | Người bấm theo dõi (actor); mặc định về tài khoản đăng nhập | [Suy luận/AOT] |
| `uid2` | string | UID người được theo dõi (bắt buộc) | [Suy luận/AOT] |

```json
{ "uid1": "<uid>", "uid2": "<uid_muc_tieu>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts apiAddFollow --uid2 <uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }`. [Chưa xác minh]

## ⚠️ Tác dụng phụ

**MUTATE**: thay đổi quan hệ theo dõi trên server (gửi follow thật tới `uid2`, có thể sinh thông báo cho họ). Đừng gọi tùy tiện.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/apiAddFollow.ts`](../../../scripts/nodejs/src/endpoints/apiAddFollow.ts). Thiếu `uid2` sẽ báo lỗi trước khi gửi; `uid1` mặc định = tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { apiAddFollow } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(apiAddFollow, { uid2: '<uid_muc_tieu>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts apiAddFollow --uid2 <uid_muc_tieu> [--uid1 <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Tĩnh: `work/api_inventory.csv` → hai call-site cùng keys `uid1;uid2`:
  - `ola_flutter_features_feed_sub_follow_provider.dart:1304` (từ feed/màn follow)
  - `ola_flutter_features_profile_profile_provider.dart:3302` (từ hồ sơ người dùng)
- Cặp nghịch đảo: [removeFollower.php](removeFollower.md).
