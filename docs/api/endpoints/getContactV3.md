# faApi2/getContactV3.php

Lấy **danh bạ / danh sách liên hệ** của người đang đăng nhập (bạn bè, người đã kết nối). App gọi lúc **khởi động**, nằm trong lô request nạp dữ liệu ban đầu cùng `getCoins`, `getLastMessage2`, `getNotificationsCount`...

- **Method + path:** `POST https://sgdev.vip/faApi2/getContactV3.php`
- **Auth:** bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | Firebase UID của **tài khoản đang đăng nhập** — lấy danh bạ của chính mình. Mặc định = `session.localId`. | [Quan sát] `runtime_capture_session.log` #8/#19 |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>" }
```

## Response

**Chưa bắt response** — logger phiên 2026-11-03 chỉ ghi request. Chạy `node scripts/nodejs/ola.ts getContactV3 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

Client ném lỗi nếu `is_success=false`: endpoint faApi2 `get*` dạng danh sách này được suy luận trả `{ is_success, ... }` giống [getBlockV3.php](getBlockV3.md)/[getFollowListV3.php](getFollowListV3.md) — [Suy luận], chưa có response thật để xác nhận.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getContactV3.ts`](../../../scripts/nodejs/src/endpoints/getContactV3.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getContactV3 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const danhBa = await ola.call(getContactV3);                 // uid = tài khoản đang đăng nhập
  // hoặc danh bạ của một user khác:
  const khac = await ola.call(getContactV3, { uid: '<uid>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getContactV3 [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- [Quan sát] `work/runtime_capture_session.log` #8, #19 (khởi động) — body `{"uid":"<uid>"}`; `work/api_runtime_inventory.csv` dòng `getContactV3.php | uid | khởi động`.
- [Suy luận] `work/api_inventory.csv:398-row` — `ola_flutter_features_contact_contact_provider.dart:398`, CandidateKeys `uid`.
- Cùng lô khởi động với [getCoins.php](../endpoint-runtime.md), [getLastMessage2.php](getLastMessage2.md), [getNotificationsCount.php](getNotificationsCount.md). Tổng quan: [endpoint-runtime.md](../endpoint-runtime.md).
