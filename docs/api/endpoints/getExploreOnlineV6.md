# faApi2/getExploreOnlineV6.php

Tab **Online** của màn Khám phá: danh sách người đang hoạt động, có phân trang bằng cursor. Xem luồng tổng ở [Khám phá](../luong-kham-pha.md). [Quan sát] — đã bắt trên wire 2026-11-03 (app 27.7.8).

## Method + path

`POST https://sgdev.vip/faApi2/getExploreOnlineV6.php`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID Firebase của **người đang xem danh sách** (không phải người cần tìm); mặc định về tài khoản đăng nhập | [Quan sát] |
| `os` | string | Luôn `"android"` | [Quan sát] |
| `page` | number | Trang, bắt đầu từ 0; tăng 1 sau mỗi response có danh sách | [Quan sát] |
| `condition` | number | Cố định `2` cho tab Online | [Quan sát] |
| `lastSeenPaging` | number | Cursor; lần đầu `0`, các trang sau gửi nguyên `response.lastSeenPaging` của trang trước | [Quan sát] |
| `gender` | number | Bộ lọc giới tính: `0`=Nữ, `1`=Nam, `2`=LGBT; "Tất cả" thì bỏ key | [Suy luận/AOT] |
| `cityID` | string | Mã tỉnh theo dữ liệu app (vd `"1"`=Hà Nội); "Tất cả" thì bỏ key | [Suy luận/AOT] |

```json
{
  "uid": "<uid>",
  "os": "android",
  "page": 0,
  "condition": 2,
  "gender": 0,
  "cityID": "1",
  "lastSeenPaging": 0
}
```

## Response

[Quan sát] — các key đã thấy (không in giá trị PII của user khác):

```text
{ is_success, message, list_data: [ UserModel, ... ], lastSeenPaging: <integer> }
```

Mỗi phần tử `list_data` có các key quan sát được: `uid`, `lastSeen`, `displayName`, `photoURL`, `isVerifyAvatar`, `isVip`, `level` (string cho uid/tên/URL; `isVip`/`isVerifyAvatar` là number). Danh sách rỗng = hết dữ liệu; không suy ra hết trang vì nhận ít hơn 50 phần tử. Chi tiết schema và phân trang: [Khám phá](../luong-kham-pha.md).

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/getExploreOnlineV6.ts`](../../../scripts/nodejs/src/endpoints/getExploreOnlineV6.ts). Dùng chung `_explore.ts` (`defineExplore`) với hai tab Khám phá còn lại; `page > 0` bắt buộc kèm `lastSeenPaging` của trang trước.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { getExploreOnlineV6 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const first = await ola.call(getExploreOnlineV6, { gender: 0, cityID: '1' });
  // { tab, page, items, next, raw } — items giữ nguyên field hồ sơ
  if (first.next) await ola.call(getExploreOnlineV6, first.next); // tự chuyển cursor
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts getExploreOnlineV6 [--gender 0|1|2|all] [--cityID <mã>] [--page <n> --lastSeenPaging <cursor>]` (thêm `--dry-run` để chỉ in request)

Lấy nhiều trang liên tiếp: `node scripts/nodejs/explore.ts --tab online --pages <n>` (nhận `--page`, `--gender 0|1|2|all`, `--city <mã>`, `--cursor <n>`).

## Bằng chứng

- Wire: `work/api_runtime_inventory.csv` (`POST faApi2/getExploreOnlineV6.php`, BodyKeys `uid, os, page, condition, lastSeenPaging`, Flow "Khám phá — Online"); `work/runtime_capture_session.log` request #38.
- Tĩnh: `work/api_inventory.csv` → `ola_flutter_features_explore_explore_provider.dart:1059` (keys `uid;page;condition;os;android;cityID;gender;lastSeenPaging`).
