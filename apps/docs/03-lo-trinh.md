# 03 · Lộ trình

Cập nhật 2026-11-04.

## Đã làm

| Giai đoạn | Nội dung | Kiểm chứng |
|---|---|---|
| 0 · Khảo sát | Chọn Tauri 2; chọn design C; quan sát shape response `getMessageByRoom`, `apiAddToRoomV4`, `checkBlockChat`, `getLastMessage2` (chỉ key) | Ghi vào `docs/api/endpoints/*.md` |
| 1 · Tách lõi | `defaults.ts`, `md5.ts`, `node.ts`; `OlaClient.login()` nhận account/config/fetch; `chat.ts` (kênh Socket.IO, payload, chuẩn hoá, luồng gửi) | `scripts/nodejs`: `tsc` sạch, **613/613 test**, gồm test chặn `node:*` trong lõi và test thứ tự gửi chat |
| 2 · Khung app | Tauri 2 + React, phần Rust, capability/CSP, icon | `tsc` sạch, `vite build` OK, `cargo build` OK |
| 3 · Tài khoản | `accounts.json` (JSON thường, chmod 600), đổi tài khoản, cài đặt | Chưa chạy thử trong cửa sổ Tauri |
| 4 · Tin nhắn + chat 1-1 | Danh sách gộp server + cache, chat realtime, đang gõ, gửi 3 bước | Lõi có test; UI chưa chạy thử với server |
| 5 · Khám phá | 3 tab, bộ lọc, cuộn vô hạn, nhắn tin từ thẻ | Endpoint đã chạy thật trên Node trước đây |
| 6 · Phòng chat | Vào phòng, lịch sử, thành viên, gửi, khoá khi bị cấm | Endpoint đọc đã chạy thật 2026-11-04 |
| 8 · Nhiều nick cùng lúc | Nhiều tài khoản online song song (đăng nhập bằng tay, có *Đăng nhập tất cả*); cột tài khoản; màn của từng nick giữ trạng thái; Thông tin tài khoản | Headless Chrome với 3 nick (2 tự đăng nhập song song, 1 offline); chưa chạy với nhiều nick thật |
| 7 · Socket key | Khôi phục `key` tĩnh của Socket.IO = `6Q5AY7RZVR06LFAA07TC`; đặt làm mặc định `socketDefaults.key` | APK + 1 kết nối sống 2026-11-04 ([socket-io.md](../../docs/api/socket-io.md#key-được-tạo-như-thế-nào)) |

## Việc cần làm tiếp

Theo thứ tự ưu tiên:

1. <a id="socket-key"></a>**Chạy thử realtime end-to-end**. Socket key đã có (`6Q5AY7RZVR06LFAA07TC`, mặc định sẵn; là hằng số tĩnh `wasabiKeyID` trong `libnative-lib.so`, [socket-io.md](../../docs/api/socket-io.md#key-được-tạo-như-thế-nào)). Muốn thay thì dán giá trị khác vào **Cài đặt › Socket key**, hoặc `OLA_SOCKET_KEY` cho CLI. Cần chạy thử trong cửa sổ Tauri với 2 tài khoản test A ↔ B: đăng nhập, Khám phá, mở chat, gửi/nhận, phòng `79`. Đặc biệt cần xác nhận:
   - Firebase Auth chạy trong webview với origin `tauri://localhost`.
   - Server socket chấp nhận Origin của webview. Nếu bị chặn: viết client Engine.IO v3 phía Rust (`tokio-tungstenite`, gửi `2`/nhận `3` ping-pong, khung `42[...]`) và phát sự kiện sang webview bằng Tauri event. Lưu ý `rust_socketio` chỉ hỗ trợ EIO 4, không dùng được.
   - Kênh cá nhân có cần `add user` không (hiện đang emit `{username: uid, roomNo: uid}`, [Suy luận]).
3. **Shape phần tử `getLastMessage2`** khi tài khoản có hội thoại → chỉnh `normalizeConversations()` và bỏ phần đoán field.
4. **Bảng tỉnh/thành của app**: đối chiếu 61 mã chưa kiểm chứng trong `src/lib/provinces.ts` với dữ liệu tĩnh trong AOT.
5. Thứ tự lịch sử `getMessageByRoom` và phân trang (nếu có).

## Mở rộng sau

| Tính năng | Cần gì |
|---|---|
| Gửi ảnh / sticker / tin thoại | Bắt `FormData` của `postUploadChat`/`upAudio` ([con-thieu.md](../../docs/api/con-thieu.md) mục 5) |
| Trả lời tin (reply) | Payload đã có `replyID`/`replyText`; cần một capture có giá trị |
| Thông báo hệ điều hành khi có tin | `tauri-plugin-notification`; chỉ khi app đang chạy |
| Hộp thư gộp mọi nick | Đã có nhiều nick online cùng lúc; cần màn gộp danh sách hội thoại, gắn nhãn nick |
| Mã hoá `accounts.json` | `tauri-plugin-stronghold` hoặc Keychain (hiện cố ý không dùng) |
| Bản Windows/Linux | Build trên máy tương ứng; quyền 600 chỉ áp dụng Unix |

## Rủi ro

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Server đổi socket key tĩnh | Không gửi/nhận tin realtime | Chỉnh trong Cài đặt / `OLA_SOCKET_KEY`; các màn đọc vẫn chạy |
| Server socket chặn Origin webview | Không gửi/nhận tin realtime | Client EIO3 phía Rust |
| Lịch sử 1-1 không có trên server | Máy mới chỉ thấy tin cuối | Cache `chat-<uid>.json`; nói rõ trong UI |
| Mật khẩu lưu JSON thường | Ai đọc được file sẽ có mật khẩu | chmod 600, thư mục ngoài repo; chọn mã hoá ở bản sau |
| Gửi tin tới người thật | Tác động lên dịch vụ thật | Thử giữa 2 tài khoản test; *Chế độ thử*; không có tính năng gửi hàng loạt |
| App Ola đổi phiên bản/API | Ký sai, endpoint đổi | Phiên bản/khoá chỉnh được trong Cài đặt; lõi có golden test |

## Câu hỏi mở

- Device ID: mỗi tài khoản một mã ngẫu nhiên (hiện tại) hay dùng Android ID thật của máy đã đăng nhập?
