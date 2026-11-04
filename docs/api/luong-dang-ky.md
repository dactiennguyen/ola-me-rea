# Luồng đăng ký, xác thực email và quên mật khẩu

Đối chiếu app 27.7.8 / vc405 bằng **phân tích tĩnh AOT** (`work/dae-aot-20261102/`). Luồng này **chưa bắt trên dây**: chạy thử nghĩa là tạo một tài khoản Firebase thật, nên phiên điều tra chưa làm. Mọi chi tiết dưới đây là [Suy luận/AOT] trừ khi ghi khác; chuỗi tiếng Việt lấy từ `assets/translations/vi.json` và object pool `work/dae-aot-20261102/text/pp.txt`.

## Tóm tắt

```text
Màn đăng nhập → "Đăng ký" → RegisterScreen
  1. Kiểm tra form (email, mật khẩu, nhập lại) và 2 ô bắt buộc
  2. POST /faApi2/checkEmail.php {email}        → response.valid (bool)
       valid != true → "Email không hợp lệ, hãy chọn email khác", dừng
  3. Firebase Auth createUserWithEmailAndPassword(email, password)   (native, không qua Dio)
  4. user.sendEmailVerification()                                    (Firebase gửi mail)
  5. Hộp thoại "Một email xác thực đã được gửi tới {email}…" → OK → về màn đăng nhập
Người dùng bấm link trong mail, rồi đăng nhập bằng email/mật khẩu
  6. signInWithEmailAndPassword → user.reload() → emailVerified?
       false → EmailNotVerifiedException, không đăng nhập
       true  → POST /napi/users/sync  (lúc này backend Ola mới tạo hồ sơ user)
```

Đăng ký chỉ chạm backend Ola **một lần** (`checkEmail.php`). Tài khoản được tạo ở **Firebase** (project `olaachat`); bản ghi user phía Ola được tạo/cập nhật ở lần đăng nhập đầu qua [`napi/users/sync`](endpoints/usersSync.md), giống [luồng đăng nhập](luong-dang-nhap-khoi-dong.md).

## Màn đăng ký

Tiêu đề **"Đăng ký tài khoản"**, phụ đề "Tạo tài khoản mới để trải nghiệm đầy đủ tính năng.", nút **"ĐĂNG KÝ NGAY"**. Mở từ nút "Đăng ký" (`sign_up`) của màn đăng nhập.

| Trường | Kiểm tra (validator của `TextFormField`) | Thông báo lỗi |
|---|---|---|
| Email | Bắt buộc; khớp regex `^[^@]+@[^@]+\.[^@]+`; giá trị được `trim()` trước khi gửi | "Vui lòng nhập email" / "Email sai định dạng" |
| Mật khẩu | Độ dài **≥ 6** ký tự (`cmp x1, #6` → `>= 6` là hợp lệ, dù câu báo là "trên 6") | "Mật khẩu phải trên 6 ký tự" |
| Nhập lại mật khẩu | Phải trùng ô Mật khẩu | "Mật khẩu không khớp" |
| ☐ "Tôi đã đọc và đồng ý với Điều khoản sử dụng" | Bắt buộc tick | "Vui lòng đồng ý điều khoản và xác nhận độ tuổi." (hộp thoại lỗi) |
| ☐ "Tôi xác nhận mình đủ 18 tuổi trở lên" | Bắt buộc tick | (cùng thông báo trên) |

- Hai ô mật khẩu có nút ẩn/hiện riêng.
- Chữ "Điều khoản sử dụng" mở `https://olaachat.web.app/TermAppOlaMe.html` trong WebView của app (`CommonWebViewPage`).
- Mật khẩu **không** được `trim()`; chỉ email được trim.
- Hai checkbox được kiểm **sau** khi form hợp lệ; thiếu một trong hai ô là hiện hộp thoại lỗi, không gọi mạng.

## Các bước khi bấm "ĐĂNG KÝ NGAY"

1. `FormState.validate()`; sai thì dừng, lỗi hiện dưới từng ô.
2. Cả hai checkbox phải được tick, nếu không thì hiện hộp thoại `agree_terms_required`.
3. **`POST /faApi2/checkEmail.php`** với body `{"email": "<email đã trim>"}` (xem [checkEmail](endpoints/checkEmail.md)). App đọc `response.data["valid"]` dưới dạng `bool`:
   - `valid` là `true`: đi tiếp.
   - Còn lại: snackbar **"Email không hợp lệ, hãy chọn email khác"** rồi dừng. Câu báo không nói lý do (email đã dùng, tên miền bị chặn…); AOT không cho biết server dựa vào gì.
   - Lúc này chưa có phiên Firebase, nên request chỉ có bộ header ký `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`, **không có** `Authorization` ([header xác thực](auth-va-header.md)).
4. Bật trạng thái đang tải, rồi gọi Firebase Auth **`createUserWithEmailAndPassword(email.trim(), password)`** qua plugin native (pigeon `FirebaseAuthHostApi.createUserWithEmailAndPassword`). Không đi qua Dio nên logger HTTP của repo không thấy bước này. Ở tầng mạng, Firebase SDK gọi Identity Toolkit `accounts:signUp` [Suy luận: hành vi chuẩn của Firebase].
5. Có `UserCredential.user` thì gọi **`user.sendEmailVerification()`** (pigeon `FirebaseAuthUserHostApi.sendEmailVerification`; ở tầng mạng là `accounts:sendOobCode` với `requestType: VERIFY_EMAIL` [Suy luận]).
6. Tắt trạng thái tải và mở hộp thoại **"Một email xác thực đã được gửi tới {email}. Vui lòng kiểm tra hộp thư."**. Nút trong hộp thoại gọi `Navigator.pop` hai lần: đóng hộp thoại và đóng màn đăng ký, về lại màn đăng nhập. App **không** tự đăng nhập sau khi đăng ký.

`createUserWithEmailAndPassword` thành công thì Firebase SDK coi như đã đăng nhập người dùng mới trên máy, nhưng app không gọi `users/sync` ở bước này; lần đăng nhập sau mới sync.

## Lỗi khi tạo tài khoản

Ngoại lệ của bước 4–5 được bắt lại. App tắt trạng thái tải rồi hiện hộp thoại lỗi, nội dung chọn theo mã `FirebaseAuthException.code`:

| `code` | Key | Câu hiển thị |
|---|---|---|
| `email-already-in-use` | `error_email_in_use` | "Email này đã được sử dụng bởi tài khoản khác." |
| `weak-password` | `error_weak_password` | "Mật khẩu quá yếu (cần ít nhất 6 ký tự)." |
| `operation-not-allowed` | `error_operation_not_allowed` | "Tính năng đăng ký bằng email đang bị tắt." |
| mã khác | `unknown_error` | "Đã xảy ra lỗi không xác định." |

Nhánh so mã có thêm một phép so sánh (khoảng `0xad624c`) chưa phân giải chắc được chuỗi; theo vị trí trong pool nhiều khả năng là `user-not-found` → `error_user_not_found`. [Chưa xác minh]

## Sau khi đăng ký: xác thực email rồi đăng nhập

Đăng nhập email nằm ở `AuthController.login` (`ola_flutter_features_login_user_provider.dart`):

1. `signInWithEmailAndPassword(email, password)`.
2. `user.reload()`, rồi đọc `currentUser.emailVerified`.
3. Chưa xác thực: ném **`EmailNotVerifiedException`**, không lưu phiên, không gọi `users/sync`. AOT **không** có nút "gửi lại email xác thực": `sendEmailVerification` chỉ được gọi trong màn đăng ký.
4. Đã xác thực: lấy ID token, lưu phiên (`StorageService.saveUserSession`), rồi `fetchAndSyncUser`, tức `POST /napi/users/sync` với `{os:"android", deviceId, ver, displayName, photoURL}` ([usersSync](endpoints/usersSync.md)).

Lỗi đăng nhập email được `AuthController.mapFirebaseError` đổi thành câu hiển thị:

| `code` | Câu hiển thị |
|---|---|
| `wrong-password`, `invalid-credential` | "Mật khẩu không đúng" |
| `user-not-found` | "Không tìm thấy tài khoản" |
| `invalid-email` | "Địa chỉ email không hợp lệ." |
| `too-many-requests` | "Quá nhiều yêu cầu. Vui lòng thử lại sau" |
| mã khác | `error_default` (kèm `code`) |

Client Node của repo cũng chặn bước sync khi email chưa xác thực ([nodejs-login.md](nodejs-login.md)), cùng hành vi với app.

## Quên mật khẩu

Màn "Quên mật khẩu?" (`ForgotPasswordScreen`) mở từ link "Quên mật khẩu ?" của màn đăng nhập:

1. Một ô email, cùng regex `^[^@]+@[^@]+\.[^@]+` như màn đăng ký. Mô tả: "Nhập email của bạn để nhận liên kết đặt lại mật khẩu."
2. Bấm gửi: `FormState.validate()` → Firebase **`sendPasswordResetEmail(email.trim())`** (ở tầng mạng là `accounts:sendOobCode` với `requestType: PASSWORD_RESET` [Suy luận]).
3. Thành công: snackbar "Đã gửi link khôi phục! Vui lòng kiểm tra email." rồi đóng màn.

Luồng này **không** gọi backend Ola. Đổi mật khẩu diễn ra trên trang của Firebase qua link trong mail.

## Làm bằng Node.js / Firebase JS SDK

Client trong `scripts/nodejs` **chưa** có lệnh đăng ký. Nếu cần làm, các bước tương ứng là (chưa chạy thử; bước 2 tạo tài khoản thật):

```ts
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { checkEmail } from './src/endpoints/index.ts';

// 1. checkEmail chạy trước khi có tài khoản: request ký nhưng không có Bearer.
//    OlaClient hiện chỉ gọi được sau khi đăng nhập, nên cần một request ký không token.
// 2. Tạo tài khoản Firebase và gửi mail xác thực:
const auth = getAuth(initializeApp(firebaseConfig));
const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
await sendEmailVerification(user);
// 3. Người dùng bấm link trong mail, sau đó mới đăng nhập như bình thường (OlaClient.login → users/sync).

// Quên mật khẩu:
await sendPasswordResetEmail(auth, email.trim());
```

## Bằng chứng

| Nội dung | Vị trí |
|---|---|
| Hàm gửi đăng ký | `ola_flutter_features_login_register_screen.dart`: `RegisterScreenState._addUser` (`0xad5e84`); `validate` `0xad5ee0`; kiểm 2 checkbox (field `0x2f`, `0x33`) `0xad5ef4`–`0xad5f08`; `checkEmail` `0xad5fd4`; `createUserWithEmailAndPassword` `0xad60b8`; `sendEmailVerification` `0xad60e8`; `showDialog` `0xad6174`; bắt lỗi và so mã `0xad61c4`–`0xad62c8` |
| Validator mật khẩu ≥ 6 | `RegisterScreenState_anon_closure_15`, `cmp x1, #6` tại `0xad74c8` |
| `checkEmail.php` và `valid` | `ola_flutter_features_login_check_email_provider.dart`: `CheckEmailProvider.checkEmail` (`0xad6c00`), path `0xad6ca0`, `DioMixin.post` `0xad6cb0`, đọc key `valid` `0xad6cf8`, ép kiểu `bool` (CID `0x3f`) |
| Đăng nhập email và `emailVerified` | `ola_flutter_features_login_user_provider.dart`: `AuthController_anon_closure_4`, `emailVerified` `0xad3e98`, `EmailNotVerifiedException` `0xad3fec`; `mapFirebaseError` `0x7b0540`; `fetchAndSyncUser` `0x7b069c` |
| Quên mật khẩu | `ola_flutter_features_login_forgot_password_screen.dart`: `resetPassword` `0xb5a090`, `sendPasswordResetEmail` `0xb5a160` |
| Chuỗi | `text/pp.txt` `pp+0x23f70`–`0x242e8`; `assets/translations/vi.json` |

## Giới hạn

- Chưa bắt runtime: chưa thấy response thật của `checkEmail.php` (ngoài key `valid`), chưa biết `valid:false` ứng với những trường hợp nào.
- Không tạo tài khoản thử. Muốn kiểm chứng: dùng một email test, chạy [logger Frida](../04-runtime-api-capture.md#2-cách-chạy-lại), rồi đi hết màn đăng ký. Tài khoản tạo ra là tài khoản thật trên Firebase/Ola.
- Chưa xem đăng ký bằng Google/Apple: hai nút đó nằm ở màn đăng nhập và đi thẳng qua `users/sync` ([luồng đăng nhập](luong-dang-nhap-khoi-dong.md)).
