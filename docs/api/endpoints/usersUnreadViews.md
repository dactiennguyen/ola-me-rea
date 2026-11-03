# napi/users/unread-views

Số lượt xem hồ sơ **chưa đọc** (badge "ai đã xem bạn") — nạp ở màn hồ sơ của mình.

## Method + path

`GET https://sgdev.vip/napi/users/unread-views`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Người gọi xác định qua Bearer token.

## Request query

GET. AOT list hai khoá `last_checked_views_at` và `last_checked`; **chưa xác minh** là query param hay field trong response. Trong capture runtime, request đi với query rỗng (không bắt được tham số trên dây). Client gửi được thì coi như mốc "đã xem tới đâu".

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `last_checked_views_at` | int (epoch) | Mốc thời gian lần cuối người dùng mở danh sách lượt xem. Tùy chọn. | [Suy luận/AOT] |
| `last_checked` | int (epoch) | Mốc "đã kiểm tra" (biến thể). Tùy chọn. | [Suy luận/AOT] |

```text
GET /napi/users/unread-views
GET /napi/users/unread-views?last_checked_views_at=<epoch>&last_checked=<epoch>
```

## Response

**Chưa bắt response** — runtime chỉ thấy request (body `–`), logger không ghi response. Chạy `node scripts/nodejs/ola.ts usersUnreadViews --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/usersUnreadViews.ts`](../../../scripts/nodejs/src/endpoints/usersUnreadViews.ts). Hai mốc thời gian đều tuỳ chọn.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { usersUnreadViews } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const data = await ola.call(usersUnreadViews);
  // kèm mốc thời gian (nếu dùng):
  const data2 = await ola.call(usersUnreadViews, { last_checked_views_at: 1793703039 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts usersUnreadViews [--last_checked_views_at <epoch>] [--last_checked <epoch>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: `work/api_inventory.csv:132` — `ola_flutter_features_profile_profile_provider.dart:691`, method GET, keys `last_checked_views_at;last_checked`.
- Runtime: `work/api_runtime_inventory.csv:28` — GET, body `–`, luồng "hồ sơ của mình". Cặp đối xứng với [getViewProfile](usersGetViewProfile.md) và [addViewProfile](usersAddViewProfile.md).
