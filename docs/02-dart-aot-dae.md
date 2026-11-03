# 02 — Điều tra Dart AOT bằng `dae`

## Phạm vi

Phân tích tĩnh `olaachat/lib/libapp.so` của APK Ola. Phần AOT là offline; phần runtime
được ghi riêng trong [03-api-calls-and-hooks](03-api-calls-and-hooks.md).

## Công cụ

Đã cài `dae-rs` phiên bản `0.1.17` (`dae v0.1.17`) bằng Cargo. Đây là bộ phân
tích Dart AOT chạy offline, tự nhận diện snapshot hash và không cần chạy Dart VM
của ứng dụng đích.

Lệnh kiểm tra nhanh:

```powershell
dae info olaachat/lib/libapp.so
```

Lệnh xuất kết quả:

```powershell
dae export olaachat/lib/libapp.so work/dae-aot-20261102 --app --decompile
```

Kết quả đầy đủ nằm trong [work/dae-aot-20261102](../work/dae-aot-20261102).

## Nhận diện snapshot

`dae` nhận diện:

| Thuộc tính | Kết quả |
|---|---|
| ABI | ARM64 Android |
| Pointer mode | compressed-pointers |
| Dart profile | `dart/3.10.9` — version-hash match |
| SDK status | `unverified` trong profile của `dae` |
| Snapshot | `vm+iso` |
| Instructions table | 34.755 entries |
| Libraries | 1.778 |
| Functions | 31.246 |
| Classes | 5.411 |
| Strings | 60.503 |
| Warnings | 0 |

`dae` cảnh báo profile `dart/3.10.9` chưa được xác minh đầy đủ trên mọi corpus.
Vì vậy phiên bản này là nhận diện theo snapshot hash, chưa phải bằng chứng phát
hành chính thức từ metadata của app.

## Kết quả xuất app-side

Với `--app --decompile`, tool xuất được:

- 11.929 hàm có tên và địa chỉ;
- 11.062 hàm disassembly/pseudocode;
- 84.044 direct call edges và 9.048 indirect call sites;
- 2.335 class và 1.262 library trong phạm vi app-side;
- 10.106 hàm có control flow được cấu trúc;
- 956 hàm giữ dạng unstructured;
- 0 dòng `unmapped`.

Các file chính:

- [functions.txt](../work/dae-aot-20261102/text/functions.txt): tên hàm, class, library và địa chỉ;
- [classes.txt](../work/dae-aot-20261102/text/classes.txt): class và library URI;
- [libs.txt](../work/dae-aot-20261102/text/libs.txt): danh sách library;
- [call_edges.txt](../work/dae-aot-20261102/call_edges.txt): cạnh gọi trực tiếp/gián tiếp;
- thư mục [dart](../work/dae-aot-20261102/dart): pseudocode theo library;
- thư mục [asm](../work/dae-aot-20261102/asm): disassembly ARM64 có chú thích.

## Những gì đã đọc được từ code app

### Khởi tạo app và OTA

Trong [init_provider pseudocode](../work/dae-aot-20261102/dart/ola_flutter_features_config_init_provider.dart):

- `AppInitNotifier_loadAllInitData()` gọi `loadAppConfig`, `checkUV2`, `getCoins`
  và `getNoti` rồi chờ bằng `Future.wait`.
- `AppInitNotifier_loadAppConfig()` tạo request Dio tới
  `faApi2/check_update_app.php`.
- Chỉ xử lý cấu hình khi HTTP status là `200`.
- Kết quả được chuyển qua `AppConfigModel.fromJson`.
- App đọc version cài đặt bằng `PackageInfo.fromPlatform()` và so sánh với dữ
  liệu server.
- Có hai nhánh hiển thị `showOptionalUpdateDialog` và
  `showForceUpdateDialog`.

Điều này xác nhận cơ chế OTA đang quan sát được là **kiểm tra cấu hình/version
từ server và hiển thị dialog**. Đoạn AOT này chưa cho thấy tải hoặc thực thi Dart
code mới.

### Native channel và API key

Trong [init_key pseudocode](../work/dae-aot-20261102/dart/ola_flutter_features_config_init_key.dart):

- Dart gọi `MethodChannel.invokeMethod("getBatteryLevel")` để lấy dữ liệu từ
  native layer.
- Kết quả được giải mã JSON.
- Các trường được đọc gồm `publicKey`, `accessKeyVNG`, `secretAccessVNG`,
  `wasabiKeyID`, `stunSv`, `stunUser`, `stunPass`.
- Sau đó dữ liệu được truyền vào `ApiClient.setKey` và credential MinIO.

Tên trường là quan sát từ snapshot; giá trị bí mật thực tế không được đưa vào
tài liệu này.

### HTTP client

Trong [api_client pseudocode](../work/dae-aot-20261102/dart/ola_flutter_core_network_api_client.dart):

- Base URL quan sát được là `https://sgdev.vip/`.
- Dio được tạo với header JSON (`Content-Type` và `Accept`).
- Có interceptor/closure xử lý request và response.

## Giới hạn

- Pseudocode là kết quả nâng từ ARM64 machine code, không phải source Dart gốc.
- Nhiều biến vẫn là `dynamic`, `mem(...)`, register alias hoặc lời gọi gián tiếp.
- Profile `dart/3.10.9` của `dae` đang được báo `unverified`; cần đối chiếu thêm
  bằng Blutter hoặc SDK profile tương ứng nếu cần độ tin cậy cao hơn.
- Phân tích này không chứng minh hành vi runtime, payload server thực tế, hay việc
  app có tải patch/code ngoài snapshot.
