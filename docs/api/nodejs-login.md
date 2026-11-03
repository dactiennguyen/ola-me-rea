# Client Node.js (TypeScript)

`scripts/nodejs/` là client gọi Ola API viết bằng TypeScript. Node.js **22.18+** chạy thẳng file `.ts` (type stripping), không cần bước build. Firebase JS SDK 13 (`@firebase/app`, `@firebase/auth`, `@firebase/ai`) khai báo cần Node **24.12+**; login đang chạy được trên Node 22.23 nhưng đó không phải bản SDK hỗ trợ chính thức, nên ưu tiên Node 24 LTS. Dependency: Firebase JS SDK, [zod](https://zod.dev) (kiểm tra input) và [commander](https://github.com/tj/commander.js) (CLI). Quản lý bằng Yarn.

## Cài đặt

```powershell
cd scripts/nodejs
corepack yarn install --ignore-engines   # chỉ cần trên Node 22: Firebase SDK 13 khai báo Node 24.12+
cp .env.example .env                    # rồi điền OLA_EMAIL / OLA_PASSWORD
```

Tài khoản **chỉ** nằm trong `scripts/nodejs/.env` (đã Git ignore) hoặc biến môi trường; không còn hard-code trong source. Biến tuỳ chọn: `OLA_DEVICE_ID` (mặc định `nodejs-probe`) — được ký vào header `deviceid` và đăng ký bởi `napi/users/sync`. Hằng số của app (Firebase config, `key2`, phiên bản app) nằm ở `src/config.ts`.

`package.json` ghim `yarn@1.22.22` qua `packageManager`, nên `corepack yarn` dùng đúng bản này. `node_modules/` được Git ignore.

## Lệnh

Chạy từ gốc repo (hoặc `corepack yarn <script>` trong `scripts/nodejs`):

```powershell
node scripts/nodejs/login.ts                  # đăng nhập + sync, in session/user/profile
node scripts/nodejs/login.ts --firebase-only

node scripts/nodejs/ola.ts list               # mọi endpoint: method, path, MUTATE, mô tả
node scripts/nodejs/ola.ts getCoins --help     # cờ của một endpoint
node scripts/nodejs/ola.ts getPostByID --postID 123 --dry-run
node scripts/nodejs/ola.ts getPostByID --postID 123

node scripts/nodejs/explore.ts --tab online --pages 2   # xem luong-kham-pha.md
```

CLI `ola`:

- Mỗi endpoint là một subcommand; **tên cờ = tên field trên wire** (`--postID`, `--birth_year`, `--transID`), giống bảng body trong `docs/api/endpoints/*.md`.
- Giá trị được đổi sang kiểu field nhận: `true`/`false` thành boolean nếu field nhận boolean (nên `--delAll false` gửi `false`, không phải chuỗi `"false"`), còn lại thử chuỗi, số, rồi JSON (`null`, object, mảng). Field boolean/scalar dùng được dạng cờ trần (`--isForever`, `--mark_all_read`). Field object nhận chuỗi JSON; `--json '{...}'` truyền cả input một lần (cờ riêng ghi đè) — dùng nó khi cần gửi chính xác chuỗi `"false"` hoặc số cho field nhận cả số lẫn chuỗi (vd `--json '{"uid":2}'`).
- Input được kiểm tra **trước** khi đăng nhập: thiếu field bắt buộc, sai kiểu, field lạ, cờ loại trừ nhau đều báo lỗi mà không tốn lượt đăng nhập/`users/sync`.
- `--dry-run` in đúng request sẽ ký và gửi (`{method, path, body|query}`), không đăng nhập, không gọi mạng; field mặc định theo session hiện là `SIGNED_IN_UID`.
- Server báo thất bại (`is_success` false ở `faApi2/`, `success` false ở `napi/`) thì in lỗi kèm response và trả exit code 1. Ngoại lệ: các endpoint hỏi–đáp mà cờ có thể chính là câu trả lời "không" (`checkEmail`, `checkBlockChat`, `checkUV2`, `check_update_app`, `rewardCheckReward`, `shouldLoadFeed`) trả response thô, không báo lỗi.

Đầu ra của `login.ts` chứa credential (ID token, refresh token); không đưa vào commit. Không có script nào tự ghi session ra đĩa.

## Dùng như thư viện

```ts
// Một file .ts trong scripts/nodejs/
import { OlaClient } from './src/client.ts';
import { getCoins, getPostByID } from './src/endpoints/index.ts';

const ola = await OlaClient.login();          // Firebase sign-in + napi/users/sync
try {
  const coins = await ola.call(getCoins);
  const post = await ola.call(getPostByID, { postID: '123' });   // input được type-check
} finally {
  await ola.close();                          // giải phóng Firebase SDK để process thoát
}

getPostByID.build(ola.session, { postID: '123' });   // chỉ dựng request, không gọi mạng
```

- `ola.call(endpoint, input)`: validate → ký → gửi → kiểm tra cờ thành công → parse. Lỗi input là `InputError`; server báo thất bại là `ApiError` (`error.response` giữ JSON gốc).
- `ola.request({ method, path, body, query })`: ký và gửi request thô.
- `ola.session` (`localId`, `email`, `idToken`, ...), `ola.user` (Firebase `user.toJSON()`), `ola.profile` (hồ sơ Ola từ sync).
- Mỗi request lấy ID token qua `firebaseUser.getIdToken()`, nên tiến trình chạy quá 1 giờ vẫn có token mới.
- Mỗi `OlaClient.login()` có Firebase app riêng, nên có thể đăng nhập hai tài khoản cùng lúc (vd A và B trong [workflow chat](vi-du-chat-nodejs.md)); `close()` của client này không ảnh hưởng client kia.
- `deviceId`/`ver` của `usersSync` lấy từ config của chính client (mặc định `olaConfig`), luôn trùng header `deviceid` mà client ký.
- Request được ký bằng giờ server. Client lấy độ lệch đồng hồ qua `napi/general/getTimes` **một lần** rồi dùng lại, thay vì gọi `getTimes` trước mỗi request.

## Luồng đăng nhập

1. Firebase JS SDK `signInWithEmailAndPassword` với persistence trong bộ nhớ. SDK tự gọi `accounts:signInWithPassword` và `accounts:lookup`.
2. Kiểm tra email đã xác minh, rồi lấy `napi/general/getTimes` để tính độ lệch giờ server.
3. Gọi `napi/users/sync` (endpoint `usersSync`) với Bearer ID token và [header ký](auth-va-header.md); `deviceId` trong body trùng header `deviceid`.
4. Kiểm tra UID hồ sơ Ola khớp Firebase UID.
5. `ola.close()` giải phóng SDK để process thoát.

Lỗi đăng nhập in mã SDK, ví dụ `Firebase sign-in failed (auth/invalid-credential).`

Firebase config lấy từ Android resources; `apiKey` là trường cần cho đăng nhập email. HTTP `key2` lấy từ native `publicKey`. Không cần `authDomain` cho luồng này. Mỗi lần chạy đều đăng nhập mới; app Android giữ phiên Firebase nên thường không hỏi lại mật khẩu.

## Cấu trúc

| File | Vai trò |
|---|---|
| `src/config.ts` | Hằng số app + đọc `.env` |
| `src/auth.ts` | Firebase sign-in / close |
| `src/signing.ts` | Header ký (`hash` = MD5(`timestamp-888` + deviceId + đoạn path cuối)), kiểm tra path |
| `src/http.ts` | fetch JSON, thông báo lỗi không lộ body/token |
| `src/client.ts` | `OlaClient`: login, sync, call, request |
| `src/endpoint.ts` | `defineEndpoint()` + helper field (`text`, `int`, `scalar`, `identifier`, `segment`, `extraFields`, `oneOf`) |
| `src/endpoints/*.ts` | Một khai báo cho mỗi endpoint; `index.ts` là registry sinh tự động |
| `src/cli.ts` | CLI `ola` sinh từ registry |
| `login.ts`, `ola.ts`, `explore.ts` | Entry point |
| `test/` | Unit test + golden test (`test/golden/*.json`) |

## Thêm endpoint

```ts
// src/endpoints/getCoinsDemo.ts
import { defineEndpoint, int, text } from '../endpoint.ts';

export const getCoinsDemo = defineEndpoint({
  name: 'getCoinsDemo',
  summary: 'Mô tả một dòng',
  method: 'POST',
  path: 'faApi2/getCoinsDemo.php',     // path động: 'napi/post/:postID/like' (+ field segment())
  mutates: false,                      // true nếu đổi trạng thái server
  session: { uid: 'localId' },         // field lấy mặc định từ tài khoản đăng nhập
  fields: { uid: text(), page: int().default(0) },
});
```

Field không khai báo bị từ chối. Body/query mặc định là chính các field (trừ path param); dùng `validate` cho ràng buộc giữa các field, `request` khi body cần tính toán, `success: false` khi cờ thành công bằng false vẫn là câu trả lời bình thường, `parse` để chuyển response. Sau đó chạy `corepack yarn gen:index` để cập nhật registry, thêm `test/golden/<tên>.json`, rồi `corepack yarn typecheck && corepack yarn test`.

## Kiểm tra

```powershell
cd scripts/nodejs
corepack yarn typecheck   # tsc --noEmit
corepack yarn test        # node --test; GOLDEN=getCoins,addCoins3 để chỉ chạy vài endpoint
```

Golden test so request mà mỗi endpoint dựng với request mà client JS cũ (trước refactor) dựng cho cùng input, và kiểm tra các input mà bản cũ để lọt (placeholder `<...>`, path `..`, `extra` ghi đè field, cờ loại trừ nhau) nay bị từ chối. Toàn bộ test chạy offline với `fetch` giả; refactor sang TypeScript chưa được chạy đăng nhập live.

Xem [workflow chat](vi-du-chat-nodejs.md) để hiểu dữ liệu cần cho gửi tin.
