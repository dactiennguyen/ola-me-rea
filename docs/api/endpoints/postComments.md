# napi/post/{postId}/comments

Lấy **danh sách bình luận** của một bài (feed/blog), có phân trang. Gọi khi mở màn **"xem bình luận"**. `postId` nằm trong **đường dẫn**, chỉ `page` ở body. [Quan sát] — body thấy trên wire; response chưa bắt.

## Method + path

`POST https://sgdev.vip/napi/post/<postId>/comments`

Đường dẫn động: thay `<postId>` bằng ID bài. Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `postId` (path) | string | ID bài cần lấy bình luận (bắt buộc, không suy ra được từ session) | [Quan sát] luồng "xem bình luận" |
| `page` | integer | Trang phân trang; tăng dần khi cuộn | [Quan sát] body `page` |

Trang đầu = `0`, mỗi trang 10 bình luận. **[Quan sát 2026-11-04]**: bài có 16 bình luận trả 10 ở `page: 0`, 6 ở `page: 1`, 0 ở `page: 2`.

```json
{ "page": 0 }
```

## Response

[Quan sát 2026-11-04] (lưu ý: `success`, không phải `is_success`):

```json
{ "newest_version": "27.7.9", "success": true, "totalComments": 16,
  "data": [{ "id": 1007102, "content": "…", "likeCount": 0, "timePost": "1793781544757",
             "displayName": "…", "photoURL": "https://…", "fcmToken": "…", "uid": "<uid>",
             "isVip": 0, "stickerUrl": "", "isLiked": false }] }
```

`timePost` là ms dạng chuỗi. Đọc bằng `loadComments()` trong [`src/blog.ts`](../../../scripts/nodejs/src/blog.ts).

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postComments.ts`](../../../scripts/nodejs/src/endpoints/postComments.ts). Thiếu `postId` sẽ báo lỗi trước khi gửi; `page` mặc định `1`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { postComments } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const comments = await ola.call(postComments, { postId: '540919', page: 0 });
  // page mặc định 0.
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postComments --postId 540919 [--page <n>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/api_runtime_inventory.csv:31` — `POST napi/post/{postId}/comments`, body `page`, luồng "xem bình luận".
- Static: `work/api_inventory.csv:113` — `ola_flutter_features_comment_comment_provider.dart:691` (base path `napi/post/`).
- Cùng luồng bình luận với [getPostByID](getPostByID.md), [postCommentLike](postCommentLike.md), [updateComment](updateComment.md).
