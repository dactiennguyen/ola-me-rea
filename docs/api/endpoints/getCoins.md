# faApi2/getCoins.php

Lấy **số dư xu (coin) và level** của một tài khoản — gọi ở luồng khởi động (`config/init_provider`).

## Method + path

`POST https://sgdev.vip/faApi2/getCoins.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID cần tra ví; app gửi UID của chính mình | [Quan sát] runtime + [Suy luận/AOT] `init_provider.dart:665` |

```json
{ "uid": "<uid>" }
```

## Response

**[Quan sát]** — gọi thật 2026-11-03 (tài khoản test, dữ liệu của chính mình):

```json
{ "is_success": true, "xu": 0, "level": 1 }
```

| field | kiểu | ý nghĩa |
|---|---|---|
| `is_success` | boolean | Trạng thái xử lý |
| `xu` | number | Số dư xu |
| `level` | number | Level tài khoản |

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getCoins.ts`](../../../scripts/nodejs/src/endpoints/getCoins.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getCoins } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const wallet = await ola.call(getCoins);            // uid mặc định = tài khoản đăng nhập
  // hoặc tra UID khác: await ola.call(getCoins, { uid: '<uid>' })
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getCoins [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` #5/#11/#22 (`{"uid":"<uid>"}`, Flow "khởi động"); [endpoint-runtime.md](../endpoint-runtime.md).
- Tĩnh: `work/api_inventory.csv` → `ola_flutter_features_config_init_provider.dart:665`.
- Response là dữ liệu của chính tài khoản test nên hiển thị trực tiếp (không phải PII người khác).
