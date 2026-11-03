# faApi2/checkBlockChat.php

Kiểm tra tài khoản đang đăng nhập có bị **cấm chat** hay không. Gọi mỗi lần vào phòng chat. Xem [luồng phòng chat](../luong-phong-chat.md).

**Method + path:** `POST https://sgdev.vip/faApi2/checkBlockChat.php`

**Auth:** Bearer Firebase + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver` — xem [header xác thực](../auth-va-header.md).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID tài khoản đang đăng nhập (người cần kiểm tra) | [Quan sát] log #43 |

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts checkBlockChat --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/checkBlockChat.ts`](../../../scripts/nodejs/src/endpoints/checkBlockChat.ts). `is_success`/`success` bằng false **không** bị coi là lỗi (có thể chính là câu trả lời "không"), nên `ola.call()` trả response thô — tự đọc cờ trong kết quả.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { checkBlockChat } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const data = await ola.call(checkBlockChat); // uid mặc định = session.localId
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts checkBlockChat [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #43 (flow "vào phòng chat"), `work/api_runtime_inventory.csv` (`uid`).
- [Suy luận] `work/api_inventory.csv`: `ola_flutter_features_room_listUserRoom_check_block.dart:485` (`uid`).
