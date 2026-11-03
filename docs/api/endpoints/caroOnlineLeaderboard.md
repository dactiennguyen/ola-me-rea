# napi/caro/online/leaderboard

Bảng xếp hạng **Caro online (PvP)** — màn *Mini game — Caro*, tab bảng xếp hạng online. `[Suy luận/AOT]`

## Method + path

`GET https://sgdev.vip/napi/caro/online/leaderboard`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

GET — tham số qua query string:

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `limit` | number | số dòng tối đa (tuỳ chọn) | `[Suy luận/AOT]` |

```
GET /napi/caro/online/leaderboard?limit=50
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts caroOnlineLeaderboard --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/caroOnlineLeaderboard.ts`](../../../scripts/nodejs/src/endpoints/caroOnlineLeaderboard.ts). `limit` tuỳ chọn.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { caroOnlineLeaderboard } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const top = await ola.call(caroOnlineLeaderboard, { limit: 50 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts caroOnlineLeaderboard [--limit 50]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: `work/api_inventory.csv:103` — `ola_flutter_features_caro_caro_api.dart:2463`, key `limit`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
