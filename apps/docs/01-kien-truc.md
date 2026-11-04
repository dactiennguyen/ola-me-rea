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
Rust (src-tauri/src/lib.rs): đăng ký plugin http + store; lệnh data_dir, restrict_data_file, …
Rust (src-tauri/src/socket.rs): WebSocket qua proxy cho nick có proxy (ws_open / ws_send / ws_close)
```

## Phần Rust

[`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) làm các việc sau:

1. `tauri_plugin_http::init()` (bật feature `socks`): webview gọi `fetch` của plugin; request đi bằng HTTP client phía Rust, không qua chính sách CORS của webview, và nhận tuỳ chọn `proxy` cho từng request. `sgdev.vip` không trả header CORS và cần các header tuỳ biến (`key2`, `hash`, `timestamp`, `deviceid`, `os`, `ver`), nên đây là cách duy nhất gọi API từ webview.
2. `tauri_plugin_store`: đọc/ghi file JSON trong thư mục dữ liệu app.
3. Lệnh:
   - `data_dir()` trả đường dẫn thư mục dữ liệu, để màn Cài đặt hiển thị.
   - `restrict_data_file(name)` chạy `chmod 600` sau mỗi lần ghi `accounts.json`/`settings.json`. Chỉ nhận đúng 2 tên file cố định, nên tham số không thể trỏ ra ngoài thư mục dữ liệu.
   - `export_accounts_file(name, content)` ghi file xuất danh sách tài khoản vào thư mục Downloads. Chỉ nhận tên `ola-accounts-YYYYMMDD-HHMMSS.json`, không ghi đè (trùng thì thêm `-2`, `-3`…), quyền 600 trên macOS/Linux.
   - `set_close_action(action)` / `close_window(action)` cho nút đóng cửa sổ và icon ở khay (`tray.rs`).
   - `ws_open(url, proxy, onEvent)` / `ws_send(id, data)` / `ws_close(id)` (`socket.rs`): WebSocket mở từ phía Rust, đi qua proxy HTTP (`CONNECT`) hoặc SOCKS5 (có user/pass), TLS bằng rustls + webpki-roots. Chỉ chuyển khung text; phần Engine.IO 3 / Socket.IO 2 nằm ở `src/lib/rustSocket.ts`.

Quyền (capability) nằm ở [`capabilities/default.json`](../src-tauri/capabilities/default.json): `core:default`, `store:default`, `http:default` với `allow` gồm `https://sgdev.vip/*`, Firebase Auth REST (`identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, dùng khi nick có proxy) và `https://api.ipify.org/*` (nút *Kiểm tra* proxy). CSP trong [`tauri.conf.json`](../src-tauri/tauri.conf.json) chỉ cho kết nối tới IPC của Tauri, Firebase Auth (`identitytoolkit`, `securetoken`), `sgdev.vip` và `wss://sgdev.vip:3001`; ảnh `https:`; không cho script ngoài.

Khi cần làm thêm phía Rust, thêm lệnh vào `lib.rs` và gọi bằng `invoke()` từ `src/lib/platform.ts`.

## Proxy theo từng nick

`StoredAccount.proxy` (URL đã chuẩn hoá bởi `parseProxy()` trong `src/lib/proxy.ts`: `http://`, `socks5://`, `socks5h://`, có thể kèm user/pass). Đọc lúc đăng nhập, như thông tin thiết bị.

| Kết nối | Nick **có** proxy | Nick **không** proxy |
|---|---|---|
| Firebase đăng nhập + làm mới token | REST `accounts:signInWithPassword`, `accounts:lookup`, `securetoken` qua `fetch` của plugin http với `proxy` (lõi: `firebaseRestLogin()`, `OlaClient.login({ firebaseFetch })`) | Firebase JS SDK trong webview |
| API Ola (`sgdev.vip`) | `fetch` của plugin http với `proxy` | `fetch` của plugin http |
| Socket (hộp thư, chat 1-1, phòng) | `rustIo(proxy)` → `socket.rs` | `socket.io-client` trong webview |

Không đi qua proxy: ảnh đại diện (thẻ `<img>` của webview tải thẳng từ host ảnh) và đăng ký / gửi lại email xác thực (Firebase SDK). Chạy trong trình duyệt (`yarn dev`) thì bỏ qua proxy.

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

## Đăng nhập: mọi tài khoản cùng lúc

`session.tsx` giữ một `LiveAccount` cho mỗi tài khoản. Mỗi `LiveAccount` gọi `OlaClient.login()` với:

- `account`: email/mật khẩu từ `accounts.json`.
- `config`: base URL + **thông tin thiết bị riêng của tài khoản**: Device ID, `key2`, app version, Android version (`olaConfigFor(account)` trong `accounts.ts`; mục để trống dùng mặc định của APK). `users/sync` đăng ký đúng Device ID và Android version đã ký.
- `fetch`: `apiFetch` (Tauri http plugin).

Sau đó `chatProfile()` chỉ lấy `displayName`, `photoURL`, `isVip`, `level`, `isVerifyAvatar` từ profile. Profile gốc **có key `password`** nên không bao giờ được lưu (xem [bao-mat-va-luu-y.md](../../docs/api/bao-mat-va-luu-y.md)).

**Nhiều tài khoản online cùng lúc, đăng nhập bằng tay.** Mở app **không** tự đăng nhập; mỗi nick đăng nhập khi bấm *Đăng nhập* của nick đó, hoặc *Đăng nhập tất cả* trong Quản lý tài khoản (tối đa 3 nick một lúc). Mỗi tài khoản có client, Firebase app (lõi đặt tên riêng cho mỗi lần login), kênh hộp thư cá nhân và cache tin riêng (`chat-<uid>.json`). Bấm *Đăng xuất* ở một nick thì đóng client + kênh của nick đó; các nick khác vẫn online. Nhập danh sách tài khoản không đăng nhập các nick mới.

Phía React:

- `SessionProvider` / `useSession()`: danh sách tài khoản, cài đặt, `live[id]` (trạng thái từng nick: `status`, `error`, `ola`, `me`, `realtime`), `connect(id)` / `connectAll()` / `disconnect(id)`, `select(id)`.
- `AccountProvider id` / `useAccount()` / `useOla()`: bọc màn hình của **một** nick. `App.tsx` dựng một `AccountView` (sidebar + Tin nhắn/Khám phá/Phòng chat/Thông tin) cho mỗi tài khoản và giữ chúng mounted suốt phiên; nick không được chọn chỉ bị ẩn, nên chat đang mở, tab và số tin chưa đọc của từng nick vẫn còn khi chuyển qua lại.
- `selectedId` (lưu là `activeId` trong `accounts.json`) chỉ là nick đang hiện trên màn hình; chọn nick khác **không** đăng nhập lại.

## Kênh realtime

| Kênh | `roomNo` | `add user` | Ai mở |
|---|---|---|---|
| Hộp thư cá nhân | uid của mình | `{username: uid, roomNo: uid}` [Suy luận] | `session.tsx`, mỗi nick đang online một kênh, suốt phiên |
| Chat 1-1 | uid người nhận | `{username: uid mình, roomNo: uid người nhận}` | `DirectChat`, khi mở hội thoại |
| Phòng | mã tỉnh | `{username: tên hiển thị, roomNo: mã}` | `RoomView`, khi ở trong phòng |

Mỗi kênh là một `ChatChannel` (lõi `chat.ts`): `forceNew`, chỉ websocket, query `key` + `roomNo`, tự kết nối lại (2 s → 30 s). Nick có proxy dùng `rustIo` thay `socket.io-client`, cùng giao diện `on/off/emit/connect/disconnect`. Tin đến trên hộp thư cá nhân được ghi vào cache rồi phát cho màn Tin nhắn.

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
