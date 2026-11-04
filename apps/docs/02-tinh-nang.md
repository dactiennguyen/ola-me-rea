# 02 · Tính năng

Phạm vi bản này: **tài khoản, danh sách tin nhắn, chat 1-1, Khám phá, phòng chat**, chỉ tin văn bản. Mọi request đi qua lõi `scripts/nodejs/src` với header ký như app gốc ([auth-va-header.md](../../docs/api/auth-va-header.md)). Cột "Ghi?" đánh dấu request đổi trạng thái server.

## Thanh bên

- Danh sách tài khoản đã lưu kèm trạng thái: *Đang hoạt động*, *Đang đăng nhập…*, lỗi (thông báo đã dịch sang tiếng Việt), hoặc thời điểm đăng nhập lần cuối. Bấm vào tài khoản khác để chuyển.
- Mục: Tin nhắn (badge số tin chưa đọc), Khám phá, Phòng chat, Quản lý tài khoản.
- Ô *Kết nối realtime* phản ánh kênh hộp thư cá nhân: *Ổn định*, *Đang kết nối…*, *Mất kết nối*. Socket key đã có mặc định nên kênh tự kết nối sau khi đăng nhập, không cần nhập gì (*Thiếu socket key* chỉ hiện nếu người dùng tự xoá key trong Cài đặt › Nâng cao).

## Quản lý tài khoản

| Thao tác | Gọi | Ghi? |
|---|---|---|
| Thêm / sửa / xoá | Chỉ ghi `accounts.json` | Không |
| Đăng nhập (*Lưu và đăng nhập*, *Dùng*, *Thử lại*) | Firebase `signInWithPassword` → `GET napi/general/getTimes` → `POST napi/users/sync` | **Có**: `users/sync` đăng ký Device ID |
| Đăng xuất | Đóng Firebase app + socket trên máy, bỏ chọn tài khoản (lần mở app sau không tự đăng nhập) | Không |
| **Đăng ký mới** | `POST faApi2/checkEmail.php` (ký, không Bearer; cần `valid: true`) → Firebase `createUserWithEmailAndPassword` → `sendEmailVerification` | **Có**: tạo tài khoản Firebase thật, gửi mail |
| Gửi lại email xác thực | Firebase `signInWithPassword` → `sendEmailVerification` (không gọi backend Ola) | **Có**: gửi mail |
| Nhập / Xuất | Chỉ đọc/ghi `accounts.json`; file xuất nằm trong Downloads | Không |

- Form: tên hiển thị (trống thì dùng tên Ola), email, mật khẩu (nút hiện/ẩn), Device ID (16 hex, nút tạo mới).
- Email chưa xác minh bị từ chối, giống app (lõi kiểm tra `emailVerified` trước `sync`).
- **Đăng ký mới** làm giống màn đăng ký của app Android ([luong-dang-ky.md](../../docs/api/luong-dang-ky.md)): email (regex `^[^@]+@[^@]+\.[^@]+`, được trim), mật khẩu ≥ 6 ký tự, nhập lại mật khẩu, hai ô bắt buộc (đồng ý Điều khoản sử dụng, đủ 18 tuổi); cùng câu báo lỗi. Link điều khoản hiện dạng chữ kèm nút sao chép (app chưa mở được link ngoài). `checkEmail` được ký bằng Device ID mới của tài khoản. Xong thì tài khoản vào danh sách (không tự chọn) với trạng thái "Đã gửi email xác thực"; mở link trong mail rồi bấm *Dùng*. Lõi: `scripts/nodejs/src/register.ts` (`registerAccount`, `resendVerificationEmail`, `OlaClient.anonymous`).
- **Gửi lại email xác thực** hiện ở tài khoản vừa đăng ký hoặc đăng nhập bị từ chối vì chưa xác minh. App Android không có nút này (chỉ gửi một lần lúc đăng ký).
- **Xuất**: file `ola-accounts-YYYYMMDD-HHMMSS.json` trong thư mục Downloads (không ghi đè, quyền 600 trên macOS/Linux) hoặc *Sao chép JSON*. Gồm email, **mật khẩu dạng chữ thường**, tên, Device ID của mọi tài khoản.
- **Nhập**: chọn file hoặc dán chữ. Nhận file xuất của app, mảng JSON `[{email, password, label?, deviceId?}]`, hoặc mỗi dòng `email|mật khẩu` (dấu ngăn đầu tiên trên dòng trong `|`, tab, `,`, `;`, `:`; phần còn lại là mật khẩu; dòng `#` bị bỏ qua; khoảng trắng đầu/cuối dòng bị cắt). Trước khi nhập hiện số sẽ thêm / cập nhật / giữ nguyên và các dòng lỗi. Trùng email (không phân biệt hoa thường) thì cập nhật mật khẩu và tên, **giữ Device ID cũ**; email mới được thêm với Device ID trong file hoặc mã mới.
- **Cài đặt**: app version, Android version, key2 (ba mục áp dụng từ lần đăng nhập sau), *Chế độ thử* (tin chỉ hiện trên máy, không gửi), *Khôi phục mặc định*. Socket key **không** nằm ở phần chính vì đã có mặc định chạy được; nó nằm trong mục **Nâng cao** (ẩn mặc định), chỉ cần đổi khi app gốc đổi key. Hiển thị máy chủ API/socket (cố định, xem [01 · Kiến trúc](01-kien-truc.md#file-dữ-liệu)) và thư mục dữ liệu.

## Tin nhắn: danh sách hội thoại

| Thao tác | Gọi | Ghi? |
|---|---|---|
| Mở màn / *Tải lại* | `POST faApi2/getLastMessage2.php {roomID: uid}` | Không |
| Hội thoại thiếu tên | `POST faApi2/getUserInfoForChatV2.php {id}` (tối đa 20, tuần tự) | Không |

- Danh sách = response server **gộp** với cache trên máy (`chat-<uid>.json`), sắp theo thời gian mới nhất. Shape phần tử `getLastMessage2` chưa quan sát được (tài khoản test rỗng), nên `normalizeConversations()` chấp nhận nhiều tên field.
- Tìm theo tên hoặc nội dung; nút **+** mở chat theo UID.
- Tin đến từ kênh cá nhân đưa hội thoại lên đầu và tăng số chưa đọc nếu đang không mở.

## Chat 1-1

Mở hội thoại:

1. Đọc lịch sử trên máy.
2. `POST faApi2/getUserInfoForChatV2.php {id: peer}` → tên, ảnh, `fcmToken`, `lastSeen`.
3. Socket `roomNo=<peer>`, sau khi connect emit `add user {username: uid mình, roomNo: peer}`.

Gửi tin (đúng thứ tự app gốc, [luong-chat-1-1.md](../../docs/api/luong-chat-1-1.md)):

| Bước | Gọi | Ghi? |
|---|---|---|
| 1 | Socket `new message` (payload 16 key, `messageID = <ms><uid>`) | **Có** |
| 2 | `POST napi/general/send-notification` (chỉ khi người nhận có `fcmToken`) | **Có** |
| 3 | `POST faApi2/addLastMessage5.php` | **Có** |

- Socket chưa kết nối thì **không gửi gì** (bước HTTP không chạy). Bước 2/3 lỗi thì tin vẫn hiện, kèm dòng cảnh báo ("Đã gửi realtime; lỗi lưu tin cuối").
- App desktop không có FCM token thiết bị nên `fcmToken` của người gửi là chuỗi rỗng; người khác nhắn đến chỉ hiện khi app đang mở (kênh cá nhân), không có push.
- Đang gõ: emit `typing` khi bắt đầu nhập, `stop typing` sau 2 giây ngừng; hiện "… đang soạn tin" khi nhận `typing`.
- Enter gửi, Shift+Enter xuống dòng; tối đa 2000 ký tự.
- Ô nhập bị khoá kèm lý do khi: thiếu socket key, socket chưa kết nối, chưa tải được người nhận.

## Khám phá

| Tab | Gọi | Ghi? |
|---|---|---|
| Online | `POST faApi2/getExploreOnlineV6.php` (cursor `lastSeenPaging`) | Không |
| Đã xác thực | `POST faApi2/getExplore3.php` | Không |
| Ảnh có mặt | `POST faApi2/getExploreAvatarV4.php` | Không |

- Lọc giới tính (Tất cả/Nữ/Nam/LGBT → bỏ key/0/1/2) và tỉnh (`cityID`), như [luong-kham-pha.md](../../docs/api/luong-kham-pha.md).
- Tự tải trang tiếp khi cuộn gần cuối (và nút *Tải thêm*); dừng khi `list_data` rỗng; bỏ trùng theo `uid`.
- Bộ lọc không ai khớp: server trả `{is_success: false, list_data: []}`; app hiện "Không có ai khớp bộ lọc." như app gốc, không báo lỗi.
- Thẻ người dùng: ảnh, tên, huy hiệu xác thực, VIP, *Mới*, cấp, tỉnh, lần truy cập; **Nhắn tin** mở chat 1-1.

## Phòng chat

| Thao tác | Gọi | Ghi? |
|---|---|---|
| Vào phòng | `addUserToRoom.php {uid, state}` → `getMessageByRoom.php {roomID}` → `checkBlockChat.php {uid}` | **Có** (`addUserToRoom` đánh dấu đang ở phòng) |
| Realtime | Socket `roomNo=<mã>`, `add user {username: tên hiển thị, roomNo}`; nhận `new message`, `user joined/left` | — |
| Thành viên | `POST faApi2/apiAddToRoomV4.php {uid, page:0, state}` | Không |
| Gửi | Socket `new message` (9 key, có `deviceID`, `level`) → `apiAddMessageRoom2.php` (+`roomID`, `isVerifyAvatar`) | **Có** |

- Danh sách phòng = 63 tỉnh/thành dựng sẵn trong app (giống app gốc, không gọi API). Mã đã kiểm chứng: `79` (Hồ Chí Minh), `1` (Hà Nội trong Khám phá); các mã khác theo cùng quy ước, cần đối chiếu.
- Lịch sử phòng lấy từ server mỗi lần vào (shape đã quan sát, [getMessageByRoom.md](../../docs/api/endpoints/getMessageByRoom.md)), sắp theo `timestamp`.
- `checkBlockChat.isBlock === true` thì khoá ô nhập.
- Header hiện số người trong phòng từ sự kiện `user joined/left`; panel thành viên có nút nhắn tin 1-1.
- **Lưu ý:** phòng chat broadcast `deviceID` và `userID` của người gửi cho mọi thành viên (đặc điểm của giao thức gốc).

## Ngoài phạm vi bản này

Ảnh, sticker, quà, tin thoại, trả lời tin (reply), thông báo hệ điều hành, gọi thoại/video, bài viết/story, VIP/xu, Caro, nhiều tài khoản online cùng lúc. Xem [03 · Lộ trình](03-lo-trinh.md).
