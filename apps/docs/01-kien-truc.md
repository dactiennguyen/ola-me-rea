# 01 · Kiến trúc

## Stack

| Lớp | Công nghệ | Ghi chú |
|---|---|---|
| Khung app | Tauri **2** (stable; Tauri 3 còn alpha) | Cửa sổ native + webview hệ điều hành (WebKit trên macOS) |
| Giao diện | React 19 + TypeScript + Vite 8 | Không dùng thư viện state/UI ngoài; CSS thuần theo token design C |
| Font | Inter Variable (`@fontsource-variable/inter`) | Đóng gói cùng app, có subset tiếng Việt, không tải mạng |
| Gọi API Ola | `@tauri-apps/plugin-http` | `fetch` chạy phía Rust nên không bị CORS; scope chỉ `https://sgdev.vip/*` |
| Đăng nhập | Firebase JS SDK 13 (email/mật khẩu) | Chạy trong webview, persistence trong bộ nhớ |
| Realtime | `socket.io-client` **2.5.0** | Server dùng Engine.IO v3 (`EIO=3`); client 3.x/4.x không kết nối được |
| Lưu trữ | `@tauri-apps/plugin-store` | File JSON trong thư mục dữ liệu app |
| Rust | `tauri`, `tauri-plugin-http`, `tauri-plugin-store` | Khoảng 60 dòng, xem dưới |

## Sơ đồ

```text
┌──────────────────────── Tauri window (webview) ────────────────────────┐
│ React UI (src/screens, src/components)                                 │
│   │                                                                     │
│ session.tsx ── accounts.ts / settings.ts / messageCache.ts ──► plugin-store ──► *.json
│   │                                                                     │
│ @ola/core = scripts/nodejs/src  (dùng chung với CLI Node)               │
│   ├─ client.ts   OlaClient.login → Firebase (fetch của webview)        │
│   │              ola.call(endpoint) → ký header → apiFetch ─────────► plugin-http ──► https://sgdev.vip
│   ├─ endpoints/  getLastMessage2, getExplore*, getMessageByRoom, …     │
│   └─ chat.ts     ChatChannel(io từ socket.io-client 2.5) ─────────────────────────────► wss://sgdev.vip:3001
└─────────────────────────────────────────────────────────────────────────┘
Rust (src-tauri/src/lib.rs): đăng ký plugin http + store; lệnh data_dir, restrict_data_file
```

## Phần Rust

[`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) chỉ làm 3 việc:

1. `tauri_plugin_http::init()`: webview gọi `fetch` của plugin; request đi bằng HTTP client phía Rust, không qua chính sách CORS của webview. `sgdev.vip` không trả header CORS và cần các header tuỳ biến (`key2`, `hash`, `timestamp`, `deviceid`, `os`, `ver`), nên đây là cách duy nhất gọi API từ webview.
2. `tauri_plugin_store`: đọc/ghi file JSON trong thư mục dữ liệu app.
3. Lệnh:
   - `data_dir()` trả đường dẫn thư mục dữ liệu, để màn Cài đặt hiển thị.
   - `restrict_data_file(name)` chạy `chmod 600` sau mỗi lần ghi `accounts.json`/`settings.json`. Chỉ nhận đúng 2 tên file cố định, nên tham số không thể trỏ ra ngoài thư mục dữ liệu.
   - `export_accounts_file(name, content)` ghi file xuất danh sách tài khoản vào thư mục Downloads. Chỉ nhận tên `ola-accounts-YYYYMMDD-HHMMSS.json`, không ghi đè (trùng thì thêm `-2`, `-3`…), quyền 600 trên macOS/Linux.
   - `set_close_action(action)` / `close_window(action)` cho nút đóng cửa sổ và icon ở khay (`tray.rs`).

Quyền (capability) nằm ở [`capabilities/default.json`](../src-tauri/capabilities/default.json): `core:default`, `store:default`, `http:default` với `allow` chỉ `https://sgdev.vip/*`. CSP trong [`tauri.conf.json`](../src-tauri/tauri.conf.json) chỉ cho kết nối tới IPC của Tauri, Firebase Auth (`identitytoolkit`, `securetoken`), `sgdev.vip` và `wss://sgdev.vip:3001`; ảnh `https:`; không cho script ngoài.

Khi cần làm thêm phía Rust (ví dụ chạy nền, client Socket.IO riêng nếu server chặn Origin của webview), thêm lệnh vào `lib.rs` và gọi bằng `invoke()` từ `src/lib/platform.ts`.

## Dùng chung lõi với `scripts/nodejs`

App không chép code client. `vite.config.ts` đặt alias `@ola/core` → `../scripts/nodejs/src`, và `resolve.dedupe: ['firebase', 'zod']` để các import trần trong lõi lấy package từ `apps/node_modules`. `tsconfig.json` có `paths` tương ứng.

Để lõi chạy được trong webview, `scripts/nodejs/src` đã được tách:

| File | Môi trường | Vai trò |
|---|---|---|
| `defaults.ts` | Mọi nơi | Hằng số APK, `buildConfig(env)` áp biến `OLA_*`, kiểu `Account`, `OlaConfig`, `SocketConfig` |
| `md5.ts` | Mọi nơi | MD5 thuần TS cho header `hash` (Web Crypto không có MD5) |
| `client.ts`, `auth.ts`, `endpoints/`, `chat.ts` | Mọi nơi | `OlaClient.login({ account, config, firebaseConfig, fetch })` nhận mọi thứ qua tham số |
| `config.ts`, `node.ts` | Chỉ Node | Đọc `.env`, `loginFromEnv()` cho CLI |

Test `test/core.test.ts` duyệt đồ thị import từ `client.ts`, `chat.ts`, `endpoints/index.ts` và fail nếu chạm tới `node:*`, nên một thay đổi làm hỏng app desktop sẽ bị phát hiện ngay trong test của lõi.

## Đăng nhập một tài khoản

`session.tsx` → `OlaClient.login()` với:

- `account`: email/mật khẩu từ `accounts.json`.
- `config`: base URL + **thông tin thiết bị riêng của tài khoản**: Device ID, `key2`, app version, Android version (`olaConfigFor(account)` trong `accounts.ts`; mục để trống dùng mặc định của APK). `users/sync` đăng ký đúng Device ID và Android version đã ký.
- `fetch`: `apiFetch` (Tauri http plugin).

Sau đó `chatProfile()` chỉ lấy `displayName`, `photoURL`, `isVip`, `level`, `isVerifyAvatar` từ profile. Profile gốc **có key `password`** nên không bao giờ được lưu (xem [bao-mat-va-luu-y.md](../../docs/api/bao-mat-va-luu-y.md)).

Mỗi thời điểm chỉ có **một** tài khoản đăng nhập; đổi tài khoản sẽ đóng client và kênh realtime cũ. Lõi đã hỗ trợ nhiều phiên song song (mỗi lần login một Firebase app riêng) nếu sau này cần.

## Kênh realtime

| Kênh | `roomNo` | `add user` | Ai mở |
|---|---|---|---|
| Hộp thư cá nhân | uid của mình | `{username: uid, roomNo: uid}` [Suy luận] | `session.tsx`, suốt phiên |
| Chat 1-1 | uid người nhận | `{username: uid mình, roomNo: uid người nhận}` | `DirectChat`, khi mở hội thoại |
| Phòng | mã tỉnh | `{username: tên hiển thị, roomNo: mã}` | `RoomView`, khi ở trong phòng |

Mỗi kênh là một `ChatChannel` (lõi `chat.ts`): `forceNew`, chỉ websocket, query `key` + `roomNo`, tự kết nối lại (2 s → 30 s). Tin đến trên hộp thư cá nhân được ghi vào cache rồi phát cho màn Tin nhắn.

## File dữ liệu

Tất cả nằm trong thư mục dữ liệu app (macOS: `~/Library/Application Support/dev.olamerea.desktop/`).

`accounts.json`, quyền 600:

```json
{
  "data": {
    "version": 1,
    "activeId": "acc_1a2b3c4d5e6f",
    "accounts": [
      {
        "id": "acc_1a2b3c4d5e6f",
        "label": "Minh Anh",
        "email": "<email>",
        "password": "<mật khẩu, JSON thường>",
        "deviceId": "9f2c4e1a7b3d5f60",
        "androidVersion": "14",
        "color": "#0E7490",
        "uid": "<Firebase UID, điền sau khi đăng nhập>",
        "displayName": "<tên Ola>",
        "photoURL": "",
        "lastLoginAt": 1793737146000
      }
    ]
  }
}
```

Thiết bị của từng nick nằm trong tài khoản: `deviceId` (bắt buộc) và tuỳ chọn `appVersion`, `androidVersion`, `publicKey` (key2). Ba mục tuỳ chọn chỉ được lưu khi khác mặc định của APK (`olaDefaults` trong `defaults.ts`); thiếu thì dùng mặc định, theo đúng quy tắc của biến `OLA_*` ở CLI (`olaConfigFor()` gọi `buildConfig()`). Chúng được đọc lúc đăng nhập nên chỉ áp dụng từ lần đăng nhập sau. Ví dụ trên: nick dùng Android 14, còn app version và key2 theo mặc định.

`settings.json`, quyền 600, dùng chung mọi nick: `socketKey`, `dryRunSends`, `onClose`. File bản cũ có thêm `publicKey`/`appVersion`/`androidVersion` chung cho mọi nick: lần mở đầu tiên, giá trị nào khác mặc định được chép sang những nick chưa có giá trị riêng, rồi bị bỏ khỏi `settings.json`.

Máy chủ (`https://sgdev.vip/`, `https://sgdev.vip:3001`) **không** nằm trong Cài đặt: scope của http plugin và CSP chỉ cho đúng hai host đó, nên host khác sẽ bị chặn lúc chạy. Muốn đổi máy chủ phải sửa cùng lúc `capabilities/default.json`, CSP trong `tauri.conf.json` và `defaults.ts`.

`chat-<uid>.json`: lịch sử 1-1 trên máy cho từng tài khoản, mỗi hội thoại một key: `thread:<peerUid>` (tối đa 500 tin mới nhất, gộp theo `id`) và `peer:<peerUid>` (tên, ảnh). Các lần ghi vào cùng một file chạy lần lượt, nên tin đến cùng lúc ở hai kênh không ghi đè nhau. Server chỉ giữ **tin cuối** mỗi hội thoại, nên lịch sử 1-1 chỉ gồm những tin gửi/nhận qua app này.
