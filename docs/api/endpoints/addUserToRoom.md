# faApi2/addUserToRoom.php

Đánh dấu tài khoản đang có mặt trong một phòng chat. Gọi ngay khi **vào phòng** (màn Cá nhân → Phòng chat → chọn tỉnh/thành), trước khi tải tin nhắn. Xem [luồng phòng chat](../luong-phong-chat.md).

**Method + path:** `POST https://sgdev.vip/faApi2/addUserToRoom.php`

**Auth:** Bearer Firebase + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver` — xem [header xác thực](../auth-va-header.md).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID tài khoản đang đăng nhập (người vào phòng) | [Quan sát] log #41 |
| `state` | string | Mã phòng = mã tỉnh/thành (vd. `"79"` = Hồ Chí Minh) | [Quan sát] log #41 |

```json
{ "uid": "<uid>", "state": "79" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addUserToRoom --state 79 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addUserToRoom.ts`](../../../scripts/nodejs/src/endpoints/addUserToRoom.ts). Thiếu `state` sẽ báo lỗi trước khi gửi; `uid` mặc định = tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { addUserToRoom } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(addUserToRoom, { state: '79' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addUserToRoom --state 79 [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

⚠️ **Tác dụng phụ:** ghi trạng thái "đang ở phòng" lên server — đừng gọi tùy tiện.

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #41 (flow "vào phòng chat"), `work/api_runtime_inventory.csv` (`uid, state`).
- [Suy luận] `work/api_inventory.csv`: `ola_flutter_features_room_room_provider.dart:4844` (`uid;state`).
