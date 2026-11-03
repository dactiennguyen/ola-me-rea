# faApi2/inserNotiV2.php

Chèn một **thông báo** cho người nhận (`uid`): có người thả tim/bình luận/like bình luận/tặng quà/theo dõi/kết bạn/match/nhắc nạp xu... Được gọi rải rác khắp app (feed, bình luận, chat, hồ sơ, match, IAP). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/inserNotiV2.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Hợp đồng chung

Mọi call-site đều gửi tối thiểu **`actionUid`** (người gây ra thông báo = tôi) và **`uid`** (người **nhận** thông báo). Kèm theo là một token **loại thông báo** và các field ngữ cảnh tùy loại.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `actionUid` | string | UID người thực hiện hành động = tài khoản đăng nhập (mặc định `<uid>`) | `[Suy luận/AOT]` (mọi call-site) |
| `uid` | string | UID người **nhận** thông báo (bắt buộc, khác với tôi) | `[Suy luận/AOT]` (mọi call-site) |
| `postID` | string \| number | Bài viết liên quan (thả tim/bình luận/nhắc nạp) | `[Suy luận/AOT]` |
| `commentId` | string \| number | Bình luận liên quan (like bình luận) | `[Suy luận/AOT]` |
| `content` | string | Nội dung bình luận kèm theo | `[Suy luận/AOT]` |
| `stickerURL` | string | Sticker kèm bình luận | `[Suy luận/AOT]` |
| `displayName` | string | Tên hiển thị (biến thể follow/kết bạn) | `[Suy luận/AOT]` |

> **Phân tích:** các token in hoa (`GIFT`, `MATCH`, `FRIEND`, `FOLLOW`, `LIKE_COMMENT`, `TOPUPXU`, `REMIND`, `FOLLOWED_ONLY`, `FRIENDS_NOW`, `REQUEST_MOFIFY_MESSAGE`, `icReact`, `mess`, `action`) do decompiler AOT nhặt lên — **chưa xác minh** là *giá trị của một field `type`* hay là *field cờ riêng* trong body. Client gói chúng qua `options.type` (loại) và `options.extra` (cờ/field còn lại). Xếp vào `[Suy luận]` cho tới khi bắt được body thật.

### Các biến thể theo call-site

| Loại thông báo | Token / field kèm | Nơi gọi (AOT) |
|---|---|---|
| Thả tim/react bài | `icReact`, `postID` | `core_db_interaction_provider.dart:989` |
| Tặng quà trong chat | `GIFT` | `chat_provider.dart:4871` |
| Bình luận bài | `postID` | `comment_provider.dart:1475` |
| Bình luận kèm sticker | `content`, `postID`, `stickerURL` | `comment_provider.dart:2182` |
| Like một bình luận | `commentId`, `LIKE_COMMENT`, `postID` | `comment_provider.dart:3132` |
| Theo dõi / kết bạn | `action`, `FOLLOWED_ONLY`, `FRIENDS_NOW`, `FRIEND` | `feed_sub_follow_provider.dart:1415` |
| Theo dõi + follow | `FOLLOWED_ONLY`, `FRIENDS_NOW`, `FRIEND`, `FOLLOW` | `feed_sub_follow_provider.dart:1445` |
| Nạp xu | `postID`, `TOPUPXU` | `iap_AddVipNotifier.dart:359` |
| Nhắc nhở (remind) | `postID`, `REMIND` | `iap_AddVipNotifier.dart:1261` |
| Match | `MATCH` | `match_provider.dart:1742` |
| Tặng quà ở hồ sơ | `GIFT` | `profile_provider.dart:2575` |
| Kết bạn ở hồ sơ | `action`, `FOLLOWED_ONLY`, `FRIENDS_NOW`, `FRIEND` | `profile_provider.dart:3428` |
| Kết bạn kèm lời nhắn | `FRIEND`, `mess`, `REQUEST_MOFIFY_MESSAGE`, `action`, `FRIENDS_NOW`, `displayName`, `FOLLOW` | `profile_provider.dart:3495` |

Ví dụ body (đã redact) — tặng quà cho một người:

```json
{ "actionUid": "<uid>", "uid": "<uid-người-nhận>", "type": "GIFT" }
```

Bình luận kèm sticker:

```json
{ "actionUid": "<uid>", "uid": "<uid-người-nhận>", "postID": 55123, "content": "đẹp quá", "stickerURL": "https://..." }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts inserNotiV2 --uid <uid-người-nhận> --type GIFT --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/inserNotiV2.ts`](../../../scripts/nodejs/src/endpoints/inserNotiV2.ts). Thiếu `uid` (người nhận) sẽ báo lỗi trước khi gửi; `extra` không được trùng tên field đã khai báo (không ghi đè được `uid`/`actionUid`/`postID`...).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { inserNotiV2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  // actionUid mặc định = tài khoản đăng nhập; uid là người nhận.
  await ola.call(inserNotiV2, { uid: '<target-uid>', type: 'GIFT' });

  // Biến thể có cờ phụ (icReact, LIKE_COMMENT, action, ...) qua extra:
  await ola.call(inserNotiV2, {
    uid: '<target-uid>', type: 'LIKE_COMMENT',
    postID: 55123, commentId: 9001, extra: { LIKE_COMMENT: 1 },
  });
} finally {
  await ola.close();
}
```

CLI (mỗi field là một cờ: `--uid`, `--actionUid`, `--type`, `--postID`, `--commentId`, `--content`, `--stickerURL`, `--displayName`; cờ phụ qua `--extra '<json>'`; thêm `--dry-run` để chỉ in request):

```bash
node scripts/nodejs/ola.ts inserNotiV2 --uid <target-uid> --type GIFT --dry-run
node scripts/nodejs/ola.ts inserNotiV2 --uid <target-uid> --type comment --postID 55123 --content "hello"
node scripts/nodejs/ola.ts inserNotiV2 --uid <target-uid> --type LIKE_COMMENT --postID 55123 --commentId 9001 --extra '{"LIKE_COMMENT":1}' --dry-run
```

## ⚠️ Tác dụng phụ

**Mutate** — tạo một thông báo đẩy tới **người dùng khác** (họ nhận được tim/quà/bình luận giả...). Đừng gọi tùy tiện: dễ bị coi là spam/giả mạo tương tác.

## Bằng chứng

- `work/api_inventory.csv:52–64` — 13 call-site `faApi2/inserNotiV2.php`, union keys `actionUid;uid` + token loại + field ngữ cảnh.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
- Liên quan: [generalSendNotification.md](generalSendNotification.md) (đẩy FCM), [getNotificationsV5.md](getNotificationsV5.md) / [usersNotifications.md](usersNotifications.md) (đọc danh sách).
