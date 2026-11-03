# faApi2/updateUserInfo.php

Cập nhật **một trường** hồ sơ/cài đặt theo kiểu key/value cho tài khoản đang đăng nhập (màn *Chỉnh sửa hồ sơ* và *Cài đặt*). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/updateUserInfo.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

Có **hai biến thể call-site** dùng chung một path:

### Biến thể 1 — hồ sơ (profile_provider.dart:3739)

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `condition` | string | tên trường cần đổi (vd `bio`, `name`, `address`…) | `[Suy luận/AOT]` |
| `value` | string/number/bool | giá trị mới của trường | `[Suy luận/AOT]` — chưa xác minh kiểu |
| `uid` | string | UID chủ tài khoản (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |

### Biến thể 2 — cài đặt (local_settings_provider.dart:2204)

Giống biến thể 1, thêm một cờ:

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `isHideFollow` | bool | cờ ẩn danh sách theo dõi (gửi kèm khi đổi quyền riêng tư) | `[Suy luận/AOT]` |

Ví dụ body (đã redact):

```json
{ "condition": "bio", "value": "Xin chào", "uid": "<uid>" }
```

```json
{ "condition": "hideFollow", "value": true, "isHideFollow": true, "uid": "<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts updateUserInfo --condition bio --value "Xin chào" --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/updateUserInfo.ts`](../../../scripts/nodejs/src/endpoints/updateUserInfo.ts). Thiếu `condition`/`value` sẽ báo lỗi trước khi gửi; `value` là string/number/boolean, `uid` mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { updateUserInfo } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(updateUserInfo, { condition: 'bio', value: 'Xin chào' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts updateUserInfo --condition bio --value "Xin chào" [--isHideFollow] [--uid <uid>]` (thêm `--dry-run` để chỉ in request). `--value` trên CLI luôn là chuỗi; cần số/boolean thì dùng `--json '{"value":true}'`.

## ⚠️ Tác dụng phụ

**Mutate** — ghi đè trường hồ sơ/cài đặt trên server. Đừng gọi tùy tiện; mỗi lần gọi là một thay đổi thật.

## Bằng chứng

- `work/api_inventory.csv:95` — `profile_provider.dart:3739` keys `condition;uid;value`
- `work/api_inventory.csv:96` — `local_settings_provider.dart:2204` keys `condition;isHideFollow;uid;value`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
