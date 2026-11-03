# napi/post/stories/&lt;storyId&gt;

Thao tác trên **một story theo id** (path động). Gồm nhóm thao tác ở màn xem story (`StoryViewerScreen`): đánh dấu đã xem, thả cảm xúc, xoá, và lấy danh sách người xem. [Chưa xác minh]

- **Method + path (động):**
  - `POST   https://sgdev.vip/napi/post/stories/<storyId>/view`    — đánh dấu đã xem (`_markStoryAsViewed`)
  - `POST   https://sgdev.vip/napi/post/stories/<storyId>/react`   — thả cảm xúc (`_onReact`)
  - `DELETE https://sgdev.vip/napi/post/stories/<storyId>`         — xoá story của mình (`_onTapDeleteCurrentStory`)
  - `GET    https://sgdev.vip/napi/post/stories/<storyId>/viewers` — danh sách người xem (`_fetchViewersForCurrentStory`)
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

> **Lưu ý nguồn:** inventory tĩnh chỉ ghi nhận base path `napi/post/stories/` với **4 call-site**, method và keys đều `unknown`. Tên sub-path (`view`/`react`/`viewers`) và HTTP method ở trên là **suy ra** từ tên hàm trong `_StoryViewerScreenState` (`work/libid_map.txt`), **chưa kiểm chứng trên wire**. Client cho phép truyền `action` và `method` tùy ý để đổi khi xác minh được giá trị thật.

## Tham số builder

| tham số | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `storyId` | string | **Bắt buộc.** Id story (phân đoạn path). Chỉ nhận `[A-Za-z0-9_.-]`. | [Suy luận] |
| `action` | string | Sub-path tùy chọn: `view` / `react` / `viewers` / ... Bỏ trống = thao tác ngay trên `.../<storyId>`. | [Chưa xác minh] |
| `method` | string | HTTP method: `POST` (mặc định) / `GET` / `PUT` / `PATCH` / `DELETE`. | [Chưa xác minh] |
| `body` | object | Body JSON cho POST/PUT/PATCH/DELETE (vd `{ "type": 1 }` khi thả cảm xúc). | [Chưa xác minh] |
| `query` | object | Query cho biến thể GET. | [Chưa xác minh] |

Ví dụ body thả cảm xúc (đã redact):

```json
{ "type": 1 }
```

## Response

**Chưa bắt response** — các sub-path/method chưa chạy trên wire. Chạy ví dụ `node scripts/nodejs/ola.ts postStoriesId --storyId <storyId> --action view --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/postStoriesId.ts`](../../../scripts/nodejs/src/endpoints/postStoriesId.ts). `storyId`/`action` chỉ nhận `[A-Za-z0-9_.-]` (không nhận `.`/`..`); `body` chỉ đi với method khác GET, `query` chỉ với GET.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { postStoriesId } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  await ola.call(postStoriesId, { storyId: '540918', action: 'view' });                 // POST .../view
  await ola.call(postStoriesId, { storyId: '540918', action: 'react', body: { type: 1 } });
  await ola.call(postStoriesId, { storyId: '540918', method: 'DELETE' });                // xoá
  const viewers = await ola.call(postStoriesId, { storyId: '540918', action: 'viewers', method: 'GET' });
} finally {
  await ola.close();
}
```

CLI (`--body`/`--query` nhận chuỗi JSON; thêm `--dry-run` để chỉ in request):

```bash
node scripts/nodejs/ola.ts postStoriesId --storyId 540918 --action view --dry-run
node scripts/nodejs/ola.ts postStoriesId --storyId 540918 --action react --body '{"type":1}' --dry-run
node scripts/nodejs/ola.ts postStoriesId --storyId 540918 --method DELETE --dry-run
node scripts/nodejs/ola.ts postStoriesId --storyId 540918 --action viewers --method GET --dry-run
```

## ⚠️ Tác dụng phụ

**Mutate** — tùy `action`/`method` có thể ghi lượt xem, thả cảm xúc, hoặc **xoá** story (`DELETE` không hoàn tác). Đừng gọi tùy tiện, nhất là khi chưa xác minh được sub-path thật.

## Bằng chứng

- [Suy luận] `work/api_inventory.csv` — 4 call-site `napi/post/stories/` (method/keys unknown): `ola_flutter_features_feed_story_StoryApiService.dart:187`, `:453`, `:750`, `:985`.
- [Suy luận] `work/libid_map.txt` — `_StoryViewerScreenState`: `_markStoryAsViewed`, `_onReact`, `_onTapDeleteCurrentStory`, `_fetchViewersForCurrentStory`.
- Tạo story: [napi/post/stories](postStories.md). Danh sách story: [feed](postStoriesFeed.md) / [me](postStoriesMe.md).
