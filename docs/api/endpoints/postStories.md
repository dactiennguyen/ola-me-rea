# napi/post/stories

Tạo một **tin (story)** theo API `napi` — biến thể mới của luồng tạo story (cùng `StoryUploadNotifier` với [faApi2/upStory.php](upStory.md)). Đẩy noti `NEW_CONTENT` với `contenType:"stories"`. [Suy luận/AOT]

- **Method + path:** `POST https://sgdev.vip/napi/post/stories`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID **người đăng**. Mặc định = `session.localId`. | [Suy luận] `api_inventory.csv` |
| `media_url` | string | URL media chính của story (đã upload trước). | [Suy luận] |
| `media_type` | string | Loại media: `"image"` / `"video"`. | [Suy luận] |
| `image` | string | URL ảnh / thumbnail. | [Suy luận] |
| `caption` | string | Chú thích đính kèm story. | [Suy luận] |
| `privacy` | string | Quyền riêng tư: `"public"` / `"private"` / `"friends"`. | [Suy luận] |
| `LOCATION` | string | Vị trí đính kèm (?). Tên viết hoa bất thường, chưa rõ có phải trường request. | [Chưa xác minh] |
| ~~`is_success`~~ | — | Xuất hiện trong union CandidateKeys nhưng gần như chắc là trường **RESPONSE** lẫn vào — client **không** gửi. | [Chưa xác minh] |

> Client yêu cầu có **ít nhất** `media_url` hoặc `image`. Các trường còn lại chỉ gửi khi được truyền.

```json
{
  "uid": "<uid>",
  "media_url": "https://.../story.jpg",
  "media_type": "image",
  "caption": "Một ngày đẹp trời",
  "privacy": "public"
}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts postStories --media_url "..." --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Chưa chạy trên wire trong phiên hiện có (xem [con-thieu.md](../con-thieu.md) mục 7). [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postStories.ts`](../../../scripts/nodejs/src/endpoints/postStories.ts). Thiếu cả `media_url` lẫn `image` sẽ báo lỗi trước khi gửi; `uid` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { postStories } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  await ola.call(postStories, {
    media_url: 'https://.../story.jpg', media_type: 'image', privacy: 'public',
  });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postStories --media_url https://m/x.jpg [--media_type image] [--image <url>] [--caption "..."] [--privacy public] [--LOCATION <...>] [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — tạo một story mới trên server và đẩy noti `NEW_CONTENT` (`contenType:"stories"`) tới người theo dõi. Đừng gọi tùy tiện.

## Bằng chứng

- [Suy luận] `work/api_inventory.csv` — `ola_flutter_features_feed_story_StoryUploadNotifier.dart:812`, CandidateKeys `is_success;LOCATION;uid;media_url;caption;media_type;image;privacy`.
- Noti `NEW_CONTENT`/`contenType:"stories"` bắt được ở `work/runtime_capture_session.log` (#453) — xem [socket-io.md](../socket-io.md).
- Biến thể cũ: [faApi2/upStory.php](upStory.md). Thao tác trên story theo id: [napi/post/stories/&lt;id&gt;](postStoriesId.md).
