# napi/post/upload-post

**Upload media (ảnh/video) khi tạo bài viết feed**; server trả URL để đính vào bài trong luồng *Tạo bài viết*. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/napi/post/upload-post`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

> ⚠️ **Lưu ý transport.** Giống [postUploadChat](postUploadChat.md): hai key `content-type`/`x-file-name` trích từ AOT trông giống **HTTP header** (`Content-Type`, `X-File-Name`) của uploader raw-binary hơn là field JSON. Luồng thật nhiều khả năng là body nhị phân + 2 header; `OlaClient` (JSON + header cố định) **không** tái hiện đủ. `content` là phần client thêm. Định dạng `[Chưa xác minh]` — xem [con-thieu.md](../con-thieu.md) (mục FormData, và mục `/napi/post/upload-post` ưu tiên trung bình).

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `content-type` | string | MIME của media (ví dụ `image/jpeg`, `video/mp4`) — thực tế là HTTP header | `[Suy luận/AOT]` |
| `x-file-name` | string | tên file gốc — thực tế là HTTP header | `[Suy luận/AOT]` |
| `content` | string | nội dung file (base64/đường dẫn) — do client thêm, không có trong inventory | `[Chưa xác minh]` |

Ví dụ body (xấp xỉ JSON, nội dung rút gọn):

```json
{ "content-type": "image/jpeg", "x-file-name": "pic.jpg", "content": "data:base64,AAAA" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts postUploadPost --fileName <ten> --content <data> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến trả URL media đã lưu để ghép vào bài viết. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postUploadPost.ts`](../../../scripts/nodejs/src/endpoints/postUploadPost.ts). Thiếu `fileName`/`content` sẽ báo lỗi trước khi gửi; `contentType` mặc định `application/octet-stream`. Input dùng tên camelCase, khi gửi đổi thành key `x-file-name`/`content-type`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { postUploadPost } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(postUploadPost, {
    fileName: 'pic.jpg', contentType: 'image/jpeg', content: '<base64-hoặc-url>',
  });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postUploadPost --fileName <ten> [--contentType <mime>] --content <data>` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — tạo đối tượng mới trên storage. Đừng gọi tùy tiện; muốn dọn thì dùng [postDelR2](postDelR2.md).

## Bằng chứng

- `work/api_inventory.csv:125` — `ola_flutter_features_create_create_post_provider.dart:348` keys `content-type;x-file-name`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
