# napi/reward/checkReward

**Kiểm tra / nhận phần thưởng** sau khi xác minh khuôn mặt (liveness · face-compare KYC). `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/napi/reward/checkReward`

Auth: cần đủ bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | UID chủ tài khoản (mặc định `<uid>` đăng nhập) | `[Suy luận/AOT]` |
| `condition` | number | mã điều kiện thưởng (chọn loại/điều kiện reward) — kiểu số là suy đoán theo quy ước `condition` ở các endpoint khác | `[Suy luận]` — chưa xác minh kiểu/giá trị |

Ví dụ body (đã redact):

```json
{ "uid": "<uid>", "condition": 1 }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts rewardCheckReward --condition 1 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/rewardCheckReward.ts`](../../../scripts/nodejs/src/endpoints/rewardCheckReward.ts). Thiếu `condition` sẽ báo lỗi trước khi gửi; `uid` mặc định là tài khoản đăng nhập. `is_success`/`success` bằng false **không** bị coi là lỗi (có thể chính là câu trả lời "không"), nên `ola.call()` trả response thô — tự đọc cờ trong kết quả.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { rewardCheckReward } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(rewardCheckReward, { condition: 1 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts rewardCheckReward --condition <mã> [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — có thể ghi nhận/nhả thưởng cho tài khoản (đổi số dư/trạng thái). Đừng gọi tùy tiện.

## Bằng chứng

- `work/api_inventory.csv:126` — `ola_flutter_features_liveness_face_compare_provider.dart:251` keys `uid;condition`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
