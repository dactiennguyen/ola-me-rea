# faApi2/getExplore3.php

Tab **Đã xác thực** của màn Khám phá: danh sách hồ sơ đã xác minh, phân trang bằng `page`. Xem luồng tổng ở [Khám phá](../luong-kham-pha.md). [Quan sát] — đã bắt trên wire 2026-11-03 (app 27.7.8).

## Method + path

`POST https://sgdev.vip/faApi2/getExplore3.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID Firebase của **người đang xem danh sách**; mặc định về tài khoản đăng nhập | [Quan sát] |
| `os` | string | Luôn `"android"` | [Quan sát] |
| `page` | number | Trang, bắt đầu từ 0; tăng 1 sau mỗi response có danh sách | [Quan sát] |
| `condition` | number | Cố định `1` cho tab Đã xác thực | [Quan sát] |
| `gender` | number | Bộ lọc giới tính: `0`=Nữ, `1`=Nam, `2`=LGBT; "Tất cả" thì bỏ key | [Quan sát] `0`, `2`; [Suy luận/AOT] `1` |
| `cityID` | string | Mã tỉnh theo dữ liệu app (vd `"1"`=Hà Nội); "Tất cả" thì bỏ key | [Suy luận/AOT] |

Tab này **không** gửi `lastSeenPaging` (chỉ tab Online dùng cursor).

```json
{ "uid": "<uid>", "os": "android", "page": 0, "condition": 1 }
```

## Response

[Quan sát] — các key đã thấy (không in giá trị PII của user khác):

```text
{ is_success, message, list_data: [ UserModel, ... ] }
```

Mỗi phần tử `list_data` có `uid`, `lastSeen`, `displayName`, `photoURL`, `isVerifyAvatar`, `isVip`, `level`, `state`. Danh sách rỗng = hết dữ liệu; khi không ai khớp bộ lọc, server trả `{is_success: false, message: "", list_data: []}` và client coi là kết quả rỗng, không phải lỗi. Chi tiết schema và phân trang: [Khám phá](../luong-kham-pha.md).

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getExplore3.ts`](../../../scripts/nodejs/src/endpoints/getExplore3.ts). Dùng chung [`_explore.ts`](../../../scripts/nodejs/src/endpoints/_explore.ts) với các tab Khám phá khác; kết quả là `{ tab, page, items, next, raw }`, truyền lại `next` để lấy trang sau.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { getExplore3 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const first = await ola.call(getExplore3, { gender: 1, cityID: '1' });
  if (first.next) await ola.call(getExplore3, first.next);
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getExplore3 [--page 0] [--gender 0|1|2|all] [--cityID <mã>]` (thêm `--dry-run` để chỉ in request)

Lấy nhiều trang liên tiếp: `node scripts/nodejs/explore.ts --tab verified --gender 1 --city 1 --pages 3`.

## Bằng chứng

- Wire: `work/api_runtime_inventory.csv` (`POST faApi2/getExplore3.php`, BodyKeys `uid, os, page, condition`, Flow "Khám phá — Đã xác thực"); `work/runtime_capture_session.log` request #39.
- Tĩnh: `work/api_inventory.csv` → `ola_flutter_features_explore_explore_provider.dart:1211` (keys `uid;page;os;android;condition;gender;cityID`).
