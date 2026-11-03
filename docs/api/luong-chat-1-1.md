# Luồng chat 1-1

## Mở cuộc trò chuyện

Tab Tin nhắn → chạm vào hội thoại:

1. Socket mới: `wss://sgdev.vip:3001/socket.io/?key=***&roomNo=<peer_uid>&EIO=3&transport=websocket`. Kết nối cũ bị đóng (`DISCONNECT`).
2. `POST /faApi2/getUserInfoForChatV2.php` `{"id":"<peer_uid>"}`
3. `SIO-OUT add user` `{"username":"<uid>","roomNo":"<peer_uid>"}`

Trong lần mở hội thoại đã bắt, không thấy request tải lịch sử riêng. `getLastMessage2.php` lấy danh sách hội thoại; app có dữ liệu tin nhắn local, nên không thể kết luận API này trả toàn bộ lịch sử. [Phòng chat](luong-phong-chat.md) có request `getMessageByRoom.php` trong capture.

## Đang gõ

`SIO-OUT typing` / `SIO-OUT stop typing` — không có payload.

## Gửi tin nhắn

Đã gửi thử 1 tin `"hi"`. Luồng gồm **3 request**, theo đúng thứ tự:

### 1. Socket.IO emit

`SIO-OUT new message`:

```json
{"mess":"hi","photoURL2":"","displayName":"<tên>","photoURL":"<avatar>","userID":"<uid>",
 "send":true,"read":false,"messageID":"<ms_timestamp><uid>","isSticker":null,
 "replyID":"","replyText":"","isVip":false,"isImage":0,"isGift":0,"isAudio":0,
 "fcmTokenNguoiNhan":"<FCM token người nhận>"}
```

`messageID` = timestamp mili-giây + uid người gửi (client tự sinh, server không cấp).

### 2. Client yêu cầu backend gửi push

`POST /napi/general/send-notification`:

```json
{
  "token": "<FCM token người nhận>",
  "title": "<tên người gửi>",
  "body": "hi",
  "data": {
    "action": "chat", "photo": "", "messageID": "<messageID>",
    "isSticker": null, "isImage": 0, "isGift": 0, "isAudio": 0,
    "replyText": "", "replyID": "",
    "fcmToken": "<FCM token thiết bị người gửi>",
    "user": {"uid": "<uid>", "photoURL": "<avatar>", "displayName": "<tên người gửi>"}
  }
}
```

Client gọi API với token của người nhận để backend gửi push. `data.fcmToken` là token thiết bị người gửi theo `_cachedMyDeviceToken` trong ChatProvider AOT. Xem [bao-mat-va-luu-y.md](bao-mat-va-luu-y.md) mục 1.

### 3. Lưu tin cuối qua HTTP

`POST /faApi2/addLastMessage5.php`:

```json
{"fcmToken":"***","image":"","timestamp":"<ms>","id":"<messageID>","content":"hi",
 "uid":"<uid>","userID":"<peer_uid>","isSticker":null,"replyID":"","replyText":""}
```

`fcmToken` trong body này là token thiết bị người gửi. Endpoint cập nhật nội dung tin cuối của hội thoại để hiển thị ở danh sách chat. Tin nhắn đi **2 đường** (socket + HTTP) đều do client điều khiển.

## Nhận tin về

`SIO-IN new message` `{"username":…, "message":{…}}` với cùng shape object mà người gửi emit.

## Tóm tắt endpoint

| Method | Path | Vai trò |
|---|---|---|
| POST | `/faApi2/getUserInfoForChatV2.php` | Lấy info người nhận khi mở chat |
| POST | `/napi/general/send-notification` | Yêu cầu backend gửi push cho người nhận |
| POST | `/faApi2/addLastMessage5.php` | Lưu tin cuối hội thoại |

Xem [socket-io.md](socket-io.md) cho bảng event đầy đủ.
