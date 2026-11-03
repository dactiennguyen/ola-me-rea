# napi/post/uploadChat

**Upload file đính kèm của chat** (ảnh / voice / sticker) lên kho R2/S3; server trả URL để gắn vào tin nhắn (xem [addLastMessage5](addLastMessage5.md)). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/napi/post/uploadChat`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

> ⚠️ **Lưu ý transport.** Hai key trích từ AOT là `content-type` và `x-file-name` — trông giống **HTTP header** (`Content-Type`, `X-File-Name`) của một uploader raw-binary hơn là field JSON. Nhiều khả năng luồng thật là: body = **bytes nhị phân của file**, kèm 2 header trên. `OlaClient` của repo (`scripts/nodejs/src/client.ts`) chỉ gửi JSON + bộ header cố định nên **không** tái hiện đủ. Bảng dưới liệt kê key đúng như inventory; `content` là phần client thêm để có dữ liệu mà upload. Toàn bộ định dạng là `[Chưa xác minh]` — xem [con-thieu.md](../con-thieu.md) mục FormData.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `content-type` | string | MIME của file (ví dụ `image/jpeg`, `audio/mp4`) — thực tế là HTTP header | `[Suy luận/AOT]` |
| `x-file-name` | string | tên file gốc — thực tế là HTTP header | `[Suy luận/AOT]` |
| `content` | string | nội dung file (base64/đường dẫn) — do client thêm, không có trong inventory | `[Chưa xác minh]` |

Ví dụ body (xấp xỉ JSON, nội dung rút gọn):

```json
{ "content-type": "audio/mp4", "x-file-name": "voice.m4a", "content": "data:base64,AAAA" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts postUploadChat --fileName <ten> --content <data> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến trả URL đối tượng đã lưu. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postUploadChat.ts`](../../../scripts/nodejs/src/endpoints/postUploadChat.ts). Thiếu `fileName`/`content` sẽ báo lỗi trước khi gửi; `contentType` mặc định `application/octet-stream`. Input dùng tên camelCase, khi gửi đổi thành key `x-file-name`/`content-type`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { postUploadChat } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(postUploadChat, {
    fileName: 'voice.m4a', contentType: 'audio/mp4', content: '<base64-hoặc-url>',
  });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postUploadChat --fileName <ten> [--contentType <mime>] --content <data>` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — tạo đối tượng mới trên storage. Đừng gọi tùy tiện; muốn dọn thì dùng [postDelR2](postDelR2.md).

## Bằng chứng

- `work/api_inventory.csv:124` — `ola_flutter_core_common_S3Storage.dart:1687` keys `content-type;x-file-name`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
