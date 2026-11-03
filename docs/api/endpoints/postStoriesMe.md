# napi/post/stories/me

Lấy **danh sách story của chính tài khoản đăng nhập** (mục "Tin của tôi" trong hồ sơ). [Suy luận/AOT]

- **Method + path:** `GET https://sgdev.vip/napi/post/stories/me`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Người dùng = chủ Bearer token.

## Query

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID tài khoản. Mặc định = `session.localId`. Theo convention `/me` (như `napi/caro/me`) server có thể tự suy ra từ token nên `uid` **có thể dư thừa**; AOT vẫn liệt kê nên client gửi kèm. | [Suy luận] `api_inventory.csv` |

```
GET /napi/post/stories/me?uid=<uid>
```

## Response

**Chưa bắt response** — chưa chạy trên wire trong phiên hiện có. Chạy `node scripts/nodejs/ola.ts postStoriesMe --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postStoriesMe.ts`](../../../scripts/nodejs/src/endpoints/postStoriesMe.ts). `uid` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { postStoriesMe } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const myStories = await ola.call(postStoriesMe);     // uid mặc định chính mình
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts postStoriesMe [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Suy luận] `work/api_inventory.csv` — `ola_flutter_features_profile_sub_my_stories_provider.dart:442`, CandidateKey `uid`.
- Convention `/me` token-derived: `napi/caro/me`, `napi/users/unread-views` (xem [endpoint-runtime.md](../endpoint-runtime.md)).
- Story của người theo dõi: [napi/post/stories/feed](postStoriesFeed.md). Tạo story: [napi/post/stories](postStories.md).
