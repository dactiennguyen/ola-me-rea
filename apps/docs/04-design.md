# 04 · Design: hướng C "Đêm chuyên nghiệp"

Chọn từ 3 hướng trên canvas [Ola Desktop — Chọn design & màu sắc](https://claude.ai/artifact/GbTYBRihtECGJ8MA4hTHhd) (A · Xanh tin cậy, B · Hồng ấm áp, C · Đêm chuyên nghiệp). C là giao diện tối, nhiều thông tin, sidebar liệt kê tài khoản kèm trạng thái, hợp một công cụ quản lý nhiều tài khoản.

Token nằm ở đầu [`src/styles.css`](../src/styles.css) (`:root`). Mọi màu chữ đã chọn để đạt tương phản ≥ 4.5:1 trên nền của nó.

## Màu

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg` | `#0B0F14` | Nền app, khung chat |
| `--sidebar` | `#0F141B` | Sidebar, header chat, ô soạn tin |
| `--surface` | `#111821` | Danh sách hội thoại, thẻ, panel |
| `--raised` | `#1A2230` | Hover, mục đang chọn |
| `--bubble-in` | `#1F2937` | Bong bóng tin đến, mục nav đang chọn |
| `--border` | `#1F2937` | Viền |
| `--border-strong` | `#374151` | Viền nút phụ, viền nét đứt |
| `--text` / `--text-strong` | `#E5E7EB` / `#F9FAFB` | Chữ thường / tiêu đề |
| `--text-soft` | `#D1D5DB` | Nhãn, nav |
| `--muted` | `#9CA3AF` | Chữ phụ, giờ (≥ 5.7:1 trên `#1F2937`) |
| `--accent` | `#7C3AED` | Nút chính, tin đi, badge (chữ trắng 5.7:1) |
| `--accent-soft` | `rgba(124,58,237,.2)` | Tài khoản đang chọn, segmented đang chọn |
| `--on-accent-soft` | `#EDE9FE` | Chữ trên `--accent-soft`, giờ trong tin đi |
| `--ok` | `#34D399` | Online, *Đang hoạt động*, realtime ổn định |
| `--warn` | `#FBBF24` | *Phiên hết hạn*, đang kết nối, cảnh báo |
| `--bad` | `#F87171` | Lỗi |
| `--link` | `#22D3EE` | Huy hiệu xác thực, nhãn tài khoản gửi |

Màu avatar khi không có ảnh: `#BE123C #1D4ED8 #7C3AED #15803D #B45309 #0E7490 #BE185D #4338CA` (chữ trắng). Trạng thái luôn có **chữ đi kèm chấm màu**, không chỉ dựa vào màu.

Bảng màu sáng của hướng C (chưa dùng, để sau): nền `#F9FAFB`, bề mặt `#FFFFFF`, viền `#E5E7EB`, chữ `#111827`, chữ phụ `#4B5563`, nhấn `#7C3AED`, online `#047857`.

## Chữ

Inter Variable (đóng gói sẵn, có subset tiếng Việt).

| Vai trò | Cỡ / độ đậm |
|---|---|
| Tiêu đề màn | 18 / 700 |
| Tên trong header chat | 15 / 700 |
| Nội dung, tin nhắn | 14 / 400, line-height 1.45 |
| Xem trước tin, nhãn | 13 |
| Giờ, trạng thái, nhãn mục (IN HOA, giãn 0.06em) | 12 |

## Hình khối và khoảng cách

- Bo góc: 6 px (chip, tab), 8 px (nút, ô nhập, hàng), 10 px (thẻ, bong bóng, avatar lớn). Bong bóng có một góc 3 px phía người gửi.
- Bố cục 3 cột: sidebar 248 px · danh sách 260–340 px · nội dung co giãn. Panel thành viên phòng 280 px.
- Vùng bấm tối thiểu 40–44 px; mỗi nút chỉ có icon đều có `aria-label`.
- Focus: viền `#A78BFA` 2 px. Tôn trọng `prefers-reduced-motion` (tắt spinner và chấm đang gõ).

## Thành phần

| Thành phần | File |
|---|---|
| Sidebar (tài khoản, mục, ô realtime) | `src/components/Sidebar.tsx` |
| Avatar (ảnh → chữ cái đầu, chấm online) | `src/components/Avatar.tsx` |
| Danh sách tin (vạch ngày, nhóm theo người gửi, đang gõ, cảnh báo gửi) | `src/components/MessageList.tsx` |
| Ô soạn tin (Enter gửi, lý do khi bị khoá) | `src/components/Composer.tsx` |
| Icon (Lucide, nét 2 px) | `src/components/Icon.tsx` |
