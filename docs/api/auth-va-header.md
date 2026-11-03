# Xác thực và bộ header chung

## Host

| Host | Port | Dùng cho |
|---|---:|---|
| `sgdev.vip` | 443 | Toàn bộ HTTP API (`/faApi2/*.php` và `/napi/*`) |
| `sgdev.vip` | 3001 | Socket.IO realtime (chat, thông báo hệ thống) |
| `sgdev.vip` | 5000 | `/caro` — game Caro online (chưa mở trong phiên test) |

Base URL trong code: `https://sgdev.vip/`.

## Header thật trên dây

Bắt tại `DioMixin._dispatchRequest` — tức **sau** khi interceptor đã chạy xong, đây là bộ header thực sự đi lên server:

| Header | Giá trị | Ghi chú |
|---|---|---|
| `Content-Type` / `Accept` | `application/json` | Body luôn JSON, kể cả `faApi2/*.php` |
| `Authorization` | `Bearer <Firebase ID token>` (JWT RS256) | Chỉ có khi phiên Firebase còn sống |
| `key2` | khoá tĩnh nhúng trong app | Không ghi giá trị vào tài liệu |
| `timestamp` | Unix epoch giây | |
| `hash` | 32 ký tự hex thường | MD5 theo công thức bên dưới |
| `deviceid` | Android ID | |
| `os` | `android` | |
| `ver` | `27.7.8` | Phiên bản app (khác body field `ver` của `users/sync`) |

Bộ header này do interceptor gắn cho **mọi** request Dio, không phân biệt `faApi2` hay `napi`. Muốn xem header trước interceptor thì hook `fetch`; muốn xem header thật đi trên dây thì hook `_dispatchRequest`.

## Công thức hash đã đối chiếu

```text
hash = MD5(UTF8(String(timestamp - 888) + deviceId + suffix))
suffix = đoạn path từ dấu / cuối cùng, gồm dấu /; ví dụ /sync
```

`timestamp` dùng giây theo `serverTime` từ `getTimes`. Header `key2` nhận giá trị native `publicKey`, không phải field native tên `key2`. Công thức được lần theo interceptor AOT và dùng thành công trong script email login + sync. Hash không chứa token hay body; chưa kết luận cách server kiểm tra từng endpoint.

## Hai tầng xác thực

1. **Tầng Firebase (native).** Google / Apple / Email đăng nhập qua Firebase Auth plugin native — **không đi qua Dio**. Kết quả là một ID token JWT, được gắn vào `Authorization`.
2. **Tầng tĩnh (`key2` + `hash`).** Mọi request đều có, kể cả trước khi đăng nhập. Đây là lớp chống sửa request phía client, nhưng `key2` nằm ngay trong APK nên chỉ có giá trị chống lạm dụng ở mức thấp.

## Trạng thái mất phiên Firebase

Khi phiên Firebase mất (ví dụ `pm clear` rồi khôi phục dữ liệu), app **vẫn còn `uid` trong cache** và vẫn gọi `getCoins`, `getContactV3`, `getLastMessage2`… nhưng **không có** `Authorization`, trong khi UI đang ở màn đăng nhập. Đây là quan sát request đi ra; chưa có response chứng minh server chấp nhận hoặc trả dữ liệu khi thiếu Bearer token. Xem chi tiết ở [bao-mat-va-luu-y.md](bao-mat-va-luu-y.md) (dòng request legacy).

## Redaction khi log

Hàm `scrub` trong [ola_api_logger.js](../../work/scripts/ola_api_logger.js) che:

- Key khớp `authorization|cookie|token|password|otp|secret|signature|key2|hash|…` → `***`
- Chuỗi `Bearer …`, JWT `eyJ…`, FCM token `…:APA91b…`, chuỗi opaque ≥ 80 ký tự → `***`
- Body dạng `{action:"token", value}` → che `value`

Log **vẫn còn** UID, deviceID, nội dung tin nhắn → không commit log.
