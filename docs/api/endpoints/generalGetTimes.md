# napi/general/getTimes

Lấy **thời gian server** (Unix giây) để ký header mọi request. Chạy ngay khi mở app, **trước khi đăng nhập**, và là bước đầu của chuỗi khởi động. Xem [luồng đăng nhập & khởi động](../luong-dang-nhap-khoi-dong.md).

## Method + path

`GET https://sgdev.vip/napi/general/getTimes`

**Auth:** bộ header ký chung (`key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`; **chưa cần** `Authorization`). Xem [header xác thực](../auth-va-header.md). `serverTime` trả về chính là giá trị `timestamp` dùng để tính `hash` cho các call sau.

## Request

GET không có tham số và không có body.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| – | – | Không có | `work/api_runtime_inventory.csv` (BodyKeys trống) + `runtime_capture_session.log #1` [Quan sát] |

## Response

[Quan sát] — `login.ts` đọc thành công `serverTime` từ endpoint này ở mọi lần ký request.

| key | kiểu | ý nghĩa |
|---|---|---|
| `serverTime` | number | Unix epoch **giây** của server |

```json
{ "serverTime": 1793703038 }
```

Các key khác (nếu có) chưa được bắt đầy đủ. [Chưa xác minh] phần còn lại của shape.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/generalGetTimes.ts`](../../../scripts/nodejs/src/endpoints/generalGetTimes.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { generalGetTimes } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(generalGetTimes); // { serverTime: ... }
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts generalGetTimes` (thêm `--dry-run` để chỉ in request)

> Lưu ý: `OlaClient` đã tự gọi `getTimes` (`serverTime()` trong `src/client.ts`, một lần mỗi client, ký bằng giờ máy) để lấy giờ server ký mọi request. Gọi `ola.call(generalGetTimes)` là gọi lại cùng endpoint một cách tường minh để quan sát response; request này được ký bằng giờ server như mọi call khác.

## Bằng chứng

- `work/api_inventory.csv`: `napi/general/getTimes,GET,ola_flutter_features_login_auth_provider.dart,724,` (không key).
- `work/api_runtime_inventory.csv`: `GET,napi/general/getTimes,–,khởi động (trước login)`.
- `work/runtime_capture_session.log` #1: `GET https://sgdev.vip/napi/general/getTimes`, wire hdrs chỉ có `deviceid/timestamp/hash` (không `Authorization`).
- `scripts/nodejs/src/client.ts` `serverTime()` đọc `times.serverTime`.
