# faApi2/updateStrictDel.php

Xoá bản ghi **vi phạm/"strict"** của một người dùng: xoá 1 bài (`postID`) hoặc xoá tất cả (`delAll`). Màn kiểm duyệt (violation_provider) — hành động quản trị, thường cần quyền admin. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/updateStrictDel.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

`uid` là người bị xoá vi phạm; mặc định `session.localId` (giống [updateStrictV2](updateStrictV2.md)), truyền uid khác để thao tác người bị chấm strict.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID người bị xoá bản ghi strict (mặc định `<uid>`) | `[Suy luận/AOT]` |
| `postID` | string \| number | Bài vi phạm cần xoá (khi xoá 1 bài) | `[Suy luận/AOT]` |
| `tyleP` | string \| number | Loại bài (type post) kèm theo | `[Suy luận/AOT]` |
| `avatar` | string | URL avatar của người bị xử lý | `[Suy luận/AOT]` |
| `delAll` | bool/1 | Cờ xoá **tất cả** bản ghi của uid | `[Suy luận/AOT]` |

> Client yêu cầu nêu rõ `postID` (xoá 1 bài) **hoặc** `delAll` (xoá tất cả) để chống xoá nhầm. `tyleP`/`avatar` là ngữ cảnh đi kèm theo call-site (có thì gửi, không thì bỏ).

Ví dụ body (đã redact):

```json
{ "uid": "<uid>", "postID": 55123, "tyleP": 1 }
{ "uid": "<uid>", "delAll": true }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts updateStrictDel --postID 55123 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/updateStrictDel.ts`](../../../scripts/nodejs/src/endpoints/updateStrictDel.ts). Phải truyền đúng một trong `postID` / `delAll`: thiếu cả hai hoặc truyền cả hai đều báo lỗi trước khi gửi. `uid` mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { updateStrictDel } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  await ola.call(updateStrictDel, { uid: '<target-uid>', postID: 55123, tyleP: 1 }); // xoá 1 bài
  await ola.call(updateStrictDel, { uid: '<target-uid>', delAll: true });            // xoá tất cả
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts updateStrictDel --postID <id> [--tyleP <loại>] [--avatar <url>] [--uid <uid>]` (thêm `--dry-run` để chỉ in request); xoá tất cả: `node scripts/nodejs/ola.ts updateStrictDel --delAll --uid <uid>`

## ⚠️ Tác dụng phụ

**Mutate** — **xoá vĩnh viễn** dữ liệu kiểm duyệt/vi phạm trên server. `delAll` xoá toàn bộ bản ghi của uid, không hoàn tác. Nhiều khả năng cần quyền admin; đừng gọi tùy tiện.

## Bằng chứng

- [Suy luận] `work/api_inventory.csv:92` — `ola_flutter_features_violation_violation_provider.dart:476`, CandidateKeys `uid;postID;tyleP;avatar;delAll`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
- Cùng nhóm vi phạm với [updateStrictV2.md](updateStrictV2.md), [addStrict.md](addStrict.md), [getViolate.md](getViolate.md).
