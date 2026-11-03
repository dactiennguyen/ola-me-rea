# faApi2/apiAddPostV9.php

Đăng một **bài viết (post)** lên news feed / Blog. Gọi khi người dùng bấm "Đăng" ở màn tạo bài (sau khi `getCreatePostInfo2` khởi tạo màn và ảnh đã được upload). [Suy luận/AOT]

- **Method + path:** `POST https://sgdev.vip/faApi2/apiAddPostV9.php`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID **người đăng**. Mặc định = `session.localId`. | [Suy luận] `api_inventory.csv` |
| `text` | string | Nội dung chữ của bài viết. | [Suy luận] |
| `listImage` | string[] | Danh sách URL ảnh (đã upload trước bằng `faApi2/upLoadImage2.php` — xem `scripts/nodejs/src/endpoints/upLoadImage2.ts`). Rỗng nếu bài chỉ có chữ. | [Suy luận] |
| `listDimen` | array | Kích thước (w/h) tương ứng từng ảnh trong `listImage`. | [Suy luận] |
| `requestNewFeed` | bool/int | Cờ yêu cầu server trả lại feed item vừa tạo. | [Suy luận] |
| `isVip` | bool/int | Cờ tài khoản VIP (ảnh hưởng hiển thị/ưu tiên). | [Suy luận] |
| `feeling` | string/object | Cảm xúc/mood đính kèm bài. | [Suy luận] |
| `checkIn` | string/object | Địa điểm check-in đính kèm bài. | [Suy luận] |

> Client yêu cầu có **ít nhất** `text` hoặc một ảnh trong `listImage`. Các cờ `requestNewFeed/isVip/feeling/checkIn` chỉ gửi khi được truyền (giữ nguyên kiểu từ caller).

```json
{
  "uid": "<uid>",
  "text": "Xin chào mọi người",
  "listImage": ["https://.../1.jpg", "https://.../2.jpg"],
  "listDimen": [{ "w": 1080, "h": 1080 }, { "w": 1080, "h": 1350 }],
  "feeling": "vui"
}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts apiAddPostV9 --text "..." --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Chưa chạy trên wire trong phiên hiện có (xem [con-thieu.md](../con-thieu.md) mục 7). [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/apiAddPostV9.ts`](../../../scripts/nodejs/src/endpoints/apiAddPostV9.ts). Cần `text` hoặc ít nhất một ảnh trong `listImage`, nếu không sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { apiAddPostV9 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  await ola.call(apiAddPostV9, { text: 'Xin chào' });                       // bài chỉ có chữ
  await ola.call(apiAddPostV9, { listImage: ['https://.../1.jpg'],          // bài có ảnh
    listDimen: [{ w: 1080, h: 1080 }] });
} finally {
  await ola.close();
}
```

CLI (`listImage`/`listDimen` truyền dạng JSON): `node scripts/nodejs/ola.ts apiAddPostV9 --text "Xin chào"` hoặc `node scripts/nodejs/ola.ts apiAddPostV9 --listImage '["https://a/1.jpg","https://a/2.jpg"]' --feeling vui` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — tạo một bài viết mới hiển thị công khai trên feed và đẩy noti `NEW_CONTENT` tới người theo dõi. Đừng gọi tùy tiện.

## Bằng chứng

- [Suy luận] `work/api_inventory.csv` — `ola_flutter_features_create_create_post_provider.dart:1499`, CandidateKeys `uid;requestNewFeed;listImage;text;listDimen;isVip;feeling;checkIn`.
- Liên quan: [getCreatePostInfo2.php](getCreatePostInfo2.md) (khởi tạo màn tạo bài). Noti `NEW_CONTENT` xem [socket-io.md](../socket-io.md).
