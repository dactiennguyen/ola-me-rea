# Luồng đăng nhập và khởi động

## Đăng nhập (Google)

Màn đăng nhập có Email/mật khẩu, Google, Apple, "Quên mật khẩu", "Đăng ký". Luồng Google quan sát được:

1. `GET /napi/general/getTimes` — chạy ngay khi mở app, **trước khi đăng nhập** (chỉ có `key2/timestamp/hash`, không có `Authorization`).
2. Google Sign-In → Firebase Auth: chạy trong plugin native, **không qua Dio**.
3. `POST /napi/users/sync` — request backend **duy nhất** của bước đăng nhập, đã có `Authorization`:

   ```json
   {"os":"android","deviceId":"<deviceId>","ver":"13","displayName":"<tên>","photoURL":"<google avatar url>"}
   ```

   `ver` ở đây là **phiên bản Android** (`13`), khác header `ver` (phiên bản app `27.7.8`).

4. Mở 2 socket: `roomNo=Olame` (kênh chung) và `roomNo=<uid>` (kênh cá nhân).
5. Chạy chuỗi khởi động bên dưới.

Chưa bắt: Apple, đăng ký, quên mật khẩu. Trong màn Cài đặt đã xem chưa thấy nút đăng xuất; AOT có hàm logout nên không kết luận app không hỗ trợ đăng xuất. Không thử xóa tài khoản.

Xem thêm [socket-io.md](socket-io.md) cho chi tiết kết nối.

## Email/mật khẩu và lưu phiên

Phiên thiết bị root ngày 2026-11-03 đã đăng nhập email thành công. App gọi Firebase Auth native rồi `POST /napi/users/sync` với Bearer ID token; body có `os:"android"`, `deviceId`, `ver:"13"`, `displayName:""`, `photoURL:""`. Sau hộp thoại cập nhật thông tin tùy chọn, app vào màn chính và mở socket khởi động.

AOT cho thấy response `user` được parse thành `UserModel`, lưu `USER_DATA_JSON`, `USER_UID`, `USER_EMAIL` và access token qua FlutterSecureStorage. Firebase cũng giữ auth state trong shared preferences riêng của SDK. Khi phiên còn hợp lệ, app khôi phục người dùng và dùng lại/refresh token nên không cần nhập mật khẩu mỗi lần mở app. App có thể đồng bộ lại hồ sơ và chạy các request khởi động.

Hồ sơ cá nhân đọc được từ UserModel đã sync/cache. Khi mở hồ sơ người khác, provider có `getUserInfoV7.php` (`myUid`, `targetUid`), `shouldLoadFeed.php` (`uid`) và `getPostByUserV7.php` (`uid`, `page`). Một khoảng log không đủ chứng minh mọi lần mở hồ sơ đều không phát sinh request.

Bản Node chạy Firebase REST login → lookup → getTimes → sync. Xem [cách chạy script duy nhất](nodejs-login.md). Hồ sơ được in nguyên trạng, gồm `autoID`, `uid`, `displayName`, `xu`, `level`; không tự đồng nhất ID trên UI với `autoID` khi chưa đối chiếu.

## Khởi động (đã đăng nhập)

`AppInitNotifier_loadAllInitData()` chạy song song `loadAppConfig`, `checkUV2`, `getCoins`, `getNoti`. Trình tự bắt được trên dây:

| # | Request | Body |
|---|---|---|
| 1 | `GET /napi/general/getTimes` | – |
| 2 | `POST /napi/users/updateLastSeen` | `{}` |
| 3 | `POST /faApi2/check_update_app.php` | `{"uid":1}` — hằng số `1`, **không phải** uid thật |
| 4 | `POST /faApi2/checkUV2.php` | `{uid}` |
| 5 | `POST /faApi2/getCoins.php` | `{uid}` |
| 6 | `POST /faApi2/getLastMessage2.php` | `{"roomID":"<uid>"}` — danh sách hội thoại |
| 7 | `POST /faApi2/getNotificationsCount.php` | `{uid}` |
| 8 | `POST /faApi2/getContactV3.php` | `{uid}` |
| 9 | `POST /faApi2/updatePost.php` | `{"action":"token","id":"<uid>","value":<FCM token>}` — đăng ký FCM token |
| 10 | `POST /faApi2/getNotiCountLove.php` | `{uid}` |

Trong capture này, các call 3–5, 7, 10 xuất hiện hai lần; chưa kết luận mọi lần khởi động đều như vậy.

## Vai trò từng call (từ phân tích tĩnh)

| Endpoint | Vai trò |
|---|---|
| `/faApi2/check_update_app.php` | Đọc HTTP 200, parse `AppConfigModel`, so sánh version cài đặt |
| `/faApi2/getCoins.php` | Response field `level` được đọc |
| `/faApi2/getNotiCountLove.php` | Response field `countL` được đọc |
| `/faApi2/getNotificationsCount.php` | Badge notification |
| `/faApi2/getContactV3.php` | Danh sách liên hệ |
| `/faApi2/getMessageByRoom.php` | Response field `data`; có nhánh `incognito` trước khi gọi |

`uid` là tên key quan sát được; giá trị thật lấy từ state đăng nhập và không ghi lại.

## Điểm cần lưu ý

- `check_update_app.php` gửi `uid: 1` cố định — nhiều khả năng server chỉ dùng để trả config, không phân biệt user.
- FCM token được đăng ký ngay trong chuỗi khởi động, qua `updatePost.php` với `action:"token"` — cùng endpoint dùng để cập nhật post.
- Hồ sơ UserModel được lấy từ response `users/sync` và lưu cache. Socket cá nhân nhận event cập nhật/thông báo; chưa chứng minh nó trả toàn bộ hồ sơ.
