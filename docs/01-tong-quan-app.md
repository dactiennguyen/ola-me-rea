# 01 — Tổng quan app Ola (olaachat)

> Phạm vi: phân tích tĩnh APK và một phiên quan sát có kiểm soát trên thiết bị root. Plaintext request body chưa thu được; xem [03-api-calls-and-hooks](03-api-calls-and-hooks.md).
> Mỗi kết luận ghi rõ là **[Quan sát]** (thấy trực tiếp trong artifact) hay **[Suy luận]** (đoán từ tên/chuỗi).

## 1. Danh tính artifact

| Mục | Giá trị | Nguồn |
|---|---|---|
| Package | `com.olaachat` | `jadx-out/resources/AndroidManifest.xml` [Quan sát] |
| Tên hiển thị | `Ola` | manifest `android:label` [Quan sát] |
| Version | `27.7.8` (versionCode `405`) | manifest [Quan sát] |
| minSdk / targetSdk | 24 / 36 | manifest [Quan sát] |
| Dạng phát hành | Split APK: `base.apk` + `split_config.arm64_v8a.apk` + `vi` + `xxhdpi` | thư mục `olaachat/apk/` [Quan sát] |
| Framework | **Flutter** (Dart AOT) — code nghiệp vụ nằm trong `lib/arm64-v8a/libapp.so` | REA `identify_flutter_build` [Quan sát] |
| Dart snapshot hash | `1ce86630892e2dca9a8543fdb8ed8e22` | REA evidence `ev_e9601dcf…` [Quan sát] |
| libapp.so SHA-256 | `8ae930722ba2ffe151ae7f57400bb77d1bf4d067139e2db2aac302b554befa7c` | như trên |
| libflutter.so build-id | `19c789d73f23041f9209dc31b7aa2e5f30f7fdff` | như trên |
| Tên project Dart | `ola_flutter` (`package:ola_flutter/...`) | chuỗi trong `libapp.so` [Quan sát] |
| Application class | `com.pairip.application.Application` | manifest [Quan sát] |

**PairIP**: `com.pairip.application.Application` là lớp bảo vệ Google Play gắn vào lúc phát hành (kiểm tra license/toàn vẹn khi app chạy). Nếu cài APK đã sửa hoặc cài ngoài Play, app có thể bị chặn ngay lúc khởi động. [Suy luận dựa trên tên lớp và quyền `CHECK_LICENSE` trong manifest]

## 2. Kiến trúc tổng thể

```
┌──────────────────────── Android (Java/Kotlin, rất mỏng) ────────────────────────┐
│ MainActivity (com.example.ola_flutter)                                          │
│   └─ MethodChannel "samples.flutter.dev/battery"                                │
│        └─ "getBatteryLevel"  ──►  NativeKeyManager.getApiKey()  (JNI)           │
│                                     └─ libnative-lib.so (C++)                   │
└─────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────── Flutter / Dart (libapp.so) ─────────────────────────────┐
│ main.dart → app.dart → SplashScreen → (Login | Home)                            │
│ State: Riverpod (flutter_riverpod)                                              │
│ HTTP: dio + http  →  https://sgdev.vip/faApi2/*.php   (PHP API, cũ)             │
│                   →  https://sgdev.vip/napi/...        (Node API, mới)          │
│ Realtime: socket_io_client → https://sgdev.vip:3001 (chat/call/presence)        │
│                            → https://sgdev.vip:5000/caro (game caro online)     │
│ Call video/voice: flutter_webrtc (libjingle_peerconnection_so.so)               │
│ File/ảnh: minio (S3) + upload qua PHP/Node                                      │
│ Firebase: Auth, Messaging(FCM), Analytics, Crashlytics, Remote Config           │
│ Ads: google_mobile_ads ; IAP: in_app_purchase                                   │
│ eKYC: google_mlkit_face_detection + ekyc.mdcsoftware.com.vn                     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Lớp Java chỉ là vỏ: MainActivity đăng ký **một** MethodChannel tự viết. Toàn bộ logic nghiệp vụ nằm ở Dart. [Quan sát: `jadx-out/sources/com/example/ola_flutter/` chỉ có `MainActivity.java` và `NativeKeyManager.java`]

## 3. App làm gì — các module chức năng

Danh sách file Dart lấy từ đường dẫn `package:ola_flutter/...` còn sót trong `libapp.so` (xem `olaachat/ola_files.txt`, 232 file). Từ đó suy ra các tính năng sau [Suy luận từ tên file + chuỗi UI]:

| Nhóm | Thư mục Dart | Chức năng |
|---|---|---|
| Đăng nhập / tài khoản | `features/login/*` | Splash, login, đăng ký, quên mật khẩu, kiểm tra email; Google Sign-In, Apple Sign-In, Firebase Auth |
| Cấu hình khởi động | `features/config/init_provider.dart`, `init_key.dart`, `storage_service.dart` | Lấy API key từ native, cấu hình app, **kiểm tra cập nhật (OTA, xem doc 03)** |
| Mạng xã hội | `features/feed/*`, `features/create/*`, `features/comment/*`, `features/explore/*` | News feed, đăng bài, comment, like, explore, story (24h) |
| Hẹn hò / ghép đôi | `features/match/*`, `features/nearby/*`, `features/profile/*` | Match, người ở gần (GPS), xem profile, ai đã xem mình |
| Chat 1-1 | `features/chat/*`, `features/message/*`, `core/socket/*` | Chat realtime, tin nhắn thoại, sticker, quà tặng, reply |
| Gọi audio/video | `features/chat/call/*` | WebRTC, màn hình cuộc gọi đến, signaling qua socket |
| Phòng chat nhóm | `features/room/*` | Room list, room chat, quản lý thành viên, block |
| Thanh toán | `features/iap/*` | Nạp xu (coin), mua VIP, level |
| Xác thực khuôn mặt | `features/liveness/*` | Liveness + so khớp mặt (eKYC) |
| Mini game | `features/caro/*`, `features/flappy/*`, `features/sweet/*`, `features/minigame/*` | Caro (AI + online), Flappy, Sweet candy, bảng xếp hạng |
| Tiện ích | `features/utility/*` | Lịch âm, thần số học, xem tuổi, cung hoàng đạo |
| Hình nền | `features/wallpaper/*` | Lấy từ `api.wallpaperscraft.com` |
| Khác | `features/notification`, `violation`, `block`, `setting`, `more/boost` | Thông báo, vi phạm, chặn, cài đặt, boost hồ sơ |

## 4. Thành phần bên thứ ba (package Dart thấy trong libapp.so)

Chạy `python -I scripts/dart_packages.py olaachat/lib/libapp.so` → 124 package. Những package quan trọng:

- **Mạng**: `dio`, `http`, `socket_io_client`, `flutter_webrtc`, `minio`
- **Firebase**: `firebase_core`, `firebase_auth`, `firebase_messaging`, `firebase_analytics`, `firebase_crashlytics`, `firebase_remote_config`
- **Lưu trữ**: `flutter_secure_storage`, `shared_preferences`, `sqflite`, `flutter_cache_manager`
- **Quảng cáo / thanh toán**: `google_mobile_ads`, `in_app_purchase`
- **Thiết bị**: `device_info_plus`, `android_id`, `package_info_plus`, `geolocator`, `camera`, `record`, `permission_handler`
- **Khác**: `google_mlkit_face_detection`, `pro_image_editor`, `lottie`, `easy_localization`, `archive`, `crypto`, `url_launcher`, `webview_flutter`

**Không thấy** `shorebird`, `code_push`, `in_app_update`, hay bất kỳ cơ chế tải code Dart mới nào [Quan sát: tìm chuỗi trong `libapp.so`, không có kết quả]. Doc 03 phân tích phần OTA chi tiết.

## 5. Cấu hình Firebase (`res/values/strings.xml`)

| Key | Giá trị |
|---|---|
| project_id | `olaachat` |
| gcm_defaultSenderId | `211539470356` |
| google_app_id | `1:211539470356:android:54d93ae0ba01751b` |
| firebase_database_url | `https://olaachat.firebaseio.com` |
| google_storage_bucket | `olaachat.appspot.com` |
| default_web_client_id | `211539470356-6qpsdsshh6klat94t7vc5llf9663l1dh.apps.googleusercontent.com` |

## 6. Quyền Android đáng chú ý

`INTERNET`, `ACCESS_FINE/COARSE_LOCATION` (tính năng Nearby), `CAMERA`, `RECORD_AUDIO` (gọi điện, tin nhắn thoại), `POST_NOTIFICATIONS`, `BILLING`, `AD_ID`, `USE_BIOMETRIC`, `FOREGROUND_SERVICE`, `CHECK_LICENSE` (PairIP).

**Không có** `REQUEST_INSTALL_PACKAGES`, nên app không tự cài APK mới được. Điều này ràng buộc cách OTA hoạt động (xem doc 03).

## 7. Cách tái tạo các bước phân tích

1. Giải nén split APK → lấy `lib/arm64-v8a/*.so` vào `olaachat/lib/`.
2. `jadx` decompile `base.apk` → `olaachat/jadx-out/` (70 lỗi decompile nhỏ, không ảnh hưởng phần app).
3. Dump chuỗi `libapp.so` → `olaachat/analysis/libapp.strings.txt`.
4. Lọc `package:ola_flutter/...` → `olaachat/ola_files.txt` (danh sách file nguồn Dart).
5. `scripts/dart_packages.py` → danh sách package.
6. REA `identify_flutter_build` trên `split_config.arm64_v8a.apk` → snapshot hash, build-id.

## 8. Giới hạn

- Dart AOT không thể khôi phục nguyên bản thành source Dart. Có thể dùng `dae-rs` để phục hồi tên library/class/hàm, disassembly và Dart-like pseudocode; kết quả vẫn là mã nâng từ ARM64 và cần giữ các unknowns. Blutter là lựa chọn đối chiếu khác nhưng yêu cầu build Dart VM khớp phiên bản.
- Runtime đã attach được bằng Frida vào process `Ola` trên thiết bị serial `55UKEATGRWJRLNVC`; hook `connect()` chỉ ghi nhận kết nối ở mức socket. Chưa có plaintext HTTP body nên thứ tự gọi và payload thật vẫn là unknown.
