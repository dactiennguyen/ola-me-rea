# faApi2/addLastMessage5.php

Lưu **tin cuối** của một hội thoại 1-1 lên backend để hiển thị ở danh sách chat (tab Tin nhắn). Là bước HTTP trong luồng gửi tin; xem [luồng chat 1-1](../luong-chat-1-1.md).

**Method + path**: `POST https://sgdev.vip/faApi2/addLastMessage5.php`

**Auth**: cần [header xác thực](../auth-va-header.md) (Bearer + key2/timestamp/hash/deviceid/os/ver).

## Request body

Gửi tin văn bản (biến thể [Quan sát]):

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `fcmToken` | string | FCM token thiết bị **người gửi** (`***` trong log) | [Quan sát] |
| `image` | string | URL ảnh nếu là tin ảnh, rỗng với tin chữ | [Quan sát] |
| `timestamp` | int (ms) | mốc thời gian client sinh | [Quan sát] |
| `id` | string | `messageID` = `timestamp` + `uid` người gửi (client tự sinh) | [Quan sát] |
| `content` | string | nội dung tin | [Quan sát] |
| `uid` | string | uid **người gửi** (mặc định tài khoản đăng nhập) | [Quan sát] |
| `userID` | string | uid **người nhận** (peer) | [Quan sát] |
| `isSticker` | int\|null | `null`/0 tin thường, khác 0 nếu là sticker | [Quan sát] |
| `replyID` | string | id tin được trả lời (rỗng nếu không) | [Quan sát] |
| `replyText` | string | trích nội dung tin được trả lời | [Quan sát] |

Biến thể quà/âm thanh (từ AOT `chat_provider.dart:5832`, **chưa bắt trên wire**):

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `isGift` | int | 1 nếu là quà tặng | [Suy luận/AOT] |
| `isAudio` | int | 1 nếu là tin thoại (đi cùng [upAudio](upAudio.md)) | [Suy luận/AOT] |
| `user` / `photoURL` / `displayName` | object/string | thông tin người gửi kèm theo | [Suy luận/AOT] |

Ví dụ (đã redact):

```json
{
  "fcmToken": "<fcmToken người gửi>",
  "image": "",
  "timestamp": 1793703248125,
  "id": "1793703248125<uid>",
  "content": "hi",
  "uid": "<uid>",
  "userID": "<peer_uid>",
  "isSticker": null,
  "replyID": "",
  "replyText": ""
}
```

## Response

Thử ngày 2026-11-04 giữa 2 tài khoản thật của chủ app (A gửi B bằng client Node, đúng thứ tự của app; B nghe kênh cá nhân và đọc `getLastMessage2`). [Quan sát]

```text
{ is_success: true, message: "done" }
```

- Tin được thêm vào **hàng đợi tin chờ** của `userID`; đọc bằng [getLastMessage2](getLastMessage2.md) (đọc là xoá).
- `content` chỉ được lưu **150 ký tự đầu** (tính theo ký tự, tiếng Việt cũng vậy); dài hơn vẫn trả `is_success: true`. Đã thử tới 1 100 000 ký tự: không lỗi, vẫn cắt còn 150. Chi tiết: [Độ dài tin nhắn](../luong-chat-1-1.md#độ-dài-tin-nhắn).

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addLastMessage5.ts`](../../../scripts/nodejs/src/endpoints/addLastMessage5.ts). Thiếu `userID`/`content` sẽ báo lỗi trước khi gửi (`content` được phép rỗng với sticker/ảnh). `uid` mặc định = tài khoản đăng nhập, `timestamp` = `Date.now()`, `id` = `<timestamp><uid>`; `fcmToken`/`image`/`replyID`/`replyText` mặc định rỗng, `isSticker` mặc định `null`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { addLastMessage5 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(addLastMessage5, { userID: '<peer_uid>', content: 'hi' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addLastMessage5 --content hi --userID <peer_uid> [--fcmToken <token>] [--image <url>] [--replyID <id> --replyText <text>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

Thay đổi state server — ghi tin cuối của hội thoại. Trong luồng app thật, tin còn đi qua socket `new message` và [send-notification](generalSendNotification.md). Đừng gọi tùy tiện.

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` req `#33` (luồng "gửi tin 1-1"); `work/api_runtime_inventory.csv:15`.
- AOT: `work/api_inventory.csv:5` (`ola_flutter_features_chat_chat_provider.dart:5832`).
