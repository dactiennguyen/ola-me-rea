# Tài liệu API — Ola (`com.olaachat`)

Bộ tài liệu về API của app Ola, tách ra từ [03](../03-api-calls-and-hooks.md) (phân tích tĩnh AOT) và [04](../04-runtime-api-capture.md) (bắt runtime bằng Frida).

Phiên test: 2026-11-03, app `com.olaachat` 27.7.8 (versionCode 405), máy root (Android 13, arm64, Magisk), Frida 17.23.3.

## Đọc theo thứ tự nào

| # | Tài liệu | Nội dung |
|---|---|---|
| 1 | [auth-va-header.md](auth-va-header.md) | Host, bộ header chung, cách xác thực, `key2`/`timestamp`/`hash` |
| 2 | [luong-dang-nhap-khoi-dong.md](luong-dang-nhap-khoi-dong.md) | Luồng Google/email → Firebase → backend; chuỗi 10 request lúc khởi động |
| 2b | [luong-dang-ky.md](luong-dang-ky.md) | Đăng ký email (form, `checkEmail.php`, Firebase, mail xác thực), lỗi, quên mật khẩu — từ AOT |
| 3 | [luong-chat-1-1.md](luong-chat-1-1.md) | Mở hội thoại, gõ, gửi tin 1-1 (3 bước: socket → push → HTTP) |
| 4 | [luong-phong-chat.md](luong-phong-chat.md) | Vào phòng, tải lịch sử, gửi tin phòng, danh sách thành viên |
| 5 | [socket-io.md](socket-io.md) | Server, query, danh sách event, shape payload |
| 6 | [endpoint-runtime.md](endpoint-runtime.md) | 40 endpoint đã bắt được khi chạy thật + so khớp inventory tĩnh |
| 7 | [endpoint-tinh.md](endpoint-tinh.md) | Inventory tĩnh từ AOT: 27 path `/napi` + 63 path `/faApi2` |
| 8 | [bao-mat-va-luu-y.md](bao-mat-va-luu-y.md) | 7 phát hiện phía client + tác dụng phụ của phiên test |
| 9 | [con-thieu.md](con-thieu.md) | Phần chưa bắt được / chưa phân tích |

Muốn chạy lại công cụ bắt request: xem [04-runtime-api-capture.md](../04-runtime-api-capture.md) (§2 cách chạy, §3 kỹ thuật hook).

## Quy ước

- `<uid>` = Firebase UID của tài khoản test, `<peer_uid>` = UID người nhận, `<room>` = id phòng, `<deviceId>` = Android ID.
- Token, `key2`, `hash`, FCM token **không** bao giờ được ghi vào tài liệu. Log thô nằm trong `work/*.log` (đã `.gitignore`).
- Mọi endpoint đều dùng host `https://sgdev.vip`; WebSocket ở `wss://sgdev.vip:3001`; Caro online ở `https://sgdev.vip:5000/caro`.
- Body luôn là JSON, kể cả `faApi2/*.php`.

## Nguồn dữ liệu

| Loại | Nguồn | Độ tin cậy |
|---|---|---|
| Endpoint, method, body key **chạy thật** | Hook `DioMixin.fetch` + `DioMixin._dispatchRequest` tầng Dart | Cao — plaintext trước khi TLS |
| Frame Socket.IO | Hook `Encoder.encodeAsString` / `Decoder.decodeString` | Cao |
| Endpoint chỉ thấy trong AOT | `work/dae-aot-20261102/dart/*.dart` | Trung bình — chứng minh API surface, không chứng minh có được gọi |
| Backend PHP hay Node.js | Suy luận từ path | **Không khẳng định** — xem [03 §PHP hay Node.js](../03-api-calls-and-hooks.md#php-hay-nodejs) |

Bản CSV: [work/api_runtime_inventory.csv](../../work/api_runtime_inventory.csv) (runtime, 40 dòng) và [work/api_inventory.csv](../../work/api_inventory.csv) (tĩnh, 135 dòng).

Ví dụ Node: [đăng nhập một file](nodejs-login.md) và [workflow chat](vi-du-chat-nodejs.md).

Khám phá: [API ba tab, bộ lọc, response và phân trang](luong-kham-pha.md).
