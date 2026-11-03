# faApi2/getRanking.php

Lấy **bảng xếp hạng** (ranking theo level/điểm) — màn **Level** của luồng IAP. `[Suy luận/AOT]` — dựng từ Dart AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/getRanking.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | tài khoản xem bảng xếp hạng (mặc định `<uid>` đăng nhập, để đánh dấu hạng của chính mình) | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts getRanking --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }` kèm danh sách xếp hạng; client ném lỗi nếu `is_success=false`. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getRanking.ts`](../../../scripts/nodejs/src/endpoints/getRanking.ts). `uid` mặc định tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getRanking } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const ranking = await ola.call(getRanking);   // uid mặc định = tài khoản đăng nhập
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getRanking [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- `work/api_inventory.csv:46` — `ola_flutter_features_iap_level_level_provider.dart:449` key `uid`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây. Leaderboard mini game mở trong phiên test đi qua `napi/caro/leaderboard` + `napi/minigame/*/leaderboard` (xem [endpoint-runtime.md](../endpoint-runtime.md)), **không** phải endpoint này.
