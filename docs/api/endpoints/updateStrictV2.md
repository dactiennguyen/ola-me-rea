# faApi2/updateStrictV2.php

Cập nhật nhãn/điểm **"strict"** (kiểm duyệt vi phạm) của một người dùng — màn hồ sơ và màn *Danh sách vi phạm* (ViolationList). Là hành động kiểm duyệt, thường cần quyền admin. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/faApi2/updateStrictV2.php`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

Có **hai biến thể call-site**:

### Biến thể 1 — hồ sơ (profile_provider.dart:4630)

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `label` | string | nhãn vi phạm/strict | `[Suy luận/AOT]` |
| `score` | number | điểm strict | `[Suy luận/AOT]` |
| `uid` | string | UID người bị chấm strict (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `admin` | string | định danh admin thực hiện | `[Suy luận/AOT]` |
| `photoURL` | string | ảnh kèm theo (bằng chứng) | `[Suy luận/AOT]` |

### Biến thể 2 — danh sách vi phạm (ViolationListScreen.dart:2191)

Giống biến thể 1, thêm:

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `action` | string | hành động áp dụng (vd cảnh cáo/khoá…) | `[Suy luận/AOT]` |

Client chỉ gửi `admin`/`photoURL`/`action` khi caller truyền vào; `label`+`score`+`uid` luôn có.

Ví dụ body (đã redact):

```json
{ "label": "spam", "score": 3, "uid": "<uid>", "admin": "<uid>", "photoURL": "", "action": "warn" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts updateStrictV2 --label spam --score 3 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/updateStrictV2.ts`](../../../scripts/nodejs/src/endpoints/updateStrictV2.ts). Thiếu `label`/`score` sẽ báo lỗi trước khi gửi; `uid` mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { updateStrictV2 } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(updateStrictV2, {
    label: 'spam', score: 3, uid: '<target-uid>', action: 'warn',
  });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts updateStrictV2 --label spam --score 3 [--admin <uid>] [--photoURL <url>] [--action warn] [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — ghi nhãn/điểm strict lên hồ sơ người dùng trên server (ảnh hưởng kiểm duyệt). Đừng gọi tùy tiện; nhiều khả năng cần quyền admin.

## Bằng chứng

- `work/api_inventory.csv:93` — `profile_provider.dart:4630` keys `label;admin;uid;photoURL;score`
- `work/api_inventory.csv:94` — `ViolationListScreen.dart:2191` keys `label;admin;uid;photoURL;score;action`
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
