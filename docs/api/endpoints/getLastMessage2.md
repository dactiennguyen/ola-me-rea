# faApi2/getLastMessage2.php

Lấy **hàng đợi tin chờ** của tài khoản (các tin 1-1 người khác lưu bằng `addLastMessage5`), nạp màn **Tin nhắn** lúc khởi động. **Đọc là xoá**: gọi lần hai trả rỗng. Xem [luồng chat 1-1](../luong-chat-1-1.md).

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

Quan sát ngày 2026-11-04 bằng client Node với tài khoản test, **chỉ ghi tên key và kiểu**, không ghi giá trị. [Quan sát]

```text
{ is_success: boolean, data: [] }
```

Thử ngày 2026-11-04 giữa 2 tài khoản thật của chủ app (A gửi B bằng client Node, đúng thứ tự của app; B nghe kênh cá nhân và đọc `getLastMessage2`). [Quan sát] Chỉ ghi tên key và kiểu:

```text
{ is_success: boolean,
  data: [ { uid: string,          // người GỬI
            displayName: string, photoURL: string, isVip: number,   // của người gửi
            fcmToken: string,     // token thiết bị người gửi ("" nếu gửi từ client không có FCM)
            id: string,           // messageID = "<ms><uid người gửi>"
            timestamp: number, content: string, image: string,
            isSticker: null, replyID: string, replyText: string } ] }
```

- **Mỗi tin một phần tử**, không gộp theo hội thoại: A gửi 3 tin → `data` có 3 phần tử.
- **Đọc là xoá**: gọi lại ngay sau đó trả `data: []`. Tài khoản đăng nhập ở nhiều nơi (điện thoại + desktop) thì nơi nào gọi trước sẽ lấy hết tin chờ.
- `content` tối đa **150 ký tự** (server cắt khi lưu, xem [addLastMessage5](addLastMessage5.md)).
- Không có field số tin chưa đọc: số phần tử của mỗi người gửi chính là số tin chờ.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getLastMessage2.ts`](../../../scripts/nodejs/src/endpoints/getLastMessage2.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getLastMessage2 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
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
