# faApi2/getMessageByRoom.php

Tải lịch sử tin nhắn của một phòng chat. Gọi mỗi lần **vào phòng** (phòng chat luôn tải lại, không dùng cache như chat 1-1). Xem [luồng phòng chat](../luong-phong-chat.md).

**Method + path:** `POST https://sgdev.vip/faApi2/getMessageByRoom.php`

**Auth:** Bearer Firebase + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver` — xem [header xác thực](../auth-va-header.md).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `roomID` | string | Mã phòng = mã tỉnh/thành (vd. `"79"`) | [Quan sát] log #42 |
| `incognito` | bool? | Cờ ẩn danh (tuỳ chọn, chưa thấy gửi trên dây) | [Suy luận] AOT |

```json
{ "roomID": "79" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getMessageByRoom --roomID 79 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

> Client báo lỗi nếu `is_success=false` (nhiều `faApi2/*` trả `{ is_success, ... }`).

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getMessageByRoom.ts`](../../../scripts/nodejs/src/endpoints/getMessageByRoom.ts). Thiếu `roomID` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getMessageByRoom } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const data = await ola.call(getMessageByRoom, { roomID: '79' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getMessageByRoom --roomID 79 [--incognito]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #42 (flow "tải tin nhắn phòng"), `work/api_runtime_inventory.csv` (`roomID`).
- [Suy luận] `work/api_inventory.csv`: `ola_flutter_features_room_room_provider.dart:4593` (`incognito;roomID`).
