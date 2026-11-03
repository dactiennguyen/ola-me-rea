# faApi2/apiAddBlockChatV3.php

Chặn chat với một người dùng. Thuộc `room_provider` (màn phòng chat / hồ sơ người dùng). Xem [luồng phòng chat](../luong-phong-chat.md).

**Method + path:** `POST https://sgdev.vip/faApi2/apiAddBlockChatV3.php`

**Auth:** Bearer Firebase + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver` — xem [header xác thực](../auth-va-header.md).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID người **bị chặn** (không mặc định theo session) | [Suy luận] AOT |
| `name` | string | Tên hiển thị của người bị chặn | [Suy luận] AOT |

```json
{ "name": "<tên người bị chặn>", "uid": "<uid người bị chặn>" }
```

> `uid` là self hay target chưa kiểm chứng runtime; client suy từ ngữ cảnh "chặn chat" nên **bắt buộc truyền** và coi là người bị chặn. [Chưa xác minh]

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts apiAddBlockChatV3 --uid <uid> --name "<tên>" --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/apiAddBlockChatV3.ts`](../../../scripts/nodejs/src/endpoints/apiAddBlockChatV3.ts). `uid` (người bị chặn) và `name` đều bắt buộc; `uid` không lấy từ session.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { apiAddBlockChatV3 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(apiAddBlockChatV3, { uid: '<uid người bị chặn>', name: 'Tên' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts apiAddBlockChatV3 --uid <uid> --name "Tên"` (thêm `--dry-run` để chỉ in request)

⚠️ **Tác dụng phụ:** chặn một người dùng trên server — đừng gọi tùy tiện.

## Bằng chứng

- [Suy luận] `work/api_inventory.csv`: `ola_flutter_features_room_room_provider.dart:3786` (`name;uid`). Chưa bắt trên dây trong phiên 2026-11-03. [Chưa xác minh]
