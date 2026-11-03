# napi/caro/online/me

Thống kê **Caro online (PvP)** của tài khoản đang đăng nhập — màn *Mini game — Caro*, chế độ online. Đối xứng với [`napi/caro/me`](../endpoint-runtime.md) (thống kê đấu AI). `[Suy luận/AOT]`

## Method + path

`GET https://sgdev.vip/napi/caro/online/me`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Tài khoản được suy ra từ token, không cần tham số.

## Request body

GET, **không tham số** — AOT không liệt kê key nào (giống `napi/caro/me`).

```
GET /napi/caro/online/me
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts caroOnlineMe --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/caroOnlineMe.ts`](../../../scripts/nodejs/src/endpoints/caroOnlineMe.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { caroOnlineMe } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const stats = await ola.call(caroOnlineMe);
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts caroOnlineMe` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: `work/api_inventory.csv:104` — `ola_flutter_features_caro_caro_api.dart:2685`, không có key.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
