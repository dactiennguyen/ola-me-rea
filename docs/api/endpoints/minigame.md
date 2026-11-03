# napi/minigame/{gameKey}/…

Endpoint **MIXED** cho kho mini game (Bay lên/`flappy`, Kẹo ngọt/`sweet`, …) — màn *Mini game*. Hai hành động trên cùng gốc `napi/minigame/{gameKey}`:

- **GET** `napi/minigame/{gameKey}/leaderboard` — bảng xếp hạng một game (read) · `[Quan sát]`
- **POST** `napi/minigame/{gameKey}/score` — nộp điểm một ván (mutate) · `[Chưa xác minh]`

`gameKey` là khoá game (vd `flappy`, `sweet`). Xem thêm [endpoint-runtime.md](../endpoint-runtime.md).

## Method + path

| action | method | path |
|---|---|---|
| leaderboard | GET | `https://sgdev.vip/napi/minigame/{gameKey}/leaderboard` |
| score | POST | `https://sgdev.vip/napi/minigame/{gameKey}/score` *(hậu tố `/score` là suy luận)* |

Auth: bộ [header xác thực](../auth-va-header.md) (Bearer + `key2`/`timestamp`/`hash`/`deviceid`/`os`/`ver`).

## Request body

### GET leaderboard

Tham số qua query string. Phiên bắt trên dây gọi trần (không query); `limit` là suy luận.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `limit` | number | số dòng tối đa (tuỳ chọn) | `[Suy luận]` |

```
GET /napi/minigame/flappy/leaderboard
GET /napi/minigame/sweet/leaderboard?limit=10
```

### POST score `[Chưa xác minh]`

AOT chỉ cho path gốc `napi/minigame/` (dòng 1317 = POST), **không liệt kê key nào**. Hậu tố `/score` và body dưới là **suy luận**, phải xác minh lại trên dây trước khi tin.

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `score` | number | điểm của ván vừa chơi (bắt buộc) | `[Chưa xác minh]` |

```json
{ "score": 1234 }
```

## Response

**Chưa bắt response** — `work/api_runtime_inventory.csv:40-41` xác nhận method GET cho `flappy`/`sweet` leaderboard nhưng không ghi response; nhánh POST score chưa quan sát trên dây. Chạy `node scripts/nodejs/ola.ts minigameLeaderboard --gameKey flappy --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. `[Chưa xác minh]`

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/minigame.ts`](../../../scripts/nodejs/src/endpoints/minigame.ts).

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { minigameLeaderboard, minigameScore } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  // GET bảng xếp hạng
  const board = await ola.call(minigameLeaderboard, { gameKey: 'flappy', limit: 10 });

  // POST nộp điểm (mutate) — path/body [Chưa xác minh]
  const res = await ola.call(minigameScore, { gameKey: 'flappy', score: 1234 });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts minigameLeaderboard --gameKey flappy [--limit 10]` (leaderboard) và `node scripts/nodejs/ola.ts minigameScore --gameKey flappy --score 1234` (nộp điểm) (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

Nhánh **POST score** là **mutate** — ghi điểm/bảng xếp hạng lên server. Đừng gọi tùy tiện; ngoài ra path `/score` + body chưa được xác minh nên có thể sai, cần bắt trên dây trước. Nhánh GET leaderboard là read, an toàn.

## Bằng chứng

- Runtime: `work/api_runtime_inventory.csv:40-41` — GET `napi/minigame/flappy/leaderboard`, `napi/minigame/sweet/leaderboard` (flow "Mini game — Bay lên" / "Kẹo ngọt") → mẫu `napi/minigame/{gameKey}/leaderboard`.
- Static: `work/api_inventory.csv:109-112` — `ola_flutter_features_minigame_minigame_score_api.dart` (dòng 604/960/1159 GET, 1317 POST), path gốc `napi/minigame/`, không có key.
