# napi/users/addViewProfile

Ghi lại các lượt **xem hồ sơ** người khác — client gom theo lô (`ProfileViewTracker`) rồi gửi một lần sau khi rời màn hồ sơ. Liên quan màn [Khám phá](../luong-kham-pha.md) → xem hồ sơ.

## Method + path

`POST https://sgdev.vip/napi/users/addViewProfile`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Người xem = chủ Bearer token.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `viewed_ids` | string[] | Danh sách uid hồ sơ vừa được xem (gửi theo lô). Bắt buộc. | [Quan sát] body thật |
| `incognito` | boolean | Chế độ "xem ẩn danh" (không để lộ mình đã xem). Chỉ thấy trong AOT, chưa bắt trên dây. | [Suy luận/AOT] |

```json
{ "viewed_ids": ["<targetUid>"], "incognito": false }
```

## Response

**Chưa bắt response** — logger phiên 2026-11-03 chỉ ghi request. Chạy `node scripts/nodejs/ola.ts usersAddViewProfile --viewed_ids '["<targetUid>"]' --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/usersAddViewProfile.ts`](../../../scripts/nodejs/src/endpoints/usersAddViewProfile.ts). Thiếu `viewed_ids` hoặc mảng rỗng sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { usersAddViewProfile } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  await ola.call(usersAddViewProfile, { viewed_ids: ['<targetUid>'] });
  // xem ẩn danh:
  await ola.call(usersAddViewProfile, { viewed_ids: ['<targetUid>'], incognito: true });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts usersAddViewProfile --viewed_ids '["<uid1>","<uid2>"]' [--incognito]` (thêm `--dry-run` để chỉ in request); `viewed_ids` là JSON array.

## ⚠️ Tác dụng phụ

**Mutate** — ghi lên server rằng bạn đã xem các hồ sơ trong `viewed_ids` (hiện trong mục "ai đã xem bạn" của người bị xem). Đừng gọi tùy tiện.

## Bằng chứng

- Static: `work/api_inventory.csv:127` — `ola_flutter_core_common_ProfileViewTracker.dart:312`, keys `incognito;viewed_ids`.
- Runtime: `work/api_runtime_inventory.csv:27` — body `viewed_ids`, luồng "ghi lượt xem hồ sơ, gửi theo lô sau khi rời hồ sơ"; body thật `{"viewed_ids":["<targetUid>"]}` ở `work/runtime_capture_session.log` (#34, #46).
