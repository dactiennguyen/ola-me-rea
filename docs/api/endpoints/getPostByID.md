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

[Quan sát 2026-11-04] `{is_success: true, message: "done", data: {bài}}`; bài có cùng field như item của [getFeedNoiBatV4](getFeedNoiBatV4.md) (không có `location`, `level`), thêm `os`, `userBock`, `listReact` (chuỗi, rỗng khi chưa có). Đọc bằng `loadPost()` trong [`src/blog.ts`](../../../scripts/nodejs/src/blog.ts).

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
