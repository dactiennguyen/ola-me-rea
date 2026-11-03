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

Trang đầu = `1` là **[Suy luận]** (chưa xác minh giá trị khởi đầu trên wire).

```json
{ "page": 1 }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts postComments --postId <id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Phiên 2026-11-03 chỉ ghi nhận request (body `page`), chưa ghi response. Cấu trúc trang bình luận **chưa kiểm chứng**. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postComments.ts`](../../../scripts/nodejs/src/endpoints/postComments.ts). Thiếu `postId` sẽ báo lỗi trước khi gửi; `page` mặc định `1`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { postComments } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const comments = await ola.call(postComments, { postId: '540919', page: 1 });
  // page mặc định 1.
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postComments --postId 540919 [--page <n>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/api_runtime_inventory.csv:31` — `POST napi/post/{postId}/comments`, body `page`, luồng "xem bình luận".
- Static: `work/api_inventory.csv:113` — `ola_flutter_features_comment_comment_provider.dart:691` (base path `napi/post/`).
- Cùng luồng bình luận với [getPostByID](getPostByID.md), [postCommentLike](postCommentLike.md), [updateComment](updateComment.md).
