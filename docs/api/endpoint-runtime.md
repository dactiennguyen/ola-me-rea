# Inventory endpoint — bắt được khi chạy thật

40 endpoint HTTP chạy thật trong các luồng đã thao tác (27 `faApi2/*.php`, 13 `napi/*`), cộng 1 server Socket.IO `wss://sgdev.vip:3001`.

Host chung `https://sgdev.vip`. Auth = bộ header ở [auth-va-header.md](auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`). Cột "Luồng" = nơi request được bắt trong phiên test. Bản CSV: [work/api_runtime_inventory.csv](../../work/api_runtime_inventory.csv).

| Method | Path | Body keys | Luồng |
|---|---|---|---|
| GET | `/napi/general/getTimes` | – | khởi động (trước login) |
| POST | `/napi/users/sync` | `os, deviceId, ver, displayName, photoURL` | **đăng nhập** |
| POST | `/napi/users/updateLastSeen` | `{}` | khởi động |
| POST | `/faApi2/check_update_app.php` | `uid` (=1) | khởi động |
| POST | `/faApi2/checkUV2.php` | `uid` | khởi động |
| POST | `/faApi2/getCoins.php` | `uid` | khởi động |
| POST | `/faApi2/getLastMessage2.php` | `roomID` (=uid) | khởi động — danh sách hội thoại |
| POST | `/faApi2/getNotificationsCount.php` | `uid` | khởi động |
| POST | `/faApi2/getNotiCountLove.php` | `uid` | khởi động |
| POST | `/faApi2/getContactV3.php` | `uid` | khởi động |
| POST | `/faApi2/updatePost.php` | `action, id, value` | khởi động — lưu FCM token |
| POST | `/faApi2/getUserInfoForChatV2.php` | `id` | **mở chat 1-1** |
| POST | `/napi/general/send-notification` | `token, title, body, data` | **gửi tin 1-1** |
| POST | `/faApi2/addLastMessage5.php` | `fcmToken, image, timestamp, id, content, uid, userID, isSticker, replyID, replyText` | **gửi tin 1-1** |
| POST | `/faApi2/addUserToRoom.php` | `uid, state` | **vào phòng chat** |
| POST | `/faApi2/getMessageByRoom.php` | `roomID` | **tải tin nhắn phòng** |
| POST | `/faApi2/checkBlockChat.php` | `uid` | **vào phòng chat** |
| POST | `/faApi2/apiAddMessageRoom2.php` | `deviceID, mess, name, userID, photoURL2, send, id, isVip, level, roomID, isVerifyAvatar` | **gửi tin phòng** |
| POST | `/faApi2/apiAddToRoomV4.php` | `uid, page, state` | thành viên phòng |
| POST | `/faApi2/getExploreOnlineV6.php` | `uid, os, page, condition, lastSeenPaging` | Khám phá — Online |
| POST | `/faApi2/getExplore3.php` | `uid, os, page, condition` | Khám phá — Đã xác thực |
| POST | `/faApi2/getExploreAvatarV4.php` | `uid, os, page` | Khám phá — Ảnh có mặt |
| POST | `/faApi2/getUserInfoV7.php` | `myUid, targetUid` | xem hồ sơ |
| POST | `/faApi2/shouldLoadFeed.php` | `uid` | xem hồ sơ |
| POST | `/faApi2/getPostByUserV7.php` | `uid, page` | xem hồ sơ |
| POST | `/napi/users/addViewProfile` | `viewed_ids` | ghi lượt xem hồ sơ, gửi theo lô sau khi rời hồ sơ |
| GET | `/napi/users/unread-views` | – | hồ sơ của mình |
| POST | `/faApi2/getFeedNoiBatV4.php` | `uid, page, new` | Blog |
| GET | `/napi/post/stories/feed` | – | Blog |
| POST | `/napi/post/{postId}/comments` | `page` | xem bình luận |
| POST | `/faApi2/getCreatePostInfo2.php` | `uid` | mở màn tạo bài (không đăng) |
| POST | `/faApi2/getMatchV2.php` | `uid, page` | Thích bạn |
| GET | `/napi/users/notifications/{uid}` | – | Thông báo |
| POST | `/faApi2/getBlockV3.php` | `uid` | Danh sách chặn |
| POST | `/faApi2/getOrderHistory.php` | `uid` | Lịch sử giao dịch |
| POST | `/faApi2/getXuHistory2.php` | `uid` | Lịch sử giao dịch |
| GET | `/napi/caro/me` | – | Mini game — Caro |
| GET | `/napi/caro/leaderboard` | – | Mini game — Caro |
| GET | `/napi/minigame/flappy/leaderboard` | – | Mini game — Bay lên |
| GET | `/napi/minigame/sweet/leaderboard` | – | Mini game — Kẹo ngọt |

## So khớp với inventory tĩnh

So với [work/api_inventory.csv](../../work/api_inventory.csv) (135 dòng): **36/40** endpoint runtime đã có sẵn trong phân tích tĩnh.

4 endpoint còn lại là các path động mà phân tích tĩnh chỉ thấy dạng template:

- `napi/post/{postId}/comments`
- `napi/users/notifications/{uid}`
- `napi/minigame/flappy/leaderboard`
- `napi/minigame/sweet/leaderboard` — tức `napi/minigame/{gameKey}/leaderboard` với `gameKey ∈ {flappy, sweet}`

Method của `getExploreOnlineV6.php` và `getExploreAvatarV4.php` (tĩnh ghi `unknown`) đã xác định là **POST**.

## Màn không gọi API

Dữ liệu render local hoàn toàn: danh sách quà tặng, danh sách phòng chat (mã tỉnh), Boost Profile (trước khi kích hoạt), Tiện ích (Xem tuổi, Lịch âm, Cung hoàng đạo, Thần số học), danh sách mini game.

Xem thêm [endpoint-tinh.md](endpoint-tinh.md) cho API surface đầy đủ từ AOT.
