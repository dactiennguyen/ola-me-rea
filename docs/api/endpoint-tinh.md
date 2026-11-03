# Inventory endpoint — phân tích tĩnh từ AOT

Các path dưới đây xuất hiện trực tiếp trong AOT (`work/dae-aot-20261102/dart/*.dart`). Chúng cho thấy **API surface**, không đảm bảo tất cả đều được gọi trong phiên hiện tại. Chỗ nào runtime đã xác nhận khác đi thì ghi rõ.

Xem [endpoint-runtime.md](endpoint-runtime.md) cho các endpoint đã bắt được khi chạy thật.

## Namespace `/napi` (27 path)

| Path | Method/shape quan sát được | Key/ý nghĩa | Runtime xác nhận |
|---|---|---|---|
| `/napi/users/update` | PUT | `name`, `birth_year`, `gender`, `location`, `job`, `introduceText` | chưa gọi |
| `/napi/users/nearby` | GET | query/body có `gender`, `page` | chưa gọi |
| `/napi/users/addViewProfile` | POST | map tạo trước khi gọi; state `viewed_ids` | POST |
| `/napi/users/getViewProfile` | GET/POST chưa phân biệt chắc | profile view | chưa gọi |
| `/napi/users/sync` | chưa xác định chắc | đồng bộ user | **POST** |
| `/napi/users/updateLastSeen` | chưa xác định chắc | heartbeat/last-seen | **POST** |
| `/napi/users/unread-views` | chưa xác định chắc | unread profile views | **GET** |
| `/napi/users/notifications/` | chưa xác định chắc | notification resource | **GET** `/{uid}` |
| `/napi/post/upload-post` | POST, multipart/json tùy nhánh | tạo post | chưa gọi |
| `/napi/post/uploadChat` | POST, upload | upload media chat | chưa gọi |
| `/napi/post/delR2` | POST | xóa media/post resource | chưa gọi |
| `/napi/post/stories` | POST | tạo story | chưa gọi |
| `/napi/post/stories/` | resource có `:id` | đọc/cập nhật/xóa story | chưa gọi |
| `/napi/post/stories/feed` | GET | story feed | **GET** |
| `/napi/post/stories/me` | GET | story của user hiện tại | chưa gọi |
| `/napi/post/` | resource theo post id | post detail/update | **POST** `/{postId}/comments` |
| `/napi/post/:commentId/like` | POST | like comment | chưa gọi |
| `/napi/general/getTimes` | chưa xác định chắc | server time | **GET** |
| `/napi/general/send-notification` | POST | gửi notification | **POST** |
| `/napi/reward/checkReward` | chưa xác định chắc | kiểm tra reward | chưa gọi |
| `/napi/caro/ai/start` | POST | `difficulty`, `humanFirst` | chưa gọi |
| `/napi/caro/ai/finish` | POST | kết thúc ván AI | chưa gọi |
| `/napi/caro/me` | chưa xác định chắc | thống kê Caro cá nhân | **GET** |
| `/napi/caro/leaderboard` | GET/POST chưa phân biệt chắc | bảng xếp hạng | **GET** |
| `/napi/caro/online/me` | chưa xác định chắc | thống kê online | chưa gọi |
| `/napi/caro/online/leaderboard` | GET/POST chưa phân biệt chắc | leaderboard online | chưa gọi |
| `/napi/minigame/` | resource động | điểm/minigame; cần map thêm id | `/{gameKey}/leaderboard` |

## Namespace `/faApi2` (63 path)

Danh sách đầy đủ giữ nguyên trong [work/php_endpoints.txt](../../work/php_endpoints.txt). Tất cả nằm dưới `/faApi2/`; nhiều call có dạng `DioMixin_post()` và map JSON. Nhóm chính:

| Nhóm | Endpoint |
|---|---|
| Account/profile | `getUserInfoV7.php`, `updateUserInfo.php`, `checkEmail.php` |
| Contact/chat/room | `getContactV3.php`, `getMessageByRoom.php`, `apiAddMessageRoom2.php`, `addLastMessage5.php`, `addUserToRoom.php` |
| Feed/post/story | `getFeedNoiBatV4.php`, `getExplore3.php`, `apiAddPostV9.php`, `updatePost.php`, `upStory.php`, `upLoadImage2.php` |
| Match/follow/block | `getMatchV2.php`, `addMatchV2.php`, `apiAddFollow.php`, `getBlockV3.php`, `addBlockV2.php` |
| Coin/VIP/notification | `getCoins.php`, `addCoins3.php`, `getOrderHistory.php`, `getNotificationsV5.php`, `sendGift.php` |

## Cảnh báo

Không nên suy ra tham số chỉ từ tên file. Với endpoint chưa có map literal rõ ràng trong AOT, cần hook request builder hoặc đọc pseudocode quanh literal đó — cách làm ở [04-runtime-api-capture.md §3](../04-runtime-api-capture.md).

## Tái lập

```powershell
dae info olaachat/lib/libapp.so
dae export olaachat/lib/libapp.so work/dae-aot-20261102 --app --decompile
rg -n 'faApi2/|napi/|sgdev.vip:3001|sgdev.vip:5000' work/dae-aot-20261102/dart
```

Pseudocode tham chiếu chính: `ola_flutter_features_config_init_provider.dart`, `ola_flutter_core_network_api_client.dart`, `ola_flutter_features_profile_sub_edit_provider.dart`, `ola_flutter_features_nearby_nearby_provider.dart`, `ola_flutter_features_caro_caro_api.dart`.
