# Bảo mật — quan sát phía client và tác dụng phụ

Các mục dưới đây là bằng chứng về request/payload phía client. Chưa replay truy cập chéo tài khoản, chưa chứng minh server thiếu kiểm tra quyền và chưa có cơ sở chấm mức nghiêm trọng như lỗ hổng đã xác minh.

| Quan sát | Giới hạn kết luận |
|---|---|
| Client gọi `send-notification` với token người nhận, title/body/data | Backend gửi push; chưa chứng minh chấp nhận token hoặc nội dung tùy ý ngoài quyền tài khoản |
| `fcmTokenNguoiNhan` có trong socket payload | Người gửi biết token người nhận. `addLastMessage5.fcmToken` và push `data.fcmToken` lại là token người gửi |
| Frame phòng chat đã nhận chứa `deviceID`, `userID` người gửi | Có dữ liệu định danh trong payload; chưa kiểm chứng mọi phòng/trường hợp |
| Socket query chứa key tĩnh; payload khai username/userID | Chưa thấy user token trong capture không đồng nghĩa server không ràng buộc danh tính |
| Request legacy truyền uid trong body; có request thiếu Bearer khi mất phiên | Logger request không chứng minh server chấp nhận, trả dữ liệu hoặc có IDOR |
| `/napi/users/notifications/{uid}` đặt uid trên path | Cấu trúc path tự nó không chứng minh truy cập chéo tài khoản |
| Client gửi socket và cập nhật tin cuối qua HTTP | Các bước có thể lỗi riêng; chưa chứng minh server tin mọi field do client gửi |
| Object `user` mà `napi/users/sync` trả về có key `password` (chuỗi ngắn, quan sát 2026-11-04, chỉ ghi kiểu) cùng `email`, `lat`/`lng`, `fcmToken` | Chưa rõ đây là mật khẩu, hash hay field khác; không lưu nguyên profile. App desktop chỉ giữ `displayName`, `photoURL`, `isVip`, `level`, `isVerifyAvatar` |

Công thức hash đã được phân tích và dùng thành công cho login/sync; xem [auth-va-header.md](auth-va-header.md). Không suy rộng kết quả sang quyền truy cập các endpoint khác.

## Tác dụng phụ của phiên test

Các hành động đã thực hiện khi bắt request — cần biết để không lặp lại nhầm:

- Đã gửi **1 tin `"hi"`** trong chat 1-1 (tới hội thoại có sẵn) và **1 tin `"hi"`** vào phòng chat Hồ Chí Minh (`79`).
- `addUserToRoom.php` đã ghi tài khoản vào phòng `79` và phòng `6`.
- Đã mở các màn Thích bạn, Thông báo, Danh sách chặn, Lịch sử giao dịch, hồ sơ một user (sinh ra `addViewProfile`), leaderboard mini game. **Không** follow, like, tặng quà, nạp xu, đăng bài.
- Ngày 2026-11-04, khi dựng app desktop: chỉ gọi các endpoint đọc `getLastMessage2`, `getMessageByRoom` (phòng `79`), `checkBlockChat`, `apiAddToRoomV4` (phòng `79`) và login/sync bằng tài khoản test (`deviceid` `nodejs-probe`); chỉ ghi lại tên key/kiểu của response. Không gửi tin, không gọi `addUserToRoom`.
- Dữ liệu app đã sao lưu bằng root (`/sdcard/olaachat_data_backup_20261103.tgz`), `pm clear`, rồi khôi phục. Phiên Firebase **không** khôi phục được (khoá Android Keystore bị xoá cùng `pm clear`), nên cần đăng nhập Google lại 1 lần.

## Nguyên tắc khi làm tiếp

Từ chính tài liệu dự án:

> Không đưa token, cookie, private key, access key hoặc giá trị credential vào tài liệu. Khi replay, phải dùng credential của chính phiên thử nghiệm và giữ chúng ngoài git/log.

> Khi capture plaintext bodies, log only host/path và redact `Authorization`, cookie, token, password.

> Trước khi gọi endpoint ghi dữ liệu (`update`, `add`, `send`, `upload`, `delete`), nên dùng test account, chụp request bằng hook trước, và không replay request có tác dụng phụ nếu chưa xác định body.

Ngoài ra: `.claude/settings.local.json` chứa `ANTHROPIC_AUTH_TOKEN` — không bao giờ echo ra hoặc commit.
