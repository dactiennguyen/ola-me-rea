# Ví dụ workflow chat A → B

Ví dụ A là tài khoản vừa đăng nhập; B là người nhận do bạn chọn. Chưa chạy
gửi tin Node.js trong bước này. Phần dưới dựa trên capture app 27.7.8;
không phải một client chat hoàn chỉnh đã kiểm chứng hai đầu.

## Các dữ liệu cần có

| Dữ liệu | Nguồn |
|---|---|
| A.uid, tên, avatar | `await OlaClient.login()` → `ola.session.localId` và `ola.profile` |
| Firebase ID token | `ola.session.idToken` (OlaClient tự lấy token mới cho mỗi request), dùng Bearer cho HTTP Ola |
| B.uid | UID trong danh bạ/hội thoại; không dùng ID hiển thị dạng số hay email thay thế |
| B info/token FCM | POST `faApi2/getUserInfoForChatV2.php`, body `{id: B.uid}` |
| Socket query key | Giá trị `key` trong kết nối Socket.IO của app; cần đối chiếu riêng, không mặc định bằng HTTP `key2` |
| timestamp/hash/deviceid/key2 | Cùng cách ký HTTP trong `scripts/nodejs/src/signing.ts`, tạo timestamp mới cho mỗi request |

## Trình tự theo capture app

1. Login A và sync hồ sơ. Có thể lấy danh bạ qua `getContactV3.php` (`{uid:A.uid}`)
   hoặc hội thoại qua `getLastMessage2.php` (`{roomID:A.uid}`) để chọn B.
2. Giữ kết nối kênh cá nhân `roomNo=A.uid` để nhận event. Khi mở màn chat B,
   capture thấy app tạo thêm socket với `roomNo=B.uid`.
3. Lấy `getUserInfoForChatV2.php` cho B; sau khi socket chat connect, emit
   `add user` với `{username:A.uid, roomNo:B.uid}`.
4. Khi gửi text, tạo `messageID = String(Date.now()) + A.uid`, rồi emit
   `new message` trên socket màn chat B.
5. App gọi POST `napi/general/send-notification` để nhờ backend gửi push.
6. App gọi POST `faApi2/addLastMessage5.php` để cập nhật tin cuối hội thoại.
7. Nhận `new message`, đọc wrapper `{username, message:{...}}` và chống
   hiển thị trùng theo messageID. Đây là đề xuất xử lý cho client Node.

Socket connect hoặc emit thành công chưa chứng minh B nhận được tin. Cần
kiểm tra thiết bị B/event phản hồi. Capture hiện chưa xác định delivery ACK,
read receipt hay bảo đảm lưu toàn bộ lịch sử; `addLastMessage5` cập nhật tin cuối.
Ba thao tác socket/push/HTTP có thể thành công hoặc lỗi riêng lẻ, không phải
một transaction. Không tự gửi lại toàn bộ chuỗi nếu một bước timeout.

## Kết nối Socket.IO từ Node.js

Capture có `EIO=3`, nên ví dụ dùng client 2.x tương thích. Cài riêng trong thư
mục scripts/nodejs nếu bạn muốn chạy đoạn kết nối này:

```powershell
npm install --prefix scripts/nodejs --no-save --package-lock=false socket.io-client@2.5.0
```

Đoạn sau là ví dụ để ghép vào client của bạn, cần truyền `socketKey` đúng từ
app. Nó chỉ kết nối và đăng ký event; không tự gửi nội dung chat.

```js
import io from 'socket.io-client';

function connectChat({ myUid, peerUid, socketKey, onMessage }) {
  function makeSocket(roomNo) {
    return io('https://sgdev.vip:3001', {
      path: '/socket.io/', transports: ['websocket'],
      query: { key: socketKey, roomNo },
      forceNew: true, autoConnect: false,
      reconnection: false, timeout: 15000, rejectUnauthorized: true,
    });
  }
  const inbox = makeSocket(myUid);
  const chat = makeSocket(peerUid);
  chat.on('connect', () => {
    chat.emit('add user', { username: myUid, roomNo: peerUid });
  });
  for (const socket of [inbox, chat]) {
    socket.on('new message', onMessage);
    socket.on('connect_error', () => console.error('Socket connect failed'));
    socket.on('connect_timeout', () => console.error('Socket connect timed out'));
    socket.connect();
  }
  return { inbox, chat, close() { inbox.disconnect(); chat.disconnect(); } };
}
```

Client thư viện xử lý handshake/ping/pong; không dùng WebSocket thuần để gửi
JSON trực tiếp. Tham khảo [Socket.IO client 2.x](https://socket.io/docs/v2/client-api/).

## Ví dụ payload text

Sau khi B đã được chọn và socket chat đã connect, payload quan sát được có dạng:

```js
const timestamp = Date.now();
const messageID = `${timestamp}${myUid}`;
const message = {
  mess: 'Chào bạn', photoURL2: '', displayName: profile.displayName,
  photoURL: profile.photoURL || '', userID: myUid,
  send: true, read: false, messageID, isSticker: null,
  replyID: '', replyText: '', isVip: Boolean(profile.isVip),
  isImage: 0, isGift: 0, isAudio: 0,
  fcmTokenNguoiNhan: recipientFcmToken,
};
// Thao tác gửi, chỉ gọi khi bạn thực sự muốn gửi cho B:
// chat.emit('new message', message);
```

Push có `token` của B, `title` tên A, `body` nội dung tin, và `data` gồm
`action:"chat"`, messageID, thông tin A, cùng các trường điều hướng của app.
`data.fcmToken` là token thiết bị của A (người gửi), theo `_cachedMyDeviceToken` trong ChatProvider AOT. Các trường data khác gồm `photo`, `isSticker`, `isImage`, `isGift`, `isAudio`, `replyText` và `replyID`. Node không tự có FCM token thiết bị Android.

Body `addLastMessage5.php` quan sát được:

```json
{
  "fcmToken": "<FCM token thiết bị người gửi A>",
  "image": "",
  "timestamp": "<timestamp-ms-cùng-tin>",
  "id": "<messageID>",
  "content": "Chào bạn",
  "uid": "<A.uid>",
  "userID": "<B.uid>",
  "isSticker": null,
  "replyID": "",
  "replyText": ""
}
```

Chi tiết capture: [luồng chat](luong-chat-1-1.md),
[socket events](socket-io.md). Các giá trị UID/token thật không
được đưa vào ví dụ; chưa có B cụ thể để kiểm thử giao nhận.
