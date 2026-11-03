# napi/post/:commentId/like

Thích / bỏ thích một **bình luận**. `commentId` nằm trong **đường dẫn**, body đi rỗng. [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/napi/post/<commentId>/like`

Đường dẫn động: thay `<commentId>` bằng ID bình luận. Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

Body **rỗng** `{}` — hành động được xác định hoàn toàn qua đường dẫn + tài khoản Bearer.

| phần | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `commentId` (path) | string | ID bình luận cần thích (bắt buộc, không suy ra được từ session) | [Suy luận/AOT] |
| `COMMENT`, `LIKE` | hằng enum | Trong AOT là **hằng enum** (loại đối tượng = COMMENT, hành động = LIKE) dùng để dựng đường dẫn, **không phải** field body | [Suy luận/AOT] |

```text
POST /napi/post/12345/like
body: {}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts postCommentLike --commentId <id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postCommentLike.ts`](../../../scripts/nodejs/src/endpoints/postCommentLike.ts). Thiếu `commentId` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { postCommentLike } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  await ola.call(postCommentLike, { commentId: '12345' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postCommentLike --commentId 12345` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — bật/tắt lượt thích của bạn trên bình luận (có thể phát sinh thông báo tới chủ bình luận, xem `faApi2/inserNotiV2.php` biến thể `LIKE_COMMENT`). Đừng gọi tùy tiện.

## Bằng chứng

- Static: `work/api_inventory.csv:115` — `ola_flutter_features_comment_comment_provider.dart:3065`, keys `COMMENT;LIKE;commentId`.
- Thông báo kèm theo: `work/api_inventory.csv:56` — cùng provider dòng 3132, keys `commentId;actionUid;uid;LIKE_COMMENT;postID` (gửi `inserNotiV2` khi thích bình luận).
- Đối chiếu thích **bài viết** trong [getLikesV2](getLikesV2.md).
