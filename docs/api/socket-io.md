# Giao thức Socket.IO

## Kết nối

```text
wss://sgdev.vip:3001/socket.io/?key=<static key>&roomNo=<room>&EIO=3&transport=websocket
```

- Engine.IO **v3** (Socket.IO 2.x), chỉ WebSocket, namespace `/`.
- Mỗi màn chat tạo một `Manager` mới (`forceNew`, `autoConnect=false`, `setQuery`); rời màn thì `DISCONNECT`.
- Socket luôn mở song song: `roomNo=Olame` (kênh chung) và `roomNo=<uid>` (kênh cá nhân).
- Trong capture chưa thấy user token trên query; `key` là **hằng số tĩnh** và các trường `username`/`userID` do client gửi. Chưa đủ bằng chứng để kết luận server không kiểm tra danh tính.

### `key` được tạo như thế nào

**Là hằng số cố định, không sinh ra lúc chạy và không do server cấp.** Giá trị: `6Q5AY7RZVR06LFAA07TC` — giống nhau cho mọi tài khoản và mọi lần kết nối.

- App nhúng toàn bộ secret trong một **khối JSON plaintext** trong `lib/arm64-v8a/libnative-lib.so` (thư viện C++, không nằm trong Dart `libapp.so`). Đây là cách app giấu secret khỏi việc đọc chuỗi Dart. Các field gồm: `secretAccessVNG`, `accessKeyVNG`, `key`, `wasabiKeyID`, `wasabiKeySecret`, `key2`, `apiKey`, `key3` (AWS `AKIA…`), `endpoint` (`https://sgdev.vip/`), STUN cho gọi điện (`stunSv/stunUser/stunPass`), `publicKey`, …
- App **tái dùng field `wasabiKeyID`** làm `key` của Socket.IO. (Mapping field → chỗ dùng là tuỳ ý: header HTTP `key2` lại lấy từ field `publicKey` = `49|S4f(vcVKIZ`.)
- Vì chỉ là một ID 20 ký tự cố định gắn chung cho app, ai đọc được APK đều lấy được; nó không ràng buộc danh tính người dùng.

**Cách lấy lại / kiểm chứng** (2026-11-04):
1. Tĩnh: `unzip split_config.arm64_v8a.apk lib/*`, rồi `strings libnative-lib.so | grep secretAccessVNG` → đọc khối JSON, lấy `wasabiKeyID`.
2. Runtime: với app đang chạy, `frida -U -n Ola` rồi `Memory.scanSync` tìm `/socket.io/?` trong vùng nhớ `rw-`/`r--` → đọc URL thật `?key=6Q5AY7RZVR06LFAA07TC&roomNo=…`. Hai mẫu socket sống đều cùng giá trị, khớp hằng số trong binary.

Giá trị này là mặc định của `socketDefaults.key` trong [`defaults.ts`](../../scripts/nodejs/src/defaults.ts); ghi đè bằng `OLA_SOCKET_KEY` (CLI) hoặc ô Socket key trong Cài đặt (app desktop).

## Định dạng wire

Engine.IO v3 text frame bắt đầu bằng type; với type `4`, phần còn lại là packet Socket.IO, có thể chứa namespace, ACK id và JSON.

| Type | Nghĩa |
|---:|---|
| `0` | open (handshake) |
| `1` | close |
| `2` | ping |
| `3` | pong |
| `4` | message — theo sau là Socket.IO type |
| `40` | message + Socket.IO CONNECT (namespace mặc định `/`) |
| `41` | message + disconnect namespace |
| `42` | message + event |
| `42<n>[...]` | message + event có ack id `<n>` |
| `42["event",{…}]` | event kèm payload (bắt đầu bằng `[` = namespace mặc định `/`) |

Hook bắt ở `Encoder.encodeAsString` (chiều ra) và `Decoder.decodeString` (chiều vào), không hook `Socket.emit` — vì `emit` chủ yếu bắn event nội bộ như `open`.

## Bảng event

| Hướng | Event | Payload |
|---|---|---|
| OUT | `add user` | `{username, roomNo}` — phòng chat: `username` = tên hiển thị; 1-1: `username` = uid |
| OUT | `typing` / `stop typing` | – |
| OUT | `new message` | 1-1: `{mess, displayName, photoURL, photoURL2, userID, send, read, messageID, isSticker, replyID, replyText, isVip, isImage, isGift, isAudio, fcmTokenNguoiNhan}`<br>phòng: `{deviceID, mess, name, userID, photoURL2, send, id, isVip, level}` |
| IN | `user joined` / `user left` | `{username, numUsers}` |
| IN | `new message` | `{username, message:{…}}` — cùng shape object người gửi emit |
| IN | `new message` (kênh `Olame`) | Thông báo/broadcast hệ thống. Các biến thể `type` đã thấy:<br>• `{message:{uid, displayName, type, contenType, relateID, privacy}}`<br>• `type:"hightlight"` (broadcast công khai, hiển thị dạng nổi bật): `{message:{type:"hightlight", uid, displayName, photoURL, content, isVip}}` — bắt ngày 2026-11-03 |

## Quan sát từ phiên test

- Kênh `roomNo=<peer_uid>` (chat 1-1) và `roomNo=<room_code>` (phòng chat) dùng **cùng một server, cùng bộ event**, chỉ khác shape payload và cách đặt `username`.
- Phòng chat broadcast `deviceID` của người gửi cho mọi thành viên; chat 1-1 thì không.
- 1-1 gửi kèm `fcmTokenNguoiNhan` trong payload socket — token FCM của người nhận bị đưa cho người gửi.

Xem chi tiết từng luồng ở [luong-chat-1-1.md](luong-chat-1-1.md) và [luong-phong-chat.md](luong-phong-chat.md).
