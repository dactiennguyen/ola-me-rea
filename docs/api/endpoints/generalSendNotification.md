# napi/general/send-notification

Nhờ backend bắn **push notification (FCM)** tới một thiết bị. Client gọi với token người nhận. Dùng trong: gửi tin 1-1, tương tác post/comment, tương tác DB. Xem [luồng chat 1-1](../luong-chat-1-1.md) và [bảo mật & lưu ý](../bao-mat-va-luu-y.md).

**Method + path**: `POST https://sgdev.vip/napi/general/send-notification`

**Auth**: cần [header xác thực](../auth-va-header.md) (Bearer + key2/timestamp/hash/deviceid/os/ver).

## Request body

Các field dùng chung mọi biến thể:

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `token` | string | FCM token thiết bị **người nhận** (`***` trong log) | [Quan sát] |
| `title` | string | tiêu đề push (tên người gửi) | [Quan sát] |
| `body` | string | nội dung push | [Quan sát] |

### Biến thể "chat" — gửi tin 1-1 ([Quan sát])

Thêm `data` là object payload khi mở app chạm vào thông báo:

| field (trong `data`) | kiểu | ý nghĩa |
|---|---|---|
| `action` | string | `"chat"` để điều hướng vào hội thoại |
| `photo` | string | ảnh kèm (rỗng với tin chữ) |
| `messageID` | string | id tin (khớp `id` của [addLastMessage5](addLastMessage5.md)) |
| `isSticker` / `isImage` / `isGift` / `isAudio` | int\|null | loại tin |
| `replyText` / `replyID` | string | thông tin tin được trả lời |
| `fcmToken` | string | FCM token thiết bị **người gửi** (`***`) |
| `user` | object | `{uid, photoURL, displayName}` người gửi |

### Biến thể tương tác DB ([Suy luận/AOT])

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `str_li_pos` | string | tham số vị trí trong luồng tương tác | `db_interaction_provider.dart:1687` |

Ví dụ biến thể "chat" (đã redact):

```json
{
  "token": "<fcmToken người nhận>",
  "title": "Phong nguyen",
  "body": "hi",
  "data": {
    "action": "chat",
    "photo": "",
    "messageID": "1793703248125<uid>",
    "isSticker": 0,
    "isImage": 0,
    "isGift": 0,
    "isAudio": 0,
    "replyText": "",
    "replyID": "",
    "fcmToken": "<fcmToken người gửi>",
    "user": { "uid": "<uid>", "photoURL": "", "displayName": "Phong nguyen" }
  }
}
```

## Response

**Chưa bắt response** — log chỉ bắt request body. Chạy `node scripts/nodejs/ola.ts generalSendNotification --token <token> --title "Phong nguyen" --body hi --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/generalSendNotification.ts`](../../../scripts/nodejs/src/endpoints/generalSendNotification.ts). Thiếu `token`/`title`/`body` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { generalSendNotification } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(generalSendNotification, {
    token: '<fcmToken người nhận>',
    title: 'Phong nguyen',
    body: 'hi',
    data: { action: 'chat', photo: '', messageID: '...', user: { uid: '<uid>', photoURL: '', displayName: 'Phong nguyen' } },
  });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts generalSendNotification --token <fcmToken người nhận> --title "Phong nguyen" --body hi [--data '{"action":"chat","photo":""}'] [--str_li_pos <pos>]` (`--data` nhận chuỗi JSON object; thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

Thay đổi state server — khiến thiết bị người nhận nhận push notification thật. Đừng gọi tùy tiện (spam/lừa đảo). Lưu ý: client gọi bằng token người nhận nên có thể bị lạm dụng — xem [bảo mật & lưu ý](../bao-mat-va-luu-y.md).

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` req `#32` (luồng "gửi tin 1-1"); `work/api_runtime_inventory.csv:14` (BodyKeys `token, title, body, data`).
- AOT: `work/api_inventory.csv:106-108` (`db_interaction_provider.dart:1687`, `chat_provider.dart:6117`, `post_details.dart:4301`).
