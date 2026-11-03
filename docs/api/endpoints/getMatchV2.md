# faApi2/getMatchV2.php

Lấy danh sách match/"Thích bạn" của tài khoản (có phân trang) — nạp màn **Thích bạn**. [Quan sát] đã bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/getMatchV2.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Tài khoản cần lấy danh sách match; mặc định về tài khoản đăng nhập (`session.localId`) | [Quan sát] `api_runtime_inventory.csv` + `api_inventory.csv:38` |
| `page` | number | Trang phân trang (mặc định `0`) | [Quan sát] `api_runtime_inventory.csv` body `uid, page` |

```json
{ "uid": "<uid>", "page": 0 }
```

## Response

**Chưa bắt response** — logger phiên 2026-11-03 chỉ ghi request (body `uid, page`). Chạy `node scripts/nodejs/ola.ts getMatchV2 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }` kèm mảng match. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getMatchV2.ts`](../../../scripts/nodejs/src/endpoints/getMatchV2.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getMatchV2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const page0 = await ola.call(getMatchV2);               // body {uid=mình, page:0}
  const page1 = await ola.call(getMatchV2, { page: 1 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getMatchV2 [--page 1] [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/api_runtime_inventory.csv` — `POST faApi2/getMatchV2.php | uid, page | Thích bạn`; `docs/api/endpoint-runtime.md` dòng `/faApi2/getMatchV2.php | uid, page | Thích bạn`.
- Static: `work/api_inventory.csv:38` — `ola_flutter_features_match_match_provider.dart:891`, keys `uid;page`.
- Cùng nhóm match: [addMatchV2.php](addMatchV2.md), [responseMatch.php](responseMatch.md), [updateReadLoveV2.php](updateReadLoveV2.md).
