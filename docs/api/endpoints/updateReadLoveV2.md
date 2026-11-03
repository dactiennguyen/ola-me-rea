# faApi2/updateReadLoveV2.php

Đánh dấu **đã đọc** các thông báo "Tim"/love (match) của tài khoản — xoá badge khi mở màn **Thích bạn**. Cặp với [getNotiCountLove.php](getNotiCountLove.md) (lấy số badge). [Suy luận] — dựng từ AOT, chưa bắt trên wire.

## Method + path

`POST https://sgdev.vip/faApi2/updateReadLoveV2.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Tài khoản đang đăng nhập (chủ các thông báo love); mặc định về `session.localId` | [Suy luận/AOT] |

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts updateReadLoveV2 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến `{ is_success, ... }`. [Chưa xác minh]

## ⚠️ Tác dụng phụ

**MUTATE**: đổi trạng thái "đã đọc" của luồng thông báo love trên server (reset badge Tim). Nhẹ nhưng vẫn thay đổi state; gọi đúng lúc mở màn Thích bạn.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/updateReadLoveV2.ts`](../../../scripts/nodejs/src/endpoints/updateReadLoveV2.ts). `uid` mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { updateReadLoveV2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  await ola.call(updateReadLoveV2);           // body {uid = mình}
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts updateReadLoveV2 [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- Static: `work/api_inventory.csv:91` — `ola_flutter_features_match_match_provider.dart:1154`, CandidateKey `uid`.
- Cặp badge: [getNotiCountLove.php](getNotiCountLove.md) (đọc số), updateReadLoveV2 (reset). Cùng nhóm match: [addMatchV2.php](addMatchV2.md), [getMatchV2.php](getMatchV2.md), [responseMatch.php](responseMatch.md).
