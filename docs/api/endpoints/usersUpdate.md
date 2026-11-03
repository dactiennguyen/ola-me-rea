# napi/users/update

**Cập nhật hồ sơ** tài khoản đang đăng nhập — màn *Chỉnh sửa hồ sơ*. Cập nhật từng phần: client chỉ gửi những field thay đổi. `[Suy luận/AOT]`

## Method + path

`PUT https://sgdev.vip/napi/users/update`

> Đây là endpoint **PUT** duy nhất trong nhóm; client khai báo `method: 'PUT'` trong định nghĩa endpoint.

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`). Người gọi xác định qua Bearer token — không gửi `uid`.

## Request body

Tất cả field đều **tuỳ chọn**; phải có ít nhất một field. Chỉ gửi field cần đổi.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `name` | string | tên hiển thị | `[Suy luận/AOT]` |
| `birth_year` | number | năm sinh | `[Suy luận]` — kiểu số là suy đoán |
| `gender` | number | giới tính (mã số) | `[Suy luận]` — chưa xác minh bảng mã |
| `location` | string | nơi ở / vị trí | `[Suy luận/AOT]` |
| `job` | string | nghề nghiệp | `[Suy luận/AOT]` |
| `introduceText` | string | lời giới thiệu bản thân | `[Suy luận/AOT]` |

Ví dụ body:

```json
{ "name": "Phong", "birth_year": 1995, "gender": 0, "introduceText": "hi" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts usersUpdate --name Phong --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/usersUpdate.ts`](../../../scripts/nodejs/src/endpoints/usersUpdate.ts). Phải có ít nhất một field, nếu không sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { usersUpdate } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(usersUpdate, { name: 'Phong', birth_year: 1995, introduceText: 'hi' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts usersUpdate [--name <ten>] [--birth_year <năm>] [--gender <mã>] [--location <nơi>] [--job <nghề>] [--introduceText <giới thiệu>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — ghi đè thông tin hồ sơ thật trên server. Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:133` — `dio_src_dio_dio_for_native.dart:4556` xác nhận method `PUT`.
- `work/api_inventory.csv:134` — `ola_flutter_features_profile_sub_edit_provider.dart:410` keys `name;birth_year;gender;location;job;introduceText`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây (các dòng `users/update*` trong log capture là `users/updateLastSeen`, endpoint khác).
