# Luồng phòng chat

Đường vào: Cá nhân → Phòng chat → danh sách tỉnh/thành. Danh sách này **render local, không gọi API**. Id phòng là **mã tỉnh** (Hồ Chí Minh = `79`).

## Vào phòng / tải tin nhắn

Đã vào phòng `79`, trình tự:

1. Socket mới `roomNo=<room>` (vd. `79`) — xem [socket-io.md](socket-io.md).
2. `POST /faApi2/addUserToRoom.php` `{"uid":"<uid>","state":"<room>"}` — **ghi dữ liệu**: đánh dấu user đang ở phòng.
3. `POST /faApi2/getMessageByRoom.php` `{"roomID":"<room>"}` — **tải lịch sử tin nhắn phòng**.
4. `POST /faApi2/checkBlockChat.php` `{"uid":"<uid>"}` — kiểm tra user có bị cấm chat không.
5. `SIO-OUT add user` `{"username":"<tên hiển thị>","roomNo":"<room>"}`

   Lưu ý: phòng chat dùng **tên hiển thị** làm `username`, còn chat 1-1 dùng **uid**. Socket server phân biệt hai loại phòng bằng giá trị `roomNo`.

6. Nhận realtime: `SIO-IN user joined` / `user left` `{username, numUsers}`, `SIO-IN new message`.

## Gửi tin vào phòng

Đã gửi thử 1 tin `"hi"` vào phòng `79`, gồm **2 request** (khác 1-1: **không** gọi `send-notification`):

### 1. Socket.IO emit

`SIO-OUT new message`:

```json
{"deviceID":"<deviceId>","mess":"hi","name":"<tên>","userID":"<uid>","photoURL2":"<avatar>",
 "send":1,"id":"<ms_timestamp><uid>","isVip":false,"level":1}
```

So với 1-1: dùng `name` thay `displayName`, `id` thay `messageID`, `send` là `1` thay `true`, có `deviceID` và `level`, **không** có `fcmTokenNguoiNhan`.

### 2. Lưu qua HTTP

`POST /faApi2/apiAddMessageRoom2.php` — **cùng payload**, cộng thêm `"roomID":"<room>","isVerifyAvatar":null`.

## Nhận tin về

`SIO-IN new message`:

```json
{"username":"<tên>","message":{deviceID, mess, name, userID, photoURL2, send, id, isVip, level}}
```

Tức nguyên object mà người gửi emit, gồm cả `deviceID` và `userID` của người gửi được broadcast cho **mọi người trong phòng**. Xem [bao-mat-va-luu-y.md](bao-mat-va-luu-y.md) mục 3.

## Danh sách thành viên

Icon menu trong phòng: `POST /faApi2/apiAddToRoomV4.php` `{"uid","page","state":"<room>"}`.

## Tóm tắt endpoint

| Method | Path | Vai trò | Ghi dữ liệu? |
|---|---|---|---|
| POST | `/faApi2/addUserToRoom.php` | Đánh dấu user vào phòng | **Có** |
| POST | `/faApi2/getMessageByRoom.php` | Tải lịch sử tin nhắn phòng | Không |
| POST | `/faApi2/checkBlockChat.php` | Kiểm tra bị cấm chat | Không |
| POST | `/faApi2/apiAddMessageRoom2.php` | Lưu tin nhắn phòng | **Có** |
| POST | `/faApi2/apiAddToRoomV4.php` | Danh sách thành viên | Không |

## Khác biệt phòng chat vs chat 1-1

| | Phòng chat | Chat 1-1 |
|---|---|---|
| Tải lịch sử | `getMessageByRoom.php` mỗi lần vào | Không gọi, dùng cache `getLastMessage2.php` |
| `username` khi `add user` | Tên hiển thị | uid |
| Định danh tin | `id` | `messageID` |
| Push notification | Không — chỉ socket | Có — client tự gọi `send-notification` |
| Broadcast `deviceID` | Có | Không |
