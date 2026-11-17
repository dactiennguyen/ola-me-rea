# Ola Session Exporter (Vector)

Ứng dụng Android Java thử nghiệm cho Ola `com.olaachat` 27.7.8 (user Android hiện tại).
Module Vector/LSPosed đọc phiên Firebase đã đăng nhập trong tiến trình Ola; không cần
mật khẩu Google và không đọc/giải mã trực tiếp file storage của Ola.

1. Cài APK debug, bật `Ola Session Exporter` trong Vector và chỉ chọn phạm vi `com.olaachat` của đúng user Android.
2. Mở Ola và đăng nhập Google một lần.
3. Mở Exporter → **Lấy phiên Google**. Lần đầu chấp thuận root để app có thể tự quay lại sau khi mở Ola.
4. Khi đã hiện JSON, bấm **Copy JSON**. Nội dung chứa refresh token; ai có nó có thể sử dụng phiên của bạn.
   Chỉ dán vào thiết bị tin cậy, không đưa vào Git, log hoặc gửi công khai.

Nếu từ chối root, thao tác lấy phiên vẫn chạy nhưng có thể phải quay lại Exporter bằng tay.
Nếu Ola chưa đăng nhập, hãy đăng nhập rồi trở lại Exporter và bấm lấy lại. Nếu không thấy module,
kiểm tra Vector scope và khởi động lại Ola. JSON giữ trong bộ nhớ app/clipboard, không tự ghi file;
người dùng đã chọn hiển thị nội dung trên màn hình.

Định dạng `ola-google-session` là bản thử nghiệm. Ứng dụng Desktop trong repo chưa có tính năng nhập
JSON này; email có thể rỗng tùy tài khoản. Chưa xác nhận tương thích Ola phiên bản khác 27.7.8.

Build bằng JDK 17+ và Android SDK 35, Gradle 8.10.2:

```sh
gradle :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. Thư mục `stub` chỉ là giao diện compile-only
của Xposed; Vector cung cấp implementation khi nạp module.
