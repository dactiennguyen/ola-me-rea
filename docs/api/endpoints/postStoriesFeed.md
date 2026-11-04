# napi/post/stories/feed

Lấy **danh sách story** của những người đang theo dõi (thanh story ở đầu màn Blog / News feed). App gọi khi mở tab **Blog**. [Quan sát]

- **Method + path:** `GET https://sgdev.vip/napi/post/stories/feed`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Người xem = chủ Bearer token.

## Query

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `viewer_id` | string | UID người xem. **Chưa thấy trên dây** (wire thực tế không kèm query); client chỉ gửi khi được truyền. | [Suy luận] `api_inventory.csv` |

Trên wire thực tế GET không kèm query:

```
GET /napi/post/stories/feed
```

## Response

[Quan sát 2026-11-04] Nhóm theo người đăng:

```json
{ "is_success": true, "data": [{ "user_id": "<uid>", "displayName": "…", "photoURL": "https://…", "fcmToken": "…",
  "privacy": "public", "receiverPushStranger": 1, "has_unseen": true, "latest_created_at": 1793773729000,
  "stories": [{ "id": 8289, "user_id": "<uid>", "media_url": "https://…", "media_type": "image", "privacy": "public",
    "caption": "", "view_count": 46, "created_at": "2026-11-04T06:28:49.000Z", "expires_at": "2026-11-05T06:28:49.000Z",
    "displayName": "…", "photoURL": "https://…", "fcmToken": "…", "receiverPushStranger": 1, "is_viewed": 0 }] }] }
```

Đọc bằng `loadStories()` trong [`src/blog.ts`](../../../scripts/nodejs/src/blog.ts).

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postStoriesFeed.ts`](../../../scripts/nodejs/src/endpoints/postStoriesFeed.ts). `viewer_id` chỉ gửi khi được truyền.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { postStoriesFeed } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const feed = await ola.call(postStoriesFeed);                 // không kèm query (khớp wire)
  // biến thể AOT: ola.call(postStoriesFeed, { viewer_id: '<uid>' })  // [Suy luận]
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postStoriesFeed [--viewer_id <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/api_runtime_inventory.csv` — dòng `GET napi/post/stories/feed | – | "Blog"`; `work/runtime_capture_live.log`.
- [Suy luận] `work/api_inventory.csv` — `ola_flutter_features_feed_story_stories_provider.dart:1138`, CandidateKey `viewer_id`.
- Story của chính mình: [napi/post/stories/me](postStoriesMe.md). Tạo story: [napi/post/stories](postStories.md).
