# faApi2/apiAddToRoomV4.php

Lấy danh sách thành viên / người đang online trong một phòng chat (mở từ icon menu trong phòng). Phân trang bằng `page`. Xem [luồng phòng chat](../luong-phong-chat.md).

**Method + path:** `POST https://sgdev.vip/faApi2/apiAddToRoomV4.php`

**Auth:** Bearer Firebase + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver` — xem [header xác thực](../auth-va-header.md).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID tài khoản đang đăng nhập | [Quan sát] log #44 |
| `page` | int | Số trang, bắt đầu từ `0` | [Quan sát] log #44 |
| `state` | string | Mã phòng = mã tỉnh/thành (vd. `"79"`) | [Quan sát] log #44 |

```json
{ "uid": "<uid>", "page": 0, "state": "79" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts apiAddToRoomV4 --state 79 --page 0 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/apiAddToRoomV4.ts`](../../../scripts/nodejs/src/endpoints/apiAddToRoomV4.ts). Thiếu `state` sẽ báo lỗi trước khi gửi; `uid` mặc định = tài khoản đăng nhập, `page` mặc định `0`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { apiAddToRoomV4 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const data = await ola.call(apiAddToRoomV4, { state: '79', page: 0 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts apiAddToRoomV4 --state 79 --page 0 [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #44 (flow "thành viên phòng"), `work/api_runtime_inventory.csv` (`uid, page, state`).
- [Suy luận] `work/api_inventory.csv`: `ola_flutter_features_room_listUserRoom_list_user_provider.dart:612` (`uid;page;state`).
