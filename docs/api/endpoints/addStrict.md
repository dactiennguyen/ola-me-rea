# faApi2/addStrict.php

Bật/tắt cờ **"strict"** cho một tài khoản (màn hồ sơ). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/addStrict.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `isStrict` | bool | bật (`true`) / tắt (`false`) cờ strict | `[Suy luận/AOT]` — chưa xác minh gửi bool hay `0/1` |
| `uid` | string | UID tài khoản áp dụng (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "isStrict": true, "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addStrict --isStrict --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addStrict.ts`](../../../scripts/nodejs/src/endpoints/addStrict.ts). `isStrict` bắt buộc và phải là boolean.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { addStrict } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(addStrict, { isStrict: true });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addStrict --isStrict | --isStrict false [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — đổi trạng thái strict của tài khoản trên server. Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:8` — `profile_provider.dart:5294` keys `isStrict;uid`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
