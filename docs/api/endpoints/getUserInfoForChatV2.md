# faApi2/getUserInfoForChatV2.php

Lấy thông tin người dùng để hiển thị khi **mở hội thoại 1-1** (header chat: tên, avatar, trạng thái...). Xem [luồng chat 1-1](../luong-chat-1-1.md).

**Method + path**: `POST https://sgdev.vip/faApi2/getUserInfoForChatV2.php`

**Auth**: cần [header xác thực](../auth-va-header.md) (Bearer + key2/timestamp/hash/deviceid/os/ver).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `id` | string | uid người cần xem (peer của hội thoại). **Không suy ra từ session** — bắt buộc truyền. | [Quan sát] |

Ví dụ (đã redact):

```json
{ "id": "<peer_uid>" }
```

## Response

**Chưa bắt response** — log chỉ bắt request body. Chạy `node scripts/nodejs/ola.ts getUserInfoForChatV2 --id <peer_uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

Client báo lỗi (`ApiError`) nếu backend trả `is_success=false`; shape còn lại chưa xác minh.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getUserInfoForChatV2.ts`](../../../scripts/nodejs/src/endpoints/getUserInfoForChatV2.ts). Thiếu `id` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getUserInfoForChatV2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const info = await ola.call(getUserInfoForChatV2, { id: '<peer_uid>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getUserInfoForChatV2 --id <peer_uid>` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` req `#26`/`#31` (luồng "mở chat 1-1"), body `{"id":"<peer_uid>"}`; `work/api_runtime_inventory.csv:13`.
- AOT: `work/api_inventory.csv:47-48` (`ola_flutter_features_chat_chat_user_provider.dart:525`, `ola_flutter_features_setting_local_settings_provider.dart:1709`).
