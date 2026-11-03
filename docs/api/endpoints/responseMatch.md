# faApi2/responseMatch.php

Phản hồi một lượt match — **đồng ý / từ chối** lời "thích" từ người khác, trong màn **Thích bạn**. [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/responseMatch.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

Hai call-site trong cùng `match_provider` dùng **chung một bộ keys** `uid1;uid2;response` (có thể là hai vị trí UI cho cùng một hành động phản hồi — ví dụ nút đồng ý và nút từ chối):

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid1` | string | Người phản hồi (actor); mặc định về tài khoản đăng nhập (`session.localId`) | [Suy luận/AOT] |
| `uid2` | string | UID người đã thích mình — đối tượng được phản hồi (bắt buộc) | [Suy luận/AOT] |
| `response` | number | Quyết định phản hồi. **Suy luận** `1` = đồng ý, `0` = từ chối; giá trị cụ thể [Chưa xác minh] | [Suy luận/AOT] |

```json
{ "uid1": "<uid>", "uid2": "<uid_nguoi_thich_minh>", "response": 1 }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts responseMatch --uid2 <uid> --response 1 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }`. [Chưa xác minh]

## ⚠️ Tác dụng phụ

**MUTATE**: ghi quyết định match thật trên server. Đồng ý (`response=1`) có thể tạo cặp match và sinh thông báo cho `uid2`; từ chối cũng đổi trạng thái lời thích. Đừng gọi tùy tiện, nhất là khi chưa xác minh được ý nghĩa `response`.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/responseMatch.ts`](../../../scripts/nodejs/src/endpoints/responseMatch.ts). Thiếu `uid2`/`response` (số nguyên) sẽ báo lỗi trước khi gửi; `uid1` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { responseMatch } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  await ola.call(responseMatch, { uid2: '<uid_nguoi_thich_minh>', response: 1 }); // đồng ý (suy luận)
  await ola.call(responseMatch, { uid2: '<uid_nguoi_thich_minh>', response: 0 }); // từ chối (suy luận)
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts responseMatch --uid2 <uid> --response <1|0> [--uid1 <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: hai call-site cùng keys `uid1;uid2;response`:
  - `work/api_inventory.csv:68` — `ola_flutter_features_match_match_provider.dart:403`
  - `work/api_inventory.csv:69` — `ola_flutter_features_match_match_provider.dart:2105`
- Cùng nhóm match: [addMatchV2.php](addMatchV2.md), [getMatchV2.php](getMatchV2.md), [updateReadLoveV2.php](updateReadLoveV2.md).
