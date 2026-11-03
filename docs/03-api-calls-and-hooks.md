# 03 — API calls, AOT mapping và hook runtime

## Kết luận nhanh

- App `com.olaachat` là Flutter/Dart AOT. HTTP được gọi từ Dart qua `dio`, không phải một Node.js client chạy trong APK.
- Base URL quan sát được trong snapshot: `https://sgdev.vip/`.
- Có hai nhóm endpoint:
  - `faApi2/*.php`: API legacy PHP-style; snapshot chứa 63 path.
  - `napi/...`: namespace API mới; snapshot chứa 27 path. Tên `/napi` **không đủ** để chứng minh backend được viết bằng Node.js.
- Socket.IO dùng `https://sgdev.vip:3001`; game Caro dùng `https://sgdev.vip:5000/caro`.
- **Cập nhật 2026-11-03:** đã bắt được plaintext request (method, URL, body, header) và frame Socket.IO bằng hook tầng Dart — xem [04-runtime-api-capture.md](04-runtime-api-capture.md). Phần dưới đây giữ nguyên làm lịch sử phân tích tĩnh.

> **Tài liệu API đã tách sang [api/](api/README.md).** Các bảng endpoint, luồng đăng nhập/chat/phòng, giao thức Socket.IO và phần bảo mật giờ nằm trong thư mục đó. Trang này giữ lại phần **phân tích tĩnh** (cách suy ra endpoint từ AOT, hook Frida thế hệ đầu, giới hạn của nó).
- Hook Frida đã attach/spawn được process `Ola` trên serial `55UKEATGRWJRLNVC`. Vòng hook runtime sạch đã quan sát DNS `sgdev.vip`, kết nối TCP `139.59.246.95:443` và Socket.IO `139.59.246.95:3001`. Hook `SSL_write` của `libssl.so` chỉ thấy WebView/ads; đường HTTP của Flutter dùng BoringSSL tích hợp nên chưa thu được plaintext API body. Payload API dưới đây vì vậy vẫn là mapping tĩnh từ AOT.

Evidence tĩnh chính: nhận diện Flutter `ev_a52580966c6f878f8bd333cfed08021c22f1df20984d48f0ac0bb94a3fd5be7`, AOT dossier `ev_ea70b6a968cd160d8205ad531e75cdc7182b0c85ca02413772d0daa6bbf42cfc`. Evidence runtime chính: DNS/socket `ev_6fd9978eafa5c256861b9f2121c18300a21ea0c5eef4f338a3f77e2605bd6d17`, attach/session `ev_03b2adc80c48eb18a321169cac1c77f702eb189cfb2b3a310cf9fc49b9b5996d`. Các evidence này chứng minh đích kết nối, không chứng minh body HTTP.

Runtime destination đã thấy:

| Host | TCP | Ý nghĩa |
|---|---:|---|
| `sgdev.vip` → `139.59.246.95` | `443` | HTTPS API/asset, path bị TLS mã hóa ở tầng Flutter |
| `sgdev.vip` → `139.59.246.95` | `3001` | Socket.IO realtime; khớp literal AOT |
| `googleads.g.doubleclick.net` và Google asset hosts | `443` | quảng cáo/WebView, không phải API Ola |

## Bằng chứng và mức tin cậy

| Nhóm | Bằng chứng | Mức |
|---|---|---|
| Base URL, endpoint literals, map keys | `work/dae-aot-20261102/dart/*.dart` | Quan sát tĩnh |
| HTTP method | Lệnh gọi `DioMixin_post/get/put` ngay cạnh endpoint literal | Quan sát tĩnh; chỉ ghi khi thấy rõ |
| API thực sự chạy trong một thao tác cụ thể | Chưa có plaintext request trong phiên hook này | Chưa xác định |
| Backend PHP/Node.js | Suy ra từ path/kiểu API, không có server source/banner | Không thể khẳng định |

Không đưa token, cookie, private key, access key hoặc giá trị credential vào tài liệu. Khi replay, phải dùng credential của chính phiên thử nghiệm và giữ chúng ngoài git/log.

## Luồng khởi động đã xác nhận

`AppInitNotifier_loadAllInitData()` chạy song song các hàm `loadAppConfig`, `checkUV2`, `getCoins`, `getNoti`.

| Endpoint | Method | Body key thấy trong AOT | Ghi chú |
|---|---|---|---|
| `/faApi2/check_update_app.php` | POST | `uid` | Đọc HTTP 200, parse `AppConfigModel`, so sánh version cài đặt |
| `/faApi2/checkUV2.php` | POST | `uid` | Gọi trong init |
| `/faApi2/getCoins.php` | POST | `uid` | Response field `level` được đọc |
| `/faApi2/getNotiCountLove.php` | POST | `uid` | Response field `countL` được đọc |
| `/faApi2/getNotificationsCount.php` | POST | `uid` | Badge notification |
| `/faApi2/getContactV3.php` | POST | `uid` | Contact list |
| `/faApi2/getMessageByRoom.php` | POST | `roomID` | Response field `data`; có nhánh `incognito` trước khi gọi |

`uid` là tên key quan sát được; giá trị thật được lấy từ state đăng nhập và không được ghi lại.

## Endpoint mới (`/napi`)

Các path sau xuất hiện trực tiếp trong AOT. Chúng cho thấy API surface, không đảm bảo tất cả đều được gọi trong phiên hiện tại.

| Path | Method/shape quan sát được | Key/ý nghĩa quan sát được |
|---|---|---|
| `/napi/users/update` | PUT | `name`, `birth_year`, `gender`, `location`, `job`, `introduceText` |
| `/napi/users/nearby` | GET | query/body có `gender`, `page` |
| `/napi/users/addViewProfile` | POST | map được tạo trước khi gọi; có state `viewed_ids` |
| `/napi/users/getViewProfile` | GET/POST chưa phân biệt chắc | profile view |
| `/napi/users/sync` | method chưa xác định chắc | đồng bộ user |
| `/napi/users/updateLastSeen` | method chưa xác định chắc | heartbeat/last-seen |
| `/napi/users/unread-views` | method chưa xác định chắc | unread profile views |
| `/napi/users/notifications/` | method chưa xác định chắc | notification resource |
| `/napi/post/upload-post` | POST, multipart/json tùy nhánh | tạo post |
| `/napi/post/uploadChat` | POST, upload | upload media chat |
| `/napi/post/delR2` | POST | xóa media/post resource |
| `/napi/post/stories` | POST | tạo story |
| `/napi/post/stories/` | resource có `:id` | đọc/cập nhật/xóa story; method cần hook thêm |
| `/napi/post/stories/feed` | GET | story feed |
| `/napi/post/stories/me` | GET | story của user hiện tại |
| `/napi/post/` | resource theo post id | post detail/update |
| `/napi/post/:commentId/like` | POST | like comment |
| `/napi/general/getTimes` | method chưa xác định chắc | server time |
| `/napi/general/send-notification` | POST | gửi notification |
| `/napi/reward/checkReward` | method chưa xác định chắc | kiểm tra reward |
| `/napi/caro/ai/start` | POST | `difficulty`, `humanFirst` |
| `/napi/caro/ai/finish` | POST | kết thúc ván AI |
| `/napi/caro/me` | method chưa xác định chắc | thống kê Caro cá nhân |
| `/napi/caro/leaderboard` | GET/POST chưa phân biệt chắc | bảng xếp hạng |
| `/napi/caro/online/me` | method chưa xác định chắc | thống kê online |
| `/napi/caro/online/leaderboard` | GET/POST chưa phân biệt chắc | leaderboard online |
| `/napi/minigame/` | resource động | điểm/minigame; cần map thêm id |

## Endpoint legacy đầy đủ

Danh sách 63 path được giữ nguyên trong [work/php_endpoints.txt](../work/php_endpoints.txt). Tất cả đều nằm dưới `/faApi2/`; nhiều call có dạng `DioMixin_post()` và map JSON. Một số nhóm chính:

- Account/profile: `getUserInfoV7.php`, `updateUserInfo.php`, `checkEmail.php`.
- Contact/chat/room: `getContactV3.php`, `getMessageByRoom.php`, `apiAddMessageRoom2.php`, `addLastMessage5.php`, `addUserToRoom.php`.
- Feed/post/story: `getFeedNoiBatV4.php`, `getExplore3.php`, `apiAddPostV9.php`, `updatePost.php`, `upStory.php`, `upLoadImage2.php`.
- Match/follow/block: `getMatchV2.php`, `addMatchV2.php`, `apiAddFollow.php`, `getBlockV3.php`, `addBlockV2.php`.
- Coin/VIP/notification: `getCoins.php`, `addCoins3.php`, `getOrderHistory.php`, `getNotificationsV5.php`, `sendGift.php`.

Không nên suy ra tham số chỉ từ tên file. Với endpoint chưa có map literal rõ ràng, cần hook request builder hoặc xem pseudocode quanh literal đó.

## Cách gọi an toàn để kiểm tra

Ví dụ hình dạng request (không phải credential thật):

```bash
curl 'https://sgdev.vip/faApi2/getCoins.php' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data '{"uid":"<UID_CUA_PHIEN_THU>"}'
```

```bash
curl -X PUT 'https://sgdev.vip/napi/users/update' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  --data '{"name":"<name>","birth_year":1990,"gender":"<gender>","location":"<location>","job":"<job>","introduceText":"<text>"}'
```

Trước khi gọi endpoint ghi dữ liệu (`update`, `add`, `send`, `upload`, `delete`), nên dùng test account, chụp request bằng hook trước, và không replay request có tác dụng phụ nếu chưa xác định body.

## Hook Frida được dùng

1. Attach vào process đang chạy:

```text
device: 55UKEATGRWJRLNVC
process: Ola (com.olaachat), PID 23254
```

2. Hook `connect()` để lấy IP/port, lọc trùng endpoint; không hook `write()` toàn cục vì Flutter/BoringSSL tạo nhiều eventfd/internal writes.
3. Hook `SSL_write`/`SSL_read` có thể không thấy plaintext vì Flutter dùng BoringSSL tích hợp trong `libflutter.so`; việc không thấy symbol không chứng minh không có TLS.
4. Kết thúc bằng unload script và detach session, tránh để hook ảnh hưởng app.

Muốn lấy body plaintext ở vòng tiếp theo, nên hook ở tầng Dart/Dio request builder hoặc native BoringSSL write buffer có giới hạn, chỉ log host/path và redact `Authorization`, cookie, token, password.

## PHP hay Node.js?

Kết luận hiện tại: **không thể nói “API v2 chạy bằng Node.js” chỉ vì có `/napi` hoặc chữ `v2` trong tên file**.

- `faApi2/*.php` là dấu hiệu rất mạnh của lớp API legacy PHP-style.
- `/napi/...` là namespace mới và có các route REST-like (`PUT /napi/users/update`), nhưng đây chỉ là convention URL; backend có thể là Node.js, PHP framework, Go, hoặc reverse proxy.
- Muốn xác nhận backend cần một trong: response header/banner server, tài liệu server, log/proxy phía server, hoặc quyền truy cập source/deployment. APK và hook client chỉ xác nhận host/path/method/body.

## Tái lập phân tích

```powershell
dae info olaachat/lib/libapp.so
dae export olaachat/lib/libapp.so work/dae-aot-20261102 --app --decompile
rg -n 'faApi2/|napi/|sgdev.vip:3001|sgdev.vip:5000' work/dae-aot-20261102/dart
```

Các pseudocode tham chiếu chính: `ola_flutter_features_config_init_provider.dart`, `ola_flutter_core_network_api_client.dart`, `ola_flutter_features_profile_sub_edit_provider.dart`, `ola_flutter_features_nearby_nearby_provider.dart`, `ola_flutter_features_caro_caro_api.dart`.

