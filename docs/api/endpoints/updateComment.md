# faApi2/updateComment.php

Cập nhật / sửa một **bình luận** theo `id`. Gọi từ màn bình luận của một bài (feed/blog). [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/updateComment.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `id` | string | ID bình luận cần cập nhật (bắt buộc, không suy ra được từ session) | [Suy luận/AOT] |
| *(trường nội dung)* | ? | Chỉ khôi phục được `id` từ AOT; trường nội dung sửa / cờ khác **chưa khôi phục** — truyền thêm qua `extra` khi phát hiện | [Chưa xác minh] |

```json
{ "id": "12345" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts updateComment --id <id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Theo convention `faApi2` response thường có `is_success`. Cấu trúc **chưa kiểm chứng**. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/updateComment.ts`](../../../scripts/nodejs/src/endpoints/updateComment.ts). Thiếu `id` sẽ báo lỗi trước khi gửi. Trường chưa khôi phục truyền qua `extra` (giá trị scalar, gộp vào body); `extra` không được trùng `id`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { updateComment } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  await ola.call(updateComment, { id: '12345' });
  // Khi phát hiện thêm trường (vd nội dung), truyền qua extra:
  await ola.call(updateComment, { id: '12345', extra: { content: 'nội dung mới' } });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts updateComment --id <id> [--extra '{"content":"..."}']` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — thay đổi một bình luận trên server (sửa/đánh dấu). Đừng gọi tùy tiện.

## Bằng chứng

- Static: `work/api_inventory.csv:73` — `ola_flutter_features_comment_comment_provider.dart:2449`, key `id`.
- Cùng provider với [getPostByID](getPostByID.md), [postCommentLike](postCommentLike.md), [postComments](postComments.md) (luồng bình luận).
