# faApi2/getUserInfoV7.php

Lấy thông tin hồ sơ của một người dùng. Gọi ngay khi **mở màn xem hồ sơ** (`ProfileProvider`), trước `shouldLoadFeed` và `getPostByUserV7`. [Quan sát]

## Method + path

`POST https://sgdev.vip/faApi2/getUserInfoV7.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer Firebase token + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Body JSON.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `targetUid` | string | Firebase UID của **người được xem** (bắt buộc) | [Quan sát] log #29/#35 |
| `myUid` | string | Firebase UID của **người đang xem**; mặc định tài khoản đăng nhập | [Quan sát] log #29/#35 |

```json
{
  "targetUid": "<uid người được xem>",
  "myUid": "<uid>"
}
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getUserInfoV7 --targetUid <uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Phiên 2026-11-03 chỉ bắt request body + header, không bắt body trả về. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getUserInfoV7.ts`](../../../scripts/nodejs/src/endpoints/getUserInfoV7.ts). Thiếu `targetUid` sẽ báo lỗi trước khi gửi; `myUid` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getUserInfoV7 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const info = await ola.call(getUserInfoV7, { targetUid: '<uid người được xem>' });
  // myUid tự lấy từ session.localId; truyền { myUid } để ghi đè.
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getUserInfoV7 --targetUid <uid> [--myUid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Runtime: `work/runtime_capture_session.log` #29 (`{"targetUid":"Zg7…","myUid":"Bn8…"}`) và #35; luồng "xem hồ sơ" trong [endpoint-runtime.md](../endpoint-runtime.md).
- AOT: `work/api_inventory.csv` → `ola_flutter_features_profile_profile_provider.dart:5799`, keys `targetUid;myUid`.
