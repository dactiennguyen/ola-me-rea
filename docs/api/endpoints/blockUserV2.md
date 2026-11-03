# faApi2/blockUserV2.php

**Chặn** một người dùng — màn hồ sơ và màn *Cài đặt* (danh sách đã chặn). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/blockUserV2.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

Hai call-site trùng key (chỉ khác việc có gửi kèm `uid` hay không):

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `id` | string | UID người bị chặn | `[Suy luận/AOT]` |
| `isForever` | bool | chặn vĩnh viễn (`true`) hay tạm thời (`false`, mặc định) | `[Suy luận/AOT]` |
| `uid` | string | UID người thực hiện chặn (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "id": "<peer_uid>", "isForever": false, "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts blockUserV2 --id <peer_uid> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/blockUserV2.ts`](../../../scripts/nodejs/src/endpoints/blockUserV2.ts). Thiếu `id` sẽ báo lỗi trước khi gửi; `isForever` mặc định `false`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { blockUserV2 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(blockUserV2, { id: '<peer-uid>', isForever: false });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts blockUserV2 --id <peer_uid> [--isForever] [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — chặn người dùng trên server (ảnh hưởng quan hệ chat/kết bạn thật). Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:18` — `profile_provider.dart:4829` keys `id;isForever;uid`
- `work/api_inventory.csv:19` — `local_settings_provider.dart:518` keys `id;isForever`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
