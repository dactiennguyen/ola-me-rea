# napi/users/getViewProfile

Lấy danh sách **người đã xem hồ sơ của mình** ("ai đã xem bạn") — màn hồ sơ / mục lượt xem.

## Method + path

`GET https://sgdev.vip/napi/users/getViewProfile`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Người gọi xác định qua Bearer token.

## Request body / query

GET, **không có tham số** trong phân tích tĩnh.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| (không có) | – | Định danh lấy từ Bearer token | [Suy luận/AOT] api_inventory.csv không list key |

```text
GET /napi/users/getViewProfile
```

## Response

**Chưa bắt response** — endpoint không xuất hiện trong capture phiên 2026-11-03 (chỉ có trong inventory tĩnh). Chạy `node scripts/nodejs/ola.ts usersGetViewProfile --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/usersGetViewProfile.ts`](../../../scripts/nodejs/src/endpoints/usersGetViewProfile.ts). Không có tham số.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { usersGetViewProfile } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const data = await ola.call(usersGetViewProfile);
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts usersGetViewProfile` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: `work/api_inventory.csv:128` — `ola_flutter_features_feed_sub_viewprofile_provider.dart:474`, method GET, không có key.
- Runtime: không bắt được trong phiên 2026-11-03. Cặp đối xứng với [addViewProfile](usersAddViewProfile.md) (ghi) và [unread-views](usersUnreadViews.md) (badge chưa đọc).
