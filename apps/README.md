# Ola Desktop

App desktop (Tauri 2 + React + TypeScript) để quản lý nhiều tài khoản Ola và dùng các tính năng nhắn tin: **danh sách tin nhắn, chat 1-1, Khám phá, phòng chat theo tỉnh/thành**. App không chính thức, dựng trên client đã điều tra trong repo này (`scripts/nodejs/src`). Giao diện theo hướng design **C · Đêm chuyên nghiệp**.

| Tài liệu | Nội dung |
|---|---|
| [01 · Kiến trúc](docs/01-kien-truc.md) | Stack, phần Rust, dùng chung lõi với `scripts/nodejs`, file dữ liệu JSON, bảo mật Tauri |
| [02 · Tính năng](docs/02-tinh-nang.md) | Từng màn hình: API/socket nào được gọi, hành vi, giới hạn |
| [03 · Lộ trình](docs/03-lo-trinh.md) | Đã làm, còn thiếu (socket key…), rủi ro, câu hỏi mở |
| [04 · Design](docs/04-design.md) | Token màu, chữ, thành phần của hướng C |
| [05 · CI/CD và phát hành](docs/05-phat-hanh.md) | Workflow build/release, cách ra bản mới (tag `v*`), file cài đặt, ký ứng dụng |

## Yêu cầu

- Node.js **22.18+** (nên 24 LTS) và Yarn 1 (`packageManager: yarn@1.22.22`). Máy chưa có lệnh `yarn` thì chạy `corepack enable` một lần, hoặc gõ `corepack yarn …` thay cho `yarn …`.
- Rust stable (đã kiểm tra với 1.90) — cài bằng [rustup](https://rustup.rs).
- macOS: Xcode Command Line Tools. Windows: WebView2 + MSVC build tools. Linux: các gói WebKitGTK theo [hướng dẫn Tauri](https://v2.tauri.app/start/prerequisites/).

## Chạy

```bash
cd apps
yarn install
yarn app:dev           # mở cửa sổ app (Vite dev server + Tauri)
```

`.yarnrc` trong thư mục này bật `ignore-engines`: Firebase 13 khai báo Node ≥ 24.12, nhưng trong app Firebase chạy trong webview; Node chỉ chạy Vite, `tsc` và Tauri CLI.

Build bản cài đặt:

```bash
yarn app:build         # .app/.dmg trên macOS, .msi/.exe trên Windows; nằm trong src-tauri/target/release/bundle/
```

Kiểm tra nhanh:

```bash
yarn typecheck         # TypeScript (gồm cả lõi scripts/nodejs/src mà app import)
yarn build             # bundle frontend vào dist/
(cd src-tauri && cargo build)
(cd ../scripts/nodejs && node --test "test/**/*.test.ts")   # test của lõi dùng chung
```

`yarn dev` mở được giao diện trong trình duyệt để chỉnh UI, nhưng gọi API Ola sẽ lỗi CORS: request chỉ chạy qua Tauri http plugin.

## Lần chạy đầu

1. **Quản lý tài khoản › Thêm tài khoản**: nhập email + mật khẩu Ola (tài khoản email/mật khẩu đã xác minh). Mỗi tài khoản có một Device ID riêng, tự sinh.
2. **Lưu và đăng nhập**: app đăng nhập Firebase, gọi `napi/users/sync`, rồi mở Tin nhắn.
3. **Cài đặt › Socket key**: cần cho nhắn tin realtime (gửi/nhận tin, đang gõ, người trong phòng). Key này **chưa được khôi phục** từ app gốc, xem [Lộ trình §Socket key](docs/03-lo-trinh.md#socket-key). Khi chưa có key, các màn đọc dữ liệu vẫn chạy (danh sách hội thoại, Khám phá, lịch sử phòng, thành viên) nhưng ô nhập tin bị khoá.
4. Muốn thử giao diện gửi tin mà không gửi thật: bật **Chế độ thử** trong Cài đặt.

Tài khoản được lưu dạng **JSON thường, kể cả mật khẩu** (theo yêu cầu, không dùng Keychain) trong thư mục dữ liệu của app, quyền `600`:

| Hệ điều hành | Thư mục |
|---|---|
| macOS | `~/Library/Application Support/dev.olamerea.desktop/` |
| Windows | `%APPDATA%\dev.olamerea.desktop\` |
| Linux | `~/.local/share/dev.olamerea.desktop/` |

## Cấu trúc

```text
apps/
├── index.html, vite.config.ts, tsconfig.json, package.json, yarn.lock, .yarnrc
├── src/
│   ├── main.tsx, App.tsx, styles.css      # khung app + token design C
│   ├── lib/
│   │   ├── session.tsx      # tài khoản đang dùng, OlaClient, kênh realtime cá nhân
│   │   ├── accounts.ts      # accounts.json
│   │   ├── settings.ts      # settings.json (server, socket key, chế độ thử)
│   │   ├── messageCache.ts  # chat-<uid>.json: lịch sử 1-1 trên máy
│   │   ├── platform.ts      # fetch của Tauri, file JSON, lệnh Rust
│   │   ├── provinces.ts     # danh sách phòng = mã tỉnh
│   │   └── format.ts
│   ├── components/          # Sidebar, Avatar, MessageList, Composer, Icon
│   └── screens/             # Messages, Explore, Rooms, Accounts
└── src-tauri/
    ├── Cargo.toml, build.rs, tauri.conf.json
    ├── capabilities/default.json   # quyền: http chỉ tới https://sgdev.vip/*, store
    ├── icons/
    └── src/lib.rs, main.rs         # plugin http + store, lệnh data_dir / restrict_data_file
```

Lõi gọi API (đăng nhập, ký request, endpoint, Socket.IO, payload chat) **không nằm trong app**: app import thẳng `scripts/nodejs/src` qua alias `@ola/core`, nên CLI Node và app desktop luôn dùng cùng một code đã có test.
