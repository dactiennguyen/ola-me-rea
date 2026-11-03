# 05 · CI/CD và phát hành

Build trên GitHub Actions và phát hành một bản mới. Làm theo cách của repo `co-lau-loan-the` (cùng ba workflow, cùng cách đặt tên file và phát hành), đổi npm sang yarn. Chưa có tự cập nhật, chưa ký số Apple hay Windows.

## CI/CD

| Workflow | Chạy khi | Làm gì |
|---|---|---|
| [build-matrix.yml](../../.github/workflows/build-matrix.yml) | push lên `main`, mở pull request vào `main`, hoặc bấm tay (Run workflow) | `scripts/nodejs`: `yarn typecheck`, `yarn test`. `apps`: `yarn typecheck`, `yarn build`, rồi `cargo fmt`, `cargo clippy -D warnings`, `cargo test` trên Ubuntu 22.04. Push và pull request chỉ chạy chừng đó. Khi phát hành (tag `v*`) hoặc bấm tay, test qua hết mới build app trên 4 máy song song (repo private tính phút macOS gấp 10). File build nằm 14 ngày trong mục Artifacts của lần chạy |
| [release.yml](../../.github/workflows/release.yml) | đẩy tag `v*` | Kiểm tra tag khớp version, gọi build-matrix.yml, rồi tạo GitHub Release gồm mọi file, `SHA256SUMS.txt` và [ghi chú cài đặt](../../.github/release-notes.md) (`{{VERSION}}` được thay bằng số phiên bản), kèm danh sách commit do GitHub sinh |
| [release-retry.yml](../../.github/workflows/release-retry.yml) | một lần chạy release.yml kết thúc | Nếu lần đó hỏng chỉ vì GitHub huỷ một job không cấp được máy, thì chạy lại các job bị huỷ, tối đa tới lần thứ 3 ([Chạy lại khi thiếu máy](#chạy-lại-khi-thiếu-máy)) |

Không workflow nào gọi tới server Ola: test của client dùng fetch/socket giả.

| Máy build | Target | File |
|---|---|---|
| `macos-latest` | `aarch64-apple-darwin` | `ola-desktop_<version>_macos_aarch64.dmg`, `.app.zip` |
| `macos-latest` (build chéo) | `x86_64-apple-darwin` | `ola-desktop_<version>_macos_x64.dmg`, `.app.zip` |
| `windows-latest` | `x86_64-pc-windows-msvc` | `ola-desktop_<version>_windows_x64-setup.exe`, `.msi`, `_portable.exe` (chạy không cần cài) |
| `ubuntu-22.04` | `x86_64-unknown-linux-gnu` | `ola-desktop_<version>_linux_x64.deb`, `.rpm`, `.AppImage` |

[stage-bundles.mjs](../../.github/scripts/stage-bundles.mjs) đổi tên file Tauri sinh ra theo một mẫu chung, vì tên gốc lẫn lộn `x64`, `amd64`, `x86_64`, `en-US` và có dấu cách của "Ola Desktop". Thiếu file nào thì job build lỗi.

## Phát hành một bản mới

Ví dụ 0.2.0:

1. Đặt `version` thành `0.2.0` trong [apps/package.json](../package.json). Đây là chỗ duy nhất: `tauri.conf.json` đọc version từ đó (`"version": "../package.json"`). `version` trong `Cargo.toml` là của crate Rust, không cần đổi. Nếu tag lệch với `package.json`, release dừng ngay.
   ```bash
   cd apps && yarn version --new-version 0.2.0 --no-git-tag-version
   ```
2. Commit với tiêu đề "Release 0.2.0", phần thân ghi những gì đã đổi. Rồi chạy:
   ```bash
   git tag v0.2.0 && git push origin main v0.2.0
   ```
3. Release hiện ra sau khi 4 bản build và bước publish xong (khoảng 15–25 phút khi chưa có cache). Bản đã publish không bao giờ bị ghi đè. Bản nháp do một lần chạy lỗi để lại thì bị thay.

Bấm tay **Run workflow** của build-matrix.yml để build thử cả 4 bản mà không phát hành; file nằm trong Artifacts của lần chạy. release.yml chỉ chạy trên tag `v*`.

### Chạy lại khi thiếu máy

- Đôi khi GitHub thiếu máy (hay gặp với macOS Apple Silicon): job chờ khoảng 15 phút rồi bị huỷ, ghi "The job was not acquired by Runner of type hosted even after multiple attempts". Bước publish cần đủ cả 4 bản nên bị bỏ qua.
- release-retry.yml chạy mỗi khi một lần chạy `Release` kết thúc. Lần đó phải hỏng (`failure`) và chưa tới lần thứ 3. Nó xem các job:
  - Có job lỗi thật (`failure`: test, build, publish): không chạy lại, vì chạy lại cũng lỗi như cũ.
  - Có job bị huỷ (`cancelled`): `gh run rerun --failed`, chạy lại các job bị huỷ và các job sau nó.
- Lần chạy bị huỷ bằng tay kết thúc là `cancelled` chứ không phải `failure`, nên không bị chạy lại.
- Nếu GitHub thiếu máy lâu hơn 3 lần chờ, mở lần chạy Release trong tab Actions và bấm **Re-run failed jobs**.

## Lưu ý

- **Chưa ký số Apple, Windows:**
  - macOS dùng chữ ký ad hoc (`bundle.macOS.signingIdentity: "-"` trong `tauri.conf.json`), nên lần đầu người dùng phải chạy `xattr -cr "/Applications/Ola Desktop.app"` hoặc bấm *Open Anyway* trong *Privacy & Security*.
  - Windows hiện cảnh báo SmartScreen.
  - Muốn ký thật thì cần chứng chỉ Apple Developer ID cùng các secret `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` ([hướng dẫn Tauri](https://v2.tauri.app/distribute/sign/macos/)). build-matrix.yml được gọi với `secrets: inherit`, nên chỉ cần thêm các biến đó vào bước `tauri build`.
- **Tên file và mô tả trong bộ cài chỉ dùng ASCII:** WiX (`.msi`) chỉ nhận ký tự trong code page 1252, nên `shortDescription` viết tiếng Anh. `productName` "Ola Desktop" không dấu; gói `.deb`/`.rpm` mang tên `ola-desktop`.
- **Rust 1.90 cố định** trong CI, để một lint clippy mới của bản stable sau không tự làm hỏng build. **Node 24**, vì Firebase 13 của `scripts/nodejs` khai báo Node ≥ 24.12. Yarn 1.22.22 lấy qua Corepack (`packageManager`).
- **Đã thử trên máy (04/11/2026):** build macOS Apple Silicon bằng đúng lệnh của CI (`yarn tauri build --ci --target aarch64-apple-darwin --bundles app,dmg`), rồi chạy stage-bundles.mjs ra `.dmg` và `.app.zip`. App có chữ ký ad hoc hợp lệ (`codesign --verify --deep --strict`) và version lấy từ `package.json`. Bản Intel, Windows và Ubuntu chỉ build trên GitHub Actions và chưa có lần chạy nào.

## Repo phát hành riêng

Bản phát hành có thể nằm ở một repo public khác, để repo code chuyển sang private được.

- **Cấu hình** (repo code → Settings → Secrets and variables → Actions):
  - Variable `RELEASE_REPO` = `<owner>/<repo phát hành>` (repo đó cần có ít nhất một commit, ví dụ README, để tạo được tag).
  - Secret `RELEASE_TOKEN`: fine-grained token chỉ có quyền `Contents: Read and write` trên repo phát hành. `github.token` của workflow không ghi được sang repo khác.
- **Chưa có `RELEASE_REPO`:** release.yml phát hành vào chính repo code. Có `RELEASE_REPO` mà thiếu `RELEASE_TOKEN` thì bước phát hành dừng và báo lỗi.
- **Ở repo phát hành:** tag `v*` chưa có, nên `gh release create` tạo tag trên nhánh mặc định của repo đó, không dùng `--verify-tag` (tag đã được kiểm ở repo code) và `--generate-notes`.

## Chạy kiểm tra CI trên máy

```bash
(cd scripts/nodejs && yarn install --frozen-lockfile && yarn typecheck && yarn test)
(cd apps && yarn install --frozen-lockfile && yarn typecheck && yarn build)
(cd apps/src-tauri && cargo fmt --all --check && cargo clippy --all-targets --locked -- -D warnings && cargo test --locked)
```

Build bản cài trên máy như CI (macOS chip Apple):

```bash
cd apps && yarn tauri build --ci --target aarch64-apple-darwin --bundles app,dmg
cd .. && node .github/scripts/stage-bundles.mjs aarch64-apple-darwin staged
```
