# faApi2/addIgnoreMess.php

Bỏ qua / ẩn một tin nhắn trong phòng chat theo định danh tin. Thuộc `room_provider` (màn phòng chat). Xem [luồng phòng chat](../luong-phong-chat.md).

**Method + path:** `POST https://sgdev.vip/faApi2/addIgnoreMess.php`

**Auth:** Bearer Firebase + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver` — xem [header xác thực](../auth-va-header.md).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `id` | string | Định danh tin nhắn cần bỏ qua (dạng `"<ms_timestamp><uid>"` như tin phòng) | [Suy luận] AOT |

```json
{ "id": "1793703706157<uid>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts addIgnoreMess --id <id> --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/addIgnoreMess.ts`](../../../scripts/nodejs/src/endpoints/addIgnoreMess.ts). Thiếu `id` sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { addIgnoreMess } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(addIgnoreMess, { id: '1793703706157<uid>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts addIgnoreMess --id 1793703706157<uid>` (thêm `--dry-run` để chỉ in request)

⚠️ **Tác dụng phụ:** thay đổi trạng thái tin nhắn trên server (ẩn/bỏ qua) — đừng gọi tùy tiện.

## Bằng chứng

- [Suy luận] `work/api_inventory.csv`: `ola_flutter_features_room_room_provider.dart:4049` (`id`). Chưa bắt trên dây trong phiên 2026-11-03 → ý nghĩa `id` suy từ ngữ cảnh tin phòng. [Chưa xác minh]
