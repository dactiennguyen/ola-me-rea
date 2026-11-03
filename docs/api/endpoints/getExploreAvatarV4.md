# faApi2/getExploreAvatarV4.php

Tab **Ảnh có mặt** của màn Khám phá: danh sách hồ sơ có ảnh gương mặt, phân trang bằng `page`. Xem luồng tổng ở [Khám phá](../luong-kham-pha.md). [Quan sát] — đã bắt trên wire 2026-11-03 (app 27.7.8).

## Method + path

`POST https://sgdev.vip/faApi2/getExploreAvatarV4.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID Firebase của **người đang xem danh sách**; mặc định về tài khoản đăng nhập | [Quan sát] |
| `os` | string | Luôn `"android"` | [Quan sát] |
| `page` | number | Trang, bắt đầu từ 0; tăng 1 sau mỗi response có danh sách | [Quan sát] |
| `gender` | number | Bộ lọc giới tính: `0`=Nữ, `1`=Nam, `2`=LGBT; "Tất cả" thì bỏ key | [Suy luận/AOT] |
| `cityID` | string | Mã tỉnh theo dữ liệu app (vd `"1"`=Hà Nội); "Tất cả" thì bỏ key | [Suy luận/AOT] |

Tab này **không** gửi `condition` và **không** gửi `lastSeenPaging`.

```json
{ "uid": "<uid>", "os": "android", "page": 0 }
```

## Response

[Quan sát] — các key đã thấy (không in giá trị PII của user khác):

```text
{ is_success, message, list_data: [ UserModel, ... ] }
```

Mỗi phần tử `list_data` có `uid`, `lastSeen`, `displayName`, `photoURL`, `isVerifyAvatar`, `isVip`, `level`, `state`, `isMale`, `followers`, `isNew`, `createDate` (`isNew` là boolean). Danh sách rỗng = hết dữ liệu. Chi tiết schema và phân trang: [Khám phá](../luong-kham-pha.md).

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getExploreAvatarV4.ts`](../../../scripts/nodejs/src/endpoints/getExploreAvatarV4.ts). Dùng chung [`_explore.ts`](../../../scripts/nodejs/src/endpoints/_explore.ts) với các tab Khám phá khác; kết quả là `{ tab, page, items, next, raw }`, truyền lại `next` để lấy trang sau.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getExploreAvatarV4 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const first = await ola.call(getExploreAvatarV4, { page: 0 });
  if (first.next) await ola.call(getExploreAvatarV4, first.next);
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getExploreAvatarV4 [--page 0] [--gender 0|1|2|all] [--cityID <mã>]` (thêm `--dry-run` để chỉ in request)

Lấy nhiều trang liên tiếp: `node scripts/nodejs/explore.ts --tab avatar --gender 0 --city 1 --pages 3`.

## Bằng chứng

- Wire: `work/api_runtime_inventory.csv` (`POST faApi2/getExploreAvatarV4.php`, BodyKeys `uid, os, page`, Flow "Khám phá — Ảnh có mặt"); `work/runtime_capture_session.log` request #40.
- Tĩnh: `work/api_inventory.csv` → `ola_flutter_features_explore_explore_provider.dart:1133` (keys `lastSeenPaging;uid;page;os;android;cityID;gender`).
