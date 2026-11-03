# 04 — Bắt API runtime bằng Frida (Dio + Socket.IO)

Phiên test: 2026-11-03, app `com.olaachat` 27.7.8 (versionCode 405), máy `55UKEATGRWJRLNVC` (Android 13, arm64, Magisk), Frida 17.23.3.

Tài liệu này bổ sung cho [03-api-calls-and-hooks.md](03-api-calls-and-hooks.md): ở 03, body HTTP chưa lấy được vì TLS nằm trong BoringSSL của `libflutter.so`. Ở đây request được bắt **plaintext ở tầng Dart**, trước khi mã hoá — gồm method, URL, body, header thật trên dây, và toàn bộ frame Socket.IO.

> Quy ước che dữ liệu: `<uid>` = Firebase UID của tài khoản test, `<peer_uid>` = UID người nhận, `<room>` = id phòng, `<deviceId>` = Android ID. Token, `key2`, `hash`, FCM token **không** được ghi vào tài liệu. Log thô nằm trong `work/*.log` và đã được `.gitignore`.

## 1. Kết luận nhanh

- **40 endpoint HTTP** chạy thật trong các luồng đã thao tác (27 `faApi2/*.php`, 13 `napi/*`) + **1 server Socket.IO** `wss://sgdev.vip:3001`.
- Mọi request Dio (cả `faApi2` lẫn `napi`) đi kèm bộ header chung do interceptor gắn: `Authorization: Bearer <Firebase ID token>`, `key2`, `timestamp`, `hash`, `deviceid`, `os`, `ver`.
- Đăng nhập = Google/Apple/Email qua **Firebase Auth (native)** → chỉ có 1 call backend: `POST /napi/users/sync`.
- Tin nhắn 1-1 và phòng chat **gửi qua Socket.IO** (`new message`) rồi **lưu song song qua HTTP** (`addLastMessage5.php` / `apiAddMessageRoom2.php`). Push notification do **client tự gọi** `POST /napi/general/send-notification` với FCM token của người nhận.
- Lịch sử phòng chat tải qua HTTP `getMessageByRoom.php`; mỗi phòng/cuộc chat mở một kết nối Socket.IO riêng (`roomNo=<room>`).

## 2. Cách chạy lại

```bash
# spawn app + log mọi request Dio (#n) và frame Socket.IO (Sn)
frida -U -f com.olaachat -l work/scripts/ola_api_logger.js --runtime=v8 | tee work/runtime_capture.log

# chạy nền, không REPL, tự thoát sau 30 phút
frida -U -f com.olaachat -l work/scripts/ola_api_logger.js --runtime=v8 -q -t 1800 > work/runtime_capture.log 2>&1
```

Mẫu output:

```text
#18 POST https://sgdev.vip/faApi2/addLastMessage5.php
    body : {"fcmToken":"***","content":"hi","uid":"<uid>","userID":"<peer_uid>", ...}
    ↳ wire hdrs (faApi2/addLastMessage5.php): {"key2":"***","ver":"27.7.8","os":"android","deviceid":"<deviceId>","Authorization":"***","timestamp":"<ts>","hash":"***"}
S14 SIO-OUT new message
    data : {"mess":"hi","userID":"<uid>","fcmTokenNguoiNhan":"***fcm***", ...}
```

Mỗi 45 giây script in bảng tổng hợp endpoint khác nhau (`[=] … distinct endpoints`).

**Redaction** trong script ([ola_api_logger.js](../work/scripts/ola_api_logger.js), hàm `scrub`): key `authorization|cookie|token|password|otp|secret|signature|key2|hash|…` → `***`; chuỗi `Bearer …`, JWT `eyJ…`, FCM token `…:APA91b…`, chuỗi opaque ≥ 80 ký tự → `***`; body dạng `{action:"token", value}` → che `value`. Log vẫn chứa UID, deviceID, nội dung tin nhắn → không commit.

## 3. Kỹ thuật hook

### 3.1 Điểm hook (offset trong `libapp.so`, lấy từ `work/dae-aot-20261102/text/functions.txt`)

| Offset | Hàm | Dùng để |
|---|---|---|
| `0x6d4fec` | `DioMixin.fetch(RequestOptions)` | Mọi request Dio: method, baseUrl, path, query, body |
| `0x6d87a4` | `DioMixin._dispatchRequest` | Header **sau** interceptor (cái thật sự lên dây) |
| `0x7cd740` | `Encoder.encodeAsString` (onLeave, `x0`) | Frame Socket.IO gửi đi (wire text `42["event",…]`) |
| `0x7daf78` | `Decoder.decodeString(String)` | Frame Socket.IO nhận về |
| `0x7d67f8` | `IOWebSocketTransport.uri` (onLeave) | URL kết nối WebSocket + query |

Không dùng: `DioMixin.post/get` (bị `fetch` bao), `Socket.emit` (chủ yếu bắn event nội bộ như `open`), địa chỉ dae đặt tên `emitWithAck` (không khớp hàm thật), `Socket.packet/onpacket` (receiver không nằm ở slot stack dự đoán).

### 3.2 Quy ước gọi Dart AOT arm64 (đã kiểm chứng)

- Đối số nằm trên **Dart stack `x15`**, không phải `x0–x7`; đối số cuối ở `[x15+0]`. Ví dụ `Dio.post(this, path, data)`: `[x15]=data`, `[x15+8]=path`, `[x15+16]=this`.
- Giá trị trả về ở `x0` (con trỏ đầy đủ, có tag).
- Heap base = `x28 << 32` (`x28 = write_barrier_mask<<32 | heap_base>>32`; ở phiên này là `0x72_0000_0000`).
- Con trỏ trong field object là 32-bit nén: `addr = heap_base + u32`; bit 0 = 1 là heap object, bit 0 = 0 là Smi (`value = raw >> 1`).

### 3.3 Layout object (đo bằng hexdump trên máy)

Bảng `Classes` trong `work/dae-aot-20261102/frida.js` **lệch 4 byte** vì giả định header 4 byte; header thật là 8 byte (`tags` 4 + hash 4). Offset field trong `text/fields.txt` thì đúng.

| Class (cid) | Layout đúng | dae ghi |
|---|---|---|
| `_OneByteString` (94) / `_TwoByteString` (95) | len Smi `+8`, data `+16` | len `+4`, data `+8` |
| `_List` (90) | typeArgs `+8`, len `+12`, data `+16` | len `+8`, data `+12` |
| `_GrowableList` (92) | len `+12`, backing `_List` `+16` | len `+8`, data `+12` |
| `_Map` (86) | data `+16`, used Smi `+20` | data `+12`, used `+16` |
| `_CompactLinkedCustomHashMap` (6322) — header map của Dio | data `_List` `+0x14` | — |
| `RequestOptions` (5404) | `method +0x8`, `_headers +0xc`, `_baseUrl +0x48`, `queryParameters +0x4c`, `data +0x58`, `path +0x5c` | — |

Class id được đọc từ header: `cid = (u32 tag >> 12) & 0xfffff`.

## 4. Header chung và xác thực

Header thật trên dây (bắt ở `_dispatchRequest`):

| Header | Giá trị | Ghi chú |
|---|---|---|
| `Content-Type` / `Accept` | `application/json` | Body luôn là JSON, kể cả `faApi2/*.php` |
| `Authorization` | `Bearer <Firebase ID token>` (JWT RS256) | Chỉ có khi phiên Firebase còn sống |
| `key2` | khoá tĩnh nhúng trong app | Không ghi giá trị |
| `timestamp` | Unix epoch giây | |
| `hash` | 24 ký tự hex | Chữ ký request; thay đổi theo từng request. Công thức chưa phân tích |
| `deviceid` | Android ID | |
| `os` / `ver` | `android` / `27.7.8` | |

Khi phiên Firebase mất (ví dụ sau `pm clear` rồi khôi phục dữ liệu), app vẫn còn `uid` trong cache và vẫn gọi `getCoins`, `getContactV3`, `getLastMessage2`… **không có** `Authorization`, trong khi UI đang ở màn đăng nhập — xem §8.

## 5. Các luồng đã bắt

### 5.1 Đăng nhập (Google)

Màn đăng nhập có Email/mật khẩu, Google, Apple, "Quên mật khẩu", "Đăng ký". Luồng Google quan sát được:

1. `GET /napi/general/getTimes` — chạy ngay khi mở app, trước khi đăng nhập (chỉ có `key2/timestamp/hash`, không có `Authorization`).
2. Google Sign-In → Firebase Auth: chạy trong plugin native, **không qua Dio**.
3. `POST /napi/users/sync` — request backend duy nhất của bước đăng nhập, đã có `Authorization`:
   ```json
   {"os":"android","deviceId":"<deviceId>","ver":"13","displayName":"<tên>","photoURL":"<google avatar url>"}
   ```
   `ver` ở đây là phiên bản Android, khác header `ver` (phiên bản app).
4. Mở 2 socket: `roomNo=Olame` (kênh chung) và `roomNo=<uid>` (kênh cá nhân).
5. Chuỗi khởi động ở §5.2.

Chưa bắt: đăng nhập Email/mật khẩu, Apple, đăng ký, quên mật khẩu. Đăng xuất: app **không có nút đăng xuất** trong Cài đặt, chỉ có "Xóa tài khoản" (không thử).

### 5.2 Khởi động (đã đăng nhập)

| # | Request | Body |
|---|---|---|
| 1 | `GET /napi/general/getTimes` | – |
| 2 | `POST /napi/users/updateLastSeen` | `{}` |
| 3 | `POST /faApi2/check_update_app.php` | `{"uid":1}` (hằng số `1`, không phải uid) |
| 4 | `POST /faApi2/checkUV2.php` | `{uid}` |
| 5 | `POST /faApi2/getCoins.php` | `{uid}` |
| 6 | `POST /faApi2/getLastMessage2.php` | `{"roomID":"<uid>"}` — danh sách hội thoại |
| 7 | `POST /faApi2/getNotificationsCount.php` | `{uid}` |
| 8 | `POST /faApi2/getContactV3.php` | `{uid}` |
| 9 | `POST /faApi2/updatePost.php` | `{"action":"token","id":"<uid>","value":<FCM token>}` — đăng ký FCM token |
| 10 | `POST /faApi2/getNotiCountLove.php` | `{uid}` |

Các call 3–5, 7, 10 chạy **2 lần** mỗi lần khởi động (init chạy trùng).

### 5.3 Tin nhắn 1-1

**Mở cuộc trò chuyện** (tab Tin nhắn → chạm vào hội thoại):

1. Socket mới: `wss://sgdev.vip:3001/socket.io/?key=***&roomNo=<peer_uid>&EIO=3&transport=websocket`. Kết nối cũ bị đóng (`DISCONNECT`).
2. `POST /faApi2/getUserInfoForChatV2.php` `{"id":"<peer_uid>"}`
3. `SIO-OUT add user` `{"username":"<uid>","roomNo":"<peer_uid>"}`

Danh sách tin cũ hiển thị từ dữ liệu `getLastMessage2.php` lúc khởi động; mở chat không có call tải lịch sử riêng.

**Đang gõ**: `SIO-OUT typing` / `SIO-OUT stop typing`, không có payload.

**Gửi tin** (đã gửi 1 tin "hi"):

1. `SIO-OUT new message`:
   ```json
   {"mess":"hi","photoURL2":"","displayName":"<tên>","photoURL":"<avatar>","userID":"<uid>",
    "send":true,"read":false,"messageID":"<ms_timestamp><uid>","isSticker":null,
    "replyID":"","replyText":"","isVip":false,"isImage":0,"isGift":0,"isAudio":0,
    "fcmTokenNguoiNhan":"<FCM token người nhận>"}
   ```
   `messageID` = timestamp mili-giây + uid người gửi.
2. `POST /napi/general/send-notification` — client tự đẩy push:
   ```json
   {"token":"<FCM token người nhận>","title":"<tên người gửi>","body":"hi",
    "data":{"action":"chat","messageID":"…","fcmToken":"…","user":{"uid":"<uid>","photoURL":"…","displayName":"…"}, …}}
   ```
3. `POST /faApi2/addLastMessage5.php` — lưu tin cuối của hội thoại:
   ```json
   {"fcmToken":"***","image":"","timestamp":"<ms>","id":"<messageID>","content":"hi",
    "uid":"<uid>","userID":"<peer_uid>","isSticker":null,"replyID":"","replyText":""}
   ```

### 5.4 Phòng chat

Cá nhân → Phòng chat → danh sách tỉnh/thành (render local, không gọi API). Id phòng là **mã tỉnh** (Hồ Chí Minh = `79`).

**Vào phòng / tải tin nhắn:**

1. Socket mới `roomNo=<room>` (vd. `79`).
2. `POST /faApi2/addUserToRoom.php` `{"uid":"<uid>","state":"<room>"}` — ghi dữ liệu: đánh dấu user đang ở phòng.
3. `POST /faApi2/getMessageByRoom.php` `{"roomID":"<room>"}` — **tải lịch sử tin nhắn phòng**.
4. `POST /faApi2/checkBlockChat.php` `{"uid":"<uid>"}` — kiểm tra user có bị cấm chat không.
5. `SIO-OUT add user` `{"username":"<tên hiển thị>","roomNo":"<room>"}` (phòng chat dùng **tên hiển thị**, chat 1-1 dùng uid).
6. Nhận realtime: `SIO-IN user joined` / `user left` `{username, numUsers}`, `SIO-IN new message`.

**Gửi tin vào phòng** (đã gửi 1 tin "hi" vào phòng `79`):

1. `SIO-OUT new message`:
   ```json
   {"deviceID":"<deviceId>","mess":"hi","name":"<tên>","userID":"<uid>","photoURL2":"<avatar>",
    "send":1,"id":"<ms_timestamp><uid>","isVip":false,"level":1}
   ```
2. `POST /faApi2/apiAddMessageRoom2.php` — cùng payload, cộng thêm `"roomID":"<room>","isVerifyAvatar":null`.

**Tin nhận về**: `SIO-IN new message` `{"username":"<tên>","message":{deviceID, mess, name, userID, photoURL2, send, id, isVip, level}}`, tức cùng object mà người gửi emit.

**Danh sách thành viên** (icon menu trong phòng): `POST /faApi2/apiAddToRoomV4.php` `{"uid","page","state":"<room>"}`.

## 6. Giao thức Socket.IO

- Server: `wss://sgdev.vip:3001/socket.io/?key=<static key>&roomNo=<room>&EIO=3&transport=websocket` — Engine.IO v3 (Socket.IO 2.x), chỉ WebSocket, namespace `/`.
- Mỗi màn chat tạo một `Manager` mới (`forceNew`, `autoConnect=false`, `setQuery`); rời màn thì `DISCONNECT`.
- Socket luôn mở: `roomNo=Olame` (kênh chung) và `roomNo=<uid>` (kênh cá nhân).
- Không có bước auth ở tầng socket ngoài `key` tĩnh trong query; danh tính lấy từ `username`/`userID` do client tự khai.

| Hướng | Event | Payload |
|---|---|---|
| OUT | `add user` | `{username, roomNo}` |
| OUT | `typing` / `stop typing` | – |
| OUT | `new message` | 1-1: `{mess, displayName, photoURL, photoURL2, userID, send, read, messageID, isSticker, replyID, replyText, isVip, isImage, isGift, isAudio, fcmTokenNguoiNhan}` · phòng: `{deviceID, mess, name, userID, photoURL2, send, id, isVip, level}` |
| IN | `user joined` / `user left` | `{username, numUsers}` |
| IN | `new message` | `{username, message:{…}}`; trên kênh `Olame` còn có dạng `{message:{uid, displayName, type, contenType, relateID, privacy}}` (thông báo hệ thống) |

## 7. Inventory runtime (Tier 1)

Host chung `https://sgdev.vip`. Auth = bộ header ở §4 (Bearer + `key2`/`timestamp`/`hash`). "Luồng" = nơi request được bắt trong phiên này. Bản CSV: [work/api_runtime_inventory.csv](../work/api_runtime_inventory.csv).

| Method | Path | Body keys | Luồng |
|---|---|---|---|
| GET | `/napi/general/getTimes` | – | khởi động (trước login) |
| POST | `/napi/users/sync` | `os, deviceId, ver, displayName, photoURL` | **đăng nhập** |
| POST | `/napi/users/updateLastSeen` | `{}` | khởi động |
| POST | `/faApi2/check_update_app.php` | `uid` (=1) | khởi động |
| POST | `/faApi2/checkUV2.php` | `uid` | khởi động |
| POST | `/faApi2/getCoins.php` | `uid` | khởi động |
| POST | `/faApi2/getLastMessage2.php` | `roomID` (=uid) | khởi động — danh sách hội thoại |
| POST | `/faApi2/getNotificationsCount.php` | `uid` | khởi động |
| POST | `/faApi2/getNotiCountLove.php` | `uid` | khởi động |
| POST | `/faApi2/getContactV3.php` | `uid` | khởi động |
| POST | `/faApi2/updatePost.php` | `action, id, value` | khởi động — lưu FCM token |
| POST | `/faApi2/getUserInfoForChatV2.php` | `id` | **mở chat 1-1** |
| POST | `/napi/general/send-notification` | `token, title, body, data` | **gửi tin 1-1** |
| POST | `/faApi2/addLastMessage5.php` | `fcmToken, image, timestamp, id, content, uid, userID, isSticker, replyID, replyText` | **gửi tin 1-1** |
| POST | `/faApi2/addUserToRoom.php` | `uid, state` | **vào phòng chat** |
| POST | `/faApi2/getMessageByRoom.php` | `roomID` | **tải tin nhắn phòng** |
| POST | `/faApi2/checkBlockChat.php` | `uid` | **vào phòng chat** |
| POST | `/faApi2/apiAddMessageRoom2.php` | `deviceID, mess, name, userID, photoURL2, send, id, isVip, level, roomID, isVerifyAvatar` | **gửi tin phòng** |
| POST | `/faApi2/apiAddToRoomV4.php` | `uid, page, state` | thành viên phòng |
| POST | `/faApi2/getExploreOnlineV6.php` | `uid, os, page, condition, lastSeenPaging` | Khám phá — Online |
| POST | `/faApi2/getExplore3.php` | `uid, os, page, condition` | Khám phá — Đã xác thực |
| POST | `/faApi2/getExploreAvatarV4.php` | `uid, os, page` | Khám phá — Ảnh có mặt |
| POST | `/faApi2/getUserInfoV7.php` | `myUid, targetUid` | xem hồ sơ |
| POST | `/faApi2/shouldLoadFeed.php` | `uid` | xem hồ sơ |
| POST | `/faApi2/getPostByUserV7.php` | `uid, page` | xem hồ sơ |
| POST | `/napi/users/addViewProfile` | `viewed_ids` | ghi lượt xem hồ sơ, gửi theo lô sau khi rời hồ sơ |
| GET | `/napi/users/unread-views` | – | hồ sơ của mình |
| POST | `/faApi2/getFeedNoiBatV4.php` | `uid, page, new` | Blog |
| GET | `/napi/post/stories/feed` | – | Blog |
| POST | `/napi/post/{postId}/comments` | `page` | xem bình luận |
| POST | `/faApi2/getCreatePostInfo2.php` | `uid` | mở màn tạo bài (không đăng) |
| POST | `/faApi2/getMatchV2.php` | `uid, page` | Thích bạn |
| GET | `/napi/users/notifications/{uid}` | – | Thông báo |
| POST | `/faApi2/getBlockV3.php` | `uid` | Danh sách chặn |
| POST | `/faApi2/getOrderHistory.php` | `uid` | Lịch sử giao dịch |
| POST | `/faApi2/getXuHistory2.php` | `uid` | Lịch sử giao dịch |
| GET | `/napi/caro/me` | – | Mini game — Caro |
| GET | `/napi/caro/leaderboard` | – | Mini game — Caro |
| GET | `/napi/minigame/flappy/leaderboard` | – | Mini game — Bay lên |
| GET | `/napi/minigame/sweet/leaderboard` | – | Mini game — Kẹo ngọt |

So với inventory tĩnh [work/api_inventory.csv](../work/api_inventory.csv) (135 dòng): 36/40 endpoint runtime đã có sẵn. 4 endpoint còn lại là các path động mà phân tích tĩnh chỉ thấy dạng template: `napi/post/{postId}/comments`, `napi/users/notifications/{uid}`, `napi/minigame/flappy/leaderboard`, `napi/minigame/sweet/leaderboard` (tức `napi/minigame/{gameKey}/leaderboard` với `gameKey ∈ {flappy, sweet}`). Method của `getExploreOnlineV6.php` và `getExploreAvatarV4.php` (tĩnh ghi `unknown`) đã xác định là `POST`.

Màn không gọi API (dữ liệu local): danh sách quà tặng, danh sách phòng chat, Boost Profile (trước khi kích hoạt), Tiện ích (Xem tuổi, Lịch âm, Cung hoàng đạo, Thần số học), danh sách mini game.

## 8. Phát hiện cần lưu ý

| # | Vấn đề | Bằng chứng |
|---|---|---|
| 1 | **Client tự gửi push tới bất kỳ FCM token nào** | `POST /napi/general/send-notification` nhận `token` (FCM của người nhận), `title`, `body`, `data` tuỳ ý từ client |
| 2 | **FCM token của người nhận bị lộ cho người gửi** | `fcmTokenNguoiNhan` trong payload socket 1-1; `fcmToken` trong `addLastMessage5.php` |
| 3 | **`deviceID` và `userID` của mọi người được broadcast trong phòng chat** | `SIO-IN new message` chứa nguyên `message.deviceID`, `message.userID` của người gửi |
| 4 | **Danh tính socket do client tự khai** | Socket chỉ có `key` tĩnh trong query; `username`/`userID` lấy từ payload, không có token người dùng |
| 5 | **Endpoint legacy chấp nhận `uid` trong body** | `faApi2/*.php` truyền `uid` qua body; khi phiên Firebase đã mất, app vẫn gọi được `getCoins`, `getContactV3`, `getLastMessage2` chỉ với `key2/hash`, không có `Authorization`. Cần kiểm tra server có đối chiếu `uid` với token không |
| 6 | `GET /napi/users/notifications/{uid}` dùng uid trên path | Cần kiểm tra truy cập chéo user (IDOR) |
| 7 | Tin nhắn được lưu 2 đường (socket + HTTP) do client điều khiển | Server tin vào nội dung client gửi qua `apiAddMessageRoom2.php` / `addLastMessage5.php` |

Các mục 5–7 mới là quan sát phía client; chưa replay để xác minh hành vi server. Muốn replay thì dùng tài khoản test, credential của chính phiên đó, và không replay request có tác dụng phụ lên người khác.

## 9. Tác dụng phụ của phiên test

- Đã gửi **1 tin "hi"** trong chat 1-1 (tới hội thoại có sẵn) và **1 tin "hi"** vào phòng chat Hồ Chí Minh (`79`).
- `addUserToRoom.php` đã ghi tài khoản vào phòng `79` và phòng `6`.
- Đã mở các màn Thích bạn, Thông báo, Danh sách chặn, Lịch sử giao dịch, hồ sơ một user (sinh ra `addViewProfile`), leaderboard mini game. Không follow, like, tặng quà, nạp xu, đăng bài.
- Dữ liệu app đã được sao lưu bằng root (`/sdcard/olaachat_data_backup_20261103.tgz`), `pm clear`, rồi khôi phục. Phiên Firebase **không** khôi phục được (khoá Android Keystore đã bị xoá cùng `pm clear`), nên cần đăng nhập Google lại 1 lần.

## 10. Chưa làm

- Công thức tính header `hash` (từ `key2` + `timestamp` + …): cần lần theo interceptor trong `work/dae-aot-20261102/dart/`.
- Gửi ảnh/voice/sticker/quà trong chat, upload (`FormData`), reply.
- Đăng nhập Email/Apple, đăng ký, quên mật khẩu, nạp xu / IAP, VIP, Boost.
- Caro online (`https://sgdev.vip:5000/caro`, chưa mở), gọi thoại/video.
- Response body: logger mới log request; muốn log response thì hook onLeave của `fetch` (trả về `Future`) hoặc `ResponseInterceptor`.
