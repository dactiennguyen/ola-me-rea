# napi/caro/ai/start

Mở một ván **Caro (cờ caro / gomoku) đấu với AI** — màn *Mini game — Caro*, chế độ đấu máy. Server trả `gameId` + thế cờ ban đầu để client tiếp tục ván. `[Suy luận/AOT]`

## Method + path

`POST https://sgdev.vip/napi/caro/ai/start`

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `difficulty` | number | mức độ AI (bắt buộc; kiểu int là suy luận) | `[Suy luận/AOT]` |
| `humanFirst` | boolean | người chơi đi trước hay không (mặc định client suy luận `true`) | `[Suy luận/AOT]` |

```json
{ "difficulty": 2, "humanFirst": true }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts caroAiStart --difficulty 2 --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. Dự kiến trả `gameId` dùng cho [`napi/caro/ai/finish`](./caroAiFinish.md). `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/caroAiStart.ts`](../../../scripts/nodejs/src/endpoints/caroAiStart.ts). Thiếu `difficulty` sẽ báo lỗi trước khi gửi; `humanFirst` mặc định `true`.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { caroAiStart } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const game = await ola.call(caroAiStart, { difficulty: 2, humanFirst: true });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts caroAiStart --difficulty 2 [--humanFirst false]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

**Mutate** — tạo một ván Caro mới trên server (ghi state ván đấu). Đừng gọi tùy tiện; mỗi lần gọi mở một ván mới.

## Bằng chứng

- Static: `work/api_inventory.csv:100` — `ola_flutter_features_caro_caro_api.dart:582`, keys `difficulty;humanFirst`.
- Không có trong `work/api_runtime_inventory.csv` → chưa quan sát trên dây.
