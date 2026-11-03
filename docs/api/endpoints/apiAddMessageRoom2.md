# faApi2/apiAddMessageRoom2.php

Lưu một tin nhắn vào phòng chat. Đây là bản HTTP đi kèm socket `new message`: app **emit socket trước** rồi POST **cùng payload** cộng thêm `roomID` và `isVerifyAvatar`. Xem [luồng phòng chat](../luong-phong-chat.md) và [socket-io](../socket-io.md).

**Method + path:** `POST https://sgdev.vip/faApi2/apiAddMessageRoom2.php`

**Auth:** Bearer Firebase + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver` — xem [header xác thực](../auth-va-header.md).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `deviceID` | string | Android ID của máy gửi (được broadcast cho cả phòng) | [Quan sát] log #45 |
| `mess` | string | Nội dung tin nhắn | [Quan sát] log #45 |
| `name` | string | Tên hiển thị người gửi | [Quan sát] log #45 |
| `userID` | string | UID người gửi (tài khoản đang đăng nhập) | [Quan sát] log #45 |
| `photoURL2` | string | URL avatar người gửi (có thể rỗng) | [Quan sát] log #45 |
| `send` | int | Cờ gửi, luôn `1` | [Quan sát] log #45 |
| `id` | string | Định danh tin, dạng `"<ms_timestamp><uid>"` | [Quan sát] log #45 |
| `isVip` | bool | Người gửi có VIP không | [Quan sát] log #45 |
| `level` | int | Cấp độ người gửi | [Quan sát] log #45 |
| `roomID` | string | Mã phòng = mã tỉnh/thành (vd. `"79"`) | [Quan sát] log #45 |
| `isVerifyAvatar` | int | Cờ avatar đã xác thực (`0`/`1`) | [Quan sát] log #45 |

```json
{
  "deviceID": "<deviceId>", "mess": "hi", "name": "Phong nguyen",
  "userID": "<uid>", "photoURL2": "", "send": 1,
  "id": "1793703706157<uid>", "isVip": false, "level": 1,
  "roomID": "79", "isVerifyAvatar": 0
}
```

> So với chat 1-1: dùng `name` thay `displayName`, `id` thay `messageID`, `send=1` thay `true`, có thêm `deviceID` và `level`, **không** có `fcmTokenNguoiNhan`. Phòng chat **không** gọi `send-notification`.

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts apiAddMessageRoom2 --roomID 79 --mess hi --name "Phong nguyen" --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/apiAddMessageRoom2.ts`](../../../scripts/nodejs/src/endpoints/apiAddMessageRoom2.ts). `userID` mặc định = `session.localId`; `id` tự sinh `<Date.now()><userID>` nếu không truyền. `deviceID`/`photoURL2` mặc định rỗng, `send=1`, `level=1`, `isVerifyAvatar=0`, `isVip=false`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { apiAddMessageRoom2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(apiAddMessageRoom2, { roomID: '79', mess: 'hi', name: 'Phong nguyen' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts apiAddMessageRoom2 --roomID 79 --mess hi --name "Phong nguyen" [--deviceID <deviceId>] [--isVip]` (thêm `--dry-run` để chỉ in request)

⚠️ **Tác dụng phụ:** gửi tin nhắn hiển thị cho **mọi người trong phòng** (socket broadcast kèm `deviceID`/`userID`) — đừng gọi tùy tiện. Để đồng bộ với app nên emit socket `new message` trước khi POST.

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #45 + `S81 SIO-OUT new message` (flow "gửi tin phòng"), `work/api_runtime_inventory.csv`.
- [Suy luận] `work/api_inventory.csv`: `ola_flutter_features_room_room_provider.dart:2648` (`deviceID;roomID;isVerifyAvatar`).
