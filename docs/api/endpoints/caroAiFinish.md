# napi/caro/ai/finish

Kết thúc một ván **Caro đấu AI** đã mở bằng [`napi/caro/ai/start`](./caroAiStart.md): gửi lại chuỗi nước đi để server chấm thắng/thua và ghi điểm. Màn *Mini game — Caro*, chế độ đấu máy. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/napi/caro/ai/finish`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `gameId` | string | mã ván lấy từ response của `napi/caro/ai/start` (bắt buộc) | `[Suy luận/AOT]` |
| `moves` | array | danh sách nước đi của ván (cấu trúc phần tử là suy luận — vd cặp toạ độ) | `[Suy luận/AOT]` |

```json
{ "gameId": "<gameId>", "moves": [[7, 7], [8, 8], [7, 8]] }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts caroAiFinish --gameId <gameId> --moves "[[7,7],[8,8]]" --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/caroAiFinish.ts`](../../../scripts/nodejs/src/endpoints/caroAiFinish.ts). Thiếu `gameId` hoặc `moves` (mảng) sẽ báo lỗi trước khi gửi.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { caroAiFinish } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const result = await ola.call(caroAiFinish, { gameId: '<gameId>', moves: [[7, 7], [8, 8]] });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts caroAiFinish --gameId <gameId> --moves "[[7,7],[8,8]]"` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — chốt kết quả ván và ghi điểm/thống kê Caro lên server. Đừng gọi tùy tiện; chỉ gọi khi thật sự kết thúc một ván.

## Bằng chứng

- Static: `work/api_inventory.csv:99` — `ola_flutter_features_caro_caro_api.dart:261`, keys `gameId;moves`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
