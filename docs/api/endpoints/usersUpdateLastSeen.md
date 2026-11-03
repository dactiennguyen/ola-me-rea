# napi/users/updateLastSeen

Cập nhật mốc "online gần nhất" (last seen) của tài khoản — gọi lúc khởi động app / khi app foreground.

## Method + path

`POST https://sgdev.vip/napi/users/updateLastSeen`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Server lấy định danh người dùng từ Bearer token, **không** nhận uid trong body.

## Request body

Body **rỗng** `{}` — không có field.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| (không có) | – | Định danh lấy từ Bearer token | [Quan sát] body thật `{}` |

```json
{}
```

## Response

**Chưa bắt response** — logger phiên 2026-11-03 chỉ ghi request. Chạy `node scripts/nodejs/ola.ts usersUpdateLastSeen --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/usersUpdateLastSeen.ts`](../../../scripts/nodejs/src/endpoints/usersUpdateLastSeen.ts). Không có tham số, body `{}`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { usersUpdateLastSeen } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  await ola.call(usersUpdateLastSeen);
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts usersUpdateLastSeen` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — thay đổi trạng thái "last seen"/online của tài khoản trên server. Đừng gọi tùy tiện.

## Bằng chứng

- Static: `work/api_inventory.csv:135` — `ola_flutter_features_message_message_provider.dart:1249`, không có key.
- Runtime: `work/api_runtime_inventory.csv:4` — body `{}`, luồng "khởi động"; body thật `{}` ở `work/runtime_capture_session.log` (#17) và `work/runtime_capture_live.log` (#1, #3).
