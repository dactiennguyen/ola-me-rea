## Tải về

| Máy | File |
|---|---|
| macOS chip Apple (M1 trở lên) | `ola-desktop_{{VERSION}}_macos_aarch64.dmg` |
| macOS chip Intel | `ola-desktop_{{VERSION}}_macos_x64.dmg` |
| Windows 10/11 | `ola-desktop_{{VERSION}}_windows_x64-setup.exe` (bộ cài), `ola-desktop_{{VERSION}}_windows_x64.msi`, hoặc `ola-desktop_{{VERSION}}_windows_x64_portable.exe` (chạy luôn, không cài) |
| Ubuntu, Debian | `ola-desktop_{{VERSION}}_linux_x64.deb` |
| Fedora, RHEL | `ola-desktop_{{VERSION}}_linux_x64.rpm` |
| Linux khác | `ola-desktop_{{VERSION}}_linux_x64.AppImage`: `chmod +x` rồi chạy |

Bản `.app.zip` là app macOS dạng nén, dùng khi không muốn mở file `.dmg`. Kiểm tra file tải về bằng `SHA256SUMS.txt` (`shasum -a 256 -c SHA256SUMS.txt --ignore-missing`).

## Bản này chưa ký số

- **macOS** báo "app bị hỏng", "không thể mở" hoặc không xác minh được nhà phát triển: kéo `Ola Desktop.app` vào Applications, rồi chạy một lần trong Terminal:
  ```bash
  xattr -cr "/Applications/Ola Desktop.app"
  ```
  Hoặc mở *System Settings › Privacy & Security* và bấm **Open Anyway**.
- **Windows** hiện "Windows protected your PC": bấm **More info** → **Run anyway**.

## Lưu ý

App không chính thức. Tài khoản và mật khẩu được lưu dạng JSON trên máy (quyền 600), không gửi đi đâu ngoài server Ola. Nhắn tin realtime cần **socket key** trong *Quản lý tài khoản › Cài đặt*.
