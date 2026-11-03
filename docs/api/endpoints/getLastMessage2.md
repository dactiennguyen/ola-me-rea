# faApi2/getLastMessage2.php

Lấy danh sách tin cuối của các hội thoại 1-1 — nạp màn **Tin nhắn** (danh sách hội thoại) lúc khởi động. Xem [luồng chat 1-1](../luong-chat-1-1.md).

## Method + path

`POST https://sgdev.vip/faApi2/getLastMessage2.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `roomID` | string | Khoá hội thoại. Trong capture = **uid tài khoản đang đăng nhập** (lấy danh sách hội thoại của chính mình). Mặc định client gửi uid của mình. | [Quan sát] log 2026-11-03 + api_inventory.csv |

```json
{ "roomID": "<uid>" }
```

## Response

**Chưa bắt response** — logger phiên 2026-11-03 chỉ ghi request. Chạy `node scripts/nodejs/ola.ts getLastMessage2 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getLastMessage2.ts`](../../../scripts/nodejs/src/endpoints/getLastMessage2.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getLastMessage2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const data = await ola.call(getLastMessage2);                 // roomID = uid của mình
  // hoặc một hội thoại cụ thể:
  const peer = await ola.call(getLastMessage2, { roomID: '<peer_uid>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getLastMessage2 [--roomID <peer_uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: `work/api_inventory.csv:36` — `ola_flutter_features_message_message_provider.dart:826`, key `roomID`.
- Runtime: `work/api_runtime_inventory.csv:8` — body `roomID (=uid)`, luồng "khởi động — danh sách hội thoại"; body thật `{"roomID":"<uid>"}` ở `work/runtime_capture_session.log` (#6, #18).
