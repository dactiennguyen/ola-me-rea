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

**Chưa bắt response** — logger phiên 2026-11-03 chỉ ghi method + path (GET, không body). Chạy `node scripts/nodejs/ola.ts postStoriesFeed --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postStoriesFeed.ts`](../../../scripts/nodejs/src/endpoints/postStoriesFeed.ts). `viewer_id` chỉ gửi khi được truyền.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { postStoriesFeed } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
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
