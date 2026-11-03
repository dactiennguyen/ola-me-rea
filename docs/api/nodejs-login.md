# Chạy đăng nhập bằng Node.js

Script đăng nhập duy nhất là `scripts/nodejs/login.js`. API Khám phá nằm riêng trong `scripts/nodejs/explore.js`; xem [cách chạy và API JavaScript](luong-kham-pha.md#client-node-explorejs). Tài khoản và cấu hình nằm ở các const đầu file; file **có trong Git kèm email và mật khẩu**, không push lên remote công khai. Cần Node.js 18+ và cài dependency bằng Yarn (Firebase JS SDK).

```powershell
cd scripts/nodejs
corepack yarn install      # hoặc `yarn install` nếu đã có yarn
node login.js              # hoặc `corepack yarn login`
node login.js --firebase-only
```

`package.json` ghim `yarn@1.22.22` qua trường `packageManager`, nên `corepack yarn` dùng đúng bản này. `node_modules/` được Git ignore.

CLI in session Firebase (`localId`, `email`, `idToken`, `refreshToken`, `expirationTime`), Firebase user (`user.toJSON()` của SDK) và hồ sơ Ola từ sync. Đầu ra chứa credential; không đưa vào commit. Script không tự ghi session ra đĩa.

Luồng chạy:

1. Firebase JS SDK `signInWithEmailAndPassword` với persistence trong bộ nhớ. SDK tự gọi `accounts:signInWithPassword` và `accounts:lookup`.
2. Kiểm tra email đã xác minh, rồi lấy `napi/general/getTimes`.
3. Gọi `napi/users/sync` với Bearer ID token và [header ký](auth-va-header.md).
4. Kiểm tra UID hồ sơ Ola khớp Firebase UID và in toàn bộ kết quả.
5. `closeFirebase()` giải phóng SDK để process thoát.

Lỗi đăng nhập in mã SDK, ví dụ `Firebase sign-in failed (auth/invalid-credential).`

Firebase config lấy từ Android resources; `apiKey` là trường cần cho đăng nhập email. HTTP `key2` lấy từ native `publicKey`. Không cần `authDomain` cho luồng này.

Mỗi lần chạy script đều đăng nhập mới. App Android giữ phiên Firebase và cache hồ sơ nên thường không hỏi mật khẩu khi mở lại; script chưa lưu phiên ra đĩa.

Có thể import `login()` để nhận `{session, user, firebaseUser, profile}` trong bộ nhớ; import không tự đăng nhập. ID token hết hạn sau 1 giờ: với tiến trình chạy lâu, lấy token mới bằng `await firebaseUser.getIdToken()` thay vì dùng lại `session.idToken`. `requestOla(token, path, body)` ký và gửi POST đến host Ola cố định.

Bản dùng SDK mới được kiểm tra bằng Firebase/Ola giả lập (đăng nhập, token, sai mật khẩu, process tự thoát); chưa chạy đăng nhập live sau khi chuyển sang SDK. Luồng REST trước đó đã đăng nhập live thành công.

Xem [workflow chat](vi-du-chat-nodejs.md) để hiểu dữ liệu cần cho gửi tin.
