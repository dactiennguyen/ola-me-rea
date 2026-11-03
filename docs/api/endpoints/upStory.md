# faApi2/upStory.php

Đăng một **tin (story)** theo API `faApi2` — biến thể cũ của luồng tạo story. Cùng notifier (`StoryUploadNotifier`) với [napi/post/stories](postStories.md) (biến thể `napi` mới). [Suy luận/AOT]

- **Method + path:** `POST https://sgdev.vip/faApi2/upStory.php`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID **người đăng**. Mặc định = `session.localId`. | [Suy luận] `api_inventory.csv` |
| `story_media` | string | URL media chính của story (đã upload trước). | [Suy luận] |
| `image` | string | URL ảnh / thumbnail của story. | [Suy luận] |
| `caption` | string | Chú thích đính kèm story. | [Suy luận] |

> Client yêu cầu có **ít nhất** `story_media` hoặc `image`. `caption` chỉ gửi khi được truyền.

```json
{
  "uid": "<uid>",
  "story_media": "https://.../story.mp4",
  "image": "https://.../thumb.jpg",
  "caption": "Một ngày đẹp trời"
}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts upStory --story_media "..." --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Chưa chạy trên wire trong phiên hiện có. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/upStory.ts`](../../../scripts/nodejs/src/endpoints/upStory.ts). Thiếu cả `story_media` lẫn `image` sẽ báo lỗi trước khi gửi; `uid` mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { upStory } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  await ola.call(upStory, { story_media: 'https://.../story.mp4', caption: 'Chào buổi sáng' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts upStory [--story_media <url>] [--image <url>] [--caption <chú thích>] [--uid <uid>]` (thêm `--dry-run` để chỉ in request); cần ít nhất `--story_media` hoặc `--image`.

## ⚠️ Tác dụng phụ

**Mutate** — tạo một story mới hiển thị ở thanh story / mục "Tin". Đừng gọi tùy tiện.

## Bằng chứng

- [Suy luận] `work/api_inventory.csv` — `ola_flutter_features_feed_story_StoryUploadNotifier.dart:712`, CandidateKeys `story_media;caption;uid;image`.
- Cùng notifier với [napi/post/stories](postStories.md); xem danh sách story của mình [napi/post/stories/me](postStoriesMe.md).
