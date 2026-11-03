# Chạy đăng nhập bằng Node.js

Chỉ có một script: `scripts/nodejs/login.js`. File local chứa tài khoản và cấu hình ở các const đầu file, được Git ignore. Cần Node.js 18+, không cần npm install.

```powershell
node scripts/nodejs/login.js
node scripts/nodejs/login.js --firebase-only
```

CLI in đầy đủ JSON của Firebase session (gồm ID token và refresh token), Firebase user từ lookup, và hồ sơ Ola từ sync. Đầu ra chứa credential; không đưa vào commit. Script không tự ghi session ra đĩa.

Luồng chạy:

1. Firebase REST `accounts:signInWithPassword` với email, password và `returnSecureToken:true`.
2. `accounts:lookup` bằng ID token vừa nhận để lấy Firebase user.
3. Kiểm tra email đã xác minh, rồi lấy `napi/general/getTimes`.
4. Gọi `napi/users/sync` với Bearer ID token và [header ký](auth-va-header.md).
5. Kiểm tra UID hồ sơ Ola khớp Firebase UID và in toàn bộ kết quả.

Firebase config lấy từ Android resources; `apiKey` là trường cần cho REST login. HTTP `key2` lấy từ native `publicKey`. Không cần `authDomain` cho luồng này.

Mỗi lần chạy script đều đăng nhập mới. App Android giữ phiên Firebase và cache hồ sơ nên thường không hỏi mật khẩu khi mở lại; script chưa lưu hoặc refresh phiên tự động.

Có thể import `login()` để nhận `{session, user, profile}` trong bộ nhớ; import không tự đăng nhập. `requestOla(token, path, body)` ký và gửi POST đến host Ola cố định.

Luồng email login + lookup + sync đã thành công trong phiên thử trước. Đã kiểm tra cú pháp, ba kiểm tra giả lập cho login/token/header và kiểm tra việc in đủ trường. Bản dọn file không chạy thêm đăng nhập live. Các bản example, probe, test và JSON cấu hình trùng đã được bỏ; cấu hình cần dùng vẫn nằm trong file local duy nhất.

Xem [workflow chat](vi-du-chat-nodejs.md) để hiểu dữ liệu cần cho gửi tin. File login local không nằm trong commit; clone repo sang máy khác không tự có script chứa tài khoản này.
