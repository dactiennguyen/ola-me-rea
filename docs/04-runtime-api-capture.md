# 04 — Bắt API runtime bằng Frida (Dio + Socket.IO)

Phiên test: 2026-11-03, app `com.olaachat` 27.7.8 (versionCode 405), máy `55UKEATGRWJRLNVC` (Android 13, arm64, Magisk), Frida 17.23.3.

Tài liệu này bổ sung cho [03-api-calls-and-hooks.md](03-api-calls-and-hooks.md): ở 03, body HTTP chưa lấy được vì TLS nằm trong BoringSSL của `libflutter.so`. Ở đây request được bắt **plaintext ở tầng Dart**, trước khi mã hoá — gồm method, URL, body, header thật trên dây, và toàn bộ frame Socket.IO.

> **Kết quả API đã được tách sang [api/](api/README.md).** Tài liệu này giữ phần **kỹ thuật bắt request** — cách chạy, offset hook, ABI, layout object. Nội dung API cụ thể nằm ở thư mục [api/](api/README.md).

> Quy ước che dữ liệu: `<uid>` = Firebase UID của tài khoản test, `<peer_uid>` = UID người nhận, `<room>` = id phòng, `<deviceId>` = Android ID. Token, `key2`, `hash`, FCM token **không** được ghi vào tài liệu. Log thô nằm trong `work/*.log` và đã được `.gitignore`.

## 1. Kết quả

- **40 endpoint HTTP** chạy thật (27 `faApi2/*.php`, 13 `napi/*`) + **1 server Socket.IO** `wss://sgdev.vip:3001`.
- Request Dio có bộ header chung do interceptor gắn; khi có phiên Firebase thì thêm `Authorization: Bearer <Firebase ID token>`. Các header còn lại: `key2`, `timestamp`, `hash`, `deviceid`, `os`, `ver`.
- Đăng nhập = Google/Apple/Email qua **Firebase Auth (native)** → chỉ có 1 call backend: `POST /napi/users/sync`.
- Tin nhắn 1-1 và phòng chat **gửi qua Socket.IO** rồi **lưu song song qua HTTP**. Push notification do **client tự gọi** `POST /napi/general/send-notification`.

Chi tiết từng phần ở [api/](api/README.md).

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

## 4. Nội dung API đã bắt

| Tài liệu | Nội dung |
|---|---|
| [api/auth-va-header.md](api/auth-va-header.md) | Host, bộ header chung, hai tầng xác thực, trạng thái mất phiên |
| [api/luong-dang-nhap-khoi-dong.md](api/luong-dang-nhap-khoi-dong.md) | Đăng nhập Google → Firebase → backend; chuỗi 10 request khởi động |
| [api/luong-chat-1-1.md](api/luong-chat-1-1.md) | Mở hội thoại, gõ, gửi tin 1-1 |
| [api/luong-phong-chat.md](api/luong-phong-chat.md) | Vào phòng, tải lịch sử, gửi tin phòng, thành viên |
| [api/socket-io.md](api/socket-io.md) | Wire format Engine.IO v3, bảng event, shape payload |
| [api/endpoint-runtime.md](api/endpoint-runtime.md) | 40 endpoint chạy thật + so khớp inventory tĩnh |
| [api/endpoint-tinh.md](api/endpoint-tinh.md) | 27 path `/napi` + 63 path `/faApi2` từ AOT |
| [api/bao-mat-va-luu-y.md](api/bao-mat-va-luu-y.md) | 7 phát hiện phía client, mức nghiêm trọng, tác dụng phụ |
| [api/con-thieu.md](api/con-thieu.md) | Phần chưa bắt được, việc tiếp theo |

## 5. Tác dụng phụ của phiên test

- Đã gửi **1 tin "hi"** trong chat 1-1 (tới hội thoại có sẵn) và **1 tin "hi"** vào phòng chat Hồ Chí Minh (`79`).
- `addUserToRoom.php` đã ghi tài khoản vào phòng `79` và phòng `6`.
- Đã mở các màn Thích bạn, Thông báo, Danh sách chặn, Lịch sử giao dịch, hồ sơ một user (sinh ra `addViewProfile`), leaderboard mini game. Không follow, like, tặng quà, nạp xu, đăng bài.
- Dữ liệu app đã được sao lưu bằng root (`/sdcard/olaachat_data_backup_20261103.tgz`), `pm clear`, rồi khôi phục. Phiên Firebase **không** khôi phục được (khoá Android Keystore đã bị xoá cùng `pm clear`), nên cần đăng nhập Google lại 1 lần.

## 6. Chưa làm

Xem [api/con-thieu.md](api/con-thieu.md). Tóm tắt phần liên quan trực tiếp tới công cụ hook:

- Chưa log **response body** — cần hook onLeave của `fetch` (trả về `Future`) hoặc `ResponseInterceptor`.
- Chưa giải mã `FormData` trên luồng thật (upload ảnh/voice).

## 7. Phiên xác minh bổ sung — 2026-11-03 (lần 2)

Chạy lại logger qua **ADB wifi** (`192.168.2.3:5555`, cùng máy vật lý), attach spawn và điều khiển UI bằng `adb input` + screenshot:

```bash
frida -U -f com.olaachat -l work/scripts/ola_api_logger.js --runtime=v8 -q -t 1800 > work/runtime_capture_session.log 2>&1
```

Tài khoản test **khác phiên gốc** (hiển thị "Phong nguyen", đăng nhập bằng **email/mật khẩu**), nên UID/deviceID khác — giữ nguyên quy ước che dữ liệu (§ trên). Mục tiêu: xác minh lại các luồng, không thêm endpoint mới.

| Luồng đã thao tác | Request bắt được | Khớp inventory |
|---|---|---|
| Khởi động | getTimes, updateLastSeen, check_update_app, checkUV2, getCoins, getLastMessage2, getNotificationsCount, getNotiCountLove, getContactV3, updatePost(token) + 2 socket connect (`roomNo=Olame`, `roomNo=<uid>`) | ✓ |
| **Đăng nhập email** | `POST /napi/users/sync` (1 call backend) rồi lặp lại batch khởi động | ✓ (xác nhận nhánh Email → sync, không chỉ Google/Apple) |
| Mở hội thoại 1-1 (lấy tin nhắn) | getUserInfoForChatV2, getLastMessage2 + `SIO-OUT add user` | ✓ |
| Xem hồ sơ user | getUserInfoV7, shouldLoadFeed, getPostByUserV7; rời hồ sơ → `napi/users/addViewProfile` (gửi theo lô) | ✓ |
| Gửi tin 1-1 (từ nút **Nhắn tin** trong hồ sơ) | `SIO-OUT typing`/`stop typing` → `new message` → addLastMessage5 + `napi/general/send-notification` | ✓ |
| Khám phá (3 tab) | getExploreOnlineV6 (`condition:2`), getExplore3 (`condition:1`), getExploreAvatarV4; response schema đúng như [api/luong-kham-pha.md](api/luong-kham-pha.md) | ✓ |
| Phòng chat | danh sách phòng = **tĩnh** (mã tỉnh); vào phòng Hồ Chí Minh (`roomID:"79"`): addUserToRoom + getMessageByRoom + checkBlockChat + `SIO add user`; **thành viên online** = apiAddToRoomV4; gửi tin = `new message` + apiAddMessageRoom2 | ✓ |

Tổng **46 request HTTP / 39 endpoint distinct**, toàn bộ nằm trong [api/endpoint-runtime.md](api/endpoint-runtime.md) — phiên này **không phát sinh endpoint mới**.

Bổ sung nhỏ: kênh socket `Olame` phát `new message` với `type:"hightlight"` (broadcast công khai) — đã thêm biến thể vào [api/socket-io.md](api/socket-io.md).

**Tác dụng phụ**: gửi 1 tin `hi` tới hội thoại 1-1 có sẵn và 1 tin `hi` vào phòng Hồ Chí Minh (79); ghi 2 lượt xem hồ sơ (addViewProfile). Không follow / like / tặng quà / nạp xu / đăng bài.
