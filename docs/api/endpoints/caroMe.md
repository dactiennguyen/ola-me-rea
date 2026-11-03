# napi/caro/me

Thống kê **Caro (cờ caro vs AI)** của tài khoản đang đăng nhập — màn *Mini game — Caro*.

## Method + path

`GET https://sgdev.vip/napi/caro/me`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Tài khoản suy ra từ token, không cần tham số.

## Request body

GET, **không tham số** (AOT `caro_api.dart:408` không liệt kê key; runtime xác nhận GET rỗng).

```
GET /napi/caro/me
```

## Response

**[Quan sát]** — gọi thật 2026-11-03 (dữ liệu của chính tài khoản test):

```json
{
  "success": true,
  "data": { "uid": "<uid>", "points": 0, "wins": 0, "losses": 0, "draws": 0, "rank": null }
}
```

| field | kiểu | ý nghĩa |
|---|---|---|
| `success` | boolean | Trạng thái xử lý (lưu ý: `napi/*` dùng `success`, khác `faApi2/*` dùng `is_success`) |
| `data.uid` | string | UID tài khoản |
| `data.points` | number | Điểm xếp hạng |
| `data.wins` / `losses` / `draws` | number | Thắng / thua / hoà |
| `data.rank` | number \| null | Hạng (null khi chưa có) |

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/caroMe.ts`](../../../scripts/nodejs/src/endpoints/caroMe.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { caroMe } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const stats = await ola.call(caroMe);
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts caroMe` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` (Flow "Mini game — Caro", `GET napi/caro/me`); [endpoint-runtime.md](../endpoint-runtime.md).
- Tĩnh: `work/api_inventory.csv:103` → `ola_flutter_features_caro_caro_api.dart:408`.
