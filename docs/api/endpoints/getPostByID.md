# faApi2/getPostByID.php

Lấy **một bài đăng** (feed/blog) theo ID. Gọi ở màn **bình luận**: nạp lại bài đang được bình luận để hiển thị đầu trang. [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/getPostByID.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `postID` | string | ID bài đăng cần lấy (bắt buộc, không suy ra được từ session) | [Suy luận/AOT] |

```json
{ "postID": "540919" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getPostByID --postID <id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Theo convention `faApi2 get*` (xem [Khám phá](../luong-kham-pha.md)), response thường có `is_success`; client **ném lỗi nếu `is_success=false`**. Cấu trúc bài đăng **chưa kiểm chứng**. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getPostByID.ts`](../../../scripts/nodejs/src/endpoints/getPostByID.ts). Thiếu `postID` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getPostByID } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const post = await ola.call(getPostByID, { postID: '540919' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getPostByID --postID 540919` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: `work/api_inventory.csv:44` — `ola_flutter_features_comment_comment_provider.dart:3582`, key `postID`.
- `postID` kiểu ID bài viết: đối chiếu [getLikesV2](getLikesV2.md) và socket `new message` (`contenType: post`, `relateID`) trong [socket-io.md](../socket-io.md).
