# napi/caro/leaderboard

Bảng xếp hạng **Caro đấu AI** — màn *Mini game — Caro*, tab bảng xếp hạng. `[Quan sát]` (method) + `[Suy luận/AOT]` (tham số)

## Method + path

`GET https://sgdev.vip/napi/caro/leaderboard`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

GET — tham số qua query string. Phiên bắt trên dây **không gửi query nào** (gọi trần). Hai tham số dưới là tuỳ chọn, lấy từ AOT:

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `period` | string | khoảng thời gian xếp hạng (vd `week`/`month`/`all` — giá trị là suy luận) | `[Suy luận/AOT]` |
| `limit` | number | số dòng tối đa | `[Suy luận/AOT]` |

```
GET /napi/caro/leaderboard?period=week&limit=20
```

## Response

**Chưa bắt response** — `work/api_runtime_inventory.csv:35` xác nhận method GET nhưng không ghi response. Chạy `node scripts/nodejs/ola.ts caroLeaderboard --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/caroLeaderboard.ts`](../../../scripts/nodejs/src/endpoints/caroLeaderboard.ts). `period`/`limit` tuỳ chọn.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { caroLeaderboard } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const top = await ola.call(caroLeaderboard, { period: 'week', limit: 20 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts caroLeaderboard [--period week] [--limit 20]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/api_runtime_inventory.csv:35` — GET, flow "Mini game — Caro" (gọi không query).
- Static: `work/api_inventory.csv:101` — `ola_flutter_features_caro_caro_api.dart:839`, keys `period;limit`.
