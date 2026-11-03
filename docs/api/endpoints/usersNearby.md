# napi/users/nearby

Lấy **danh sách người dùng ở gần** một toạ độ — màn *Quanh đây* (nearby). `[Suy luận/AOT]`

## Method + path

`GET https://sgdev.vip/napi/users/nearby?lat=<lat>&lng=<lng>&gender=<gender>&page=<page>`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Người gọi xác định qua Bearer token — không có `uid` trong query.

## Query params

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `lat` | number | vĩ độ vị trí hiện tại (bắt buộc) | `[Suy luận/AOT]` |
| `lng` | number | kinh độ vị trí hiện tại (bắt buộc) | `[Suy luận/AOT]` |
| `gender` | number | bộ lọc giới tính (tuỳ chọn) | `[Suy luận]` — chưa xác minh bảng mã |
| `page` | number | trang phân trang, mặc định `0` | `[Suy luận]` |

Ví dụ query:

```json
{ "lat": 10.776, "lng": 106.7, "gender": 1, "page": 0 }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts usersNearby --lat 10.776 --lng 106.7 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến danh sách user kèm khoảng cách; chưa có shape thực. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/usersNearby.ts`](../../../scripts/nodejs/src/endpoints/usersNearby.ts). Thiếu `lat`/`lng` sẽ báo lỗi trước khi gửi; `page` mặc định `0`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { usersNearby } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(usersNearby, { lat: 10.776, lng: 106.7, gender: 1, page: 0 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts usersNearby --lat <lat> --lng <lng> [--gender <g>] [--page <n>]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- `work/api_inventory.csv:129` — `ola_flutter_features_nearby_nearby_provider.dart:834` keys `lat;lng;gender;page` (GET).
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
