# 04 · Design: hướng C "Đêm chuyên nghiệp" — design system v2

Chọn từ 3 hướng trên canvas [Ola Desktop — Chọn design & màu sắc](https://claude.ai/artifact/GbTYBRihtECGJ8MA4hTHhd) (A · Xanh tin cậy, B · Hồng ấm áp, C · Đêm chuyên nghiệp). C là giao diện tối, nhiều thông tin, sidebar liệt kê tài khoản kèm trạng thái, hợp một công cụ quản lý nhiều tài khoản.

v2 giữ nguyên màu nhấn tím và các giá trị màu của C, và làm lại hệ thống bên dưới: **Tailwind v4**, một thang cỡ chữ / chiều cao control / bo góc duy nhất, và bộ component dùng chung `src/ui/`. Phong cách: Swiss / tối giản cho công cụ, mật độ cao, chuyển động nhẹ.

## Code ở đâu

| File | Nội dung |
|---|---|
| [`src/styles/tokens.css`](../src/styles/tokens.css) | Token (biến CSS `:root`): màu, cỡ chữ, khoảng cách, chiều cao control, chuyển động. **Mọi giá trị đều lấy từ đây** |
| [`src/styles/index.css`](../src/styles/index.css) | Điểm vào CSS: `@import "tailwindcss"`, `@theme` ánh xạ token thành utility (`bg-surface`, `text-muted`…), bo góc, bóng, thang chữ |
| [`src/styles/base.css`](../src/styles/base.css) | Reset, chữ, tiện ích (`@layer base`) |
| `src/styles/components.css`, `layout.css`, `screens/*.css` | Class cũ (`btn`, `chip`, `field`…) cho màn chưa chuyển sang Tailwind, nằm trong `@layer components` để utility luôn ghi đè được. Xoá dần khi chuyển màn |
| [`src/ui/`](../src/ui/) | Component dùng chung, viết bằng Tailwind |

## Quy ước khi viết UI

- **Không viết màu/cỡ thô** (`#fff`, `13px`) trong component. Bảng màu mặc định của Tailwind đã bị tắt (`--color-*: initial`), nên `bg-red-500` không tồn tại; dùng `bg-bad-bg`, `text-ok`…
- Dùng component trong `src/ui/` trước; chỉ viết utility trực tiếp cho bố cục.
- Gộp class bằng `cn()` (clsx + tailwind-merge): class truyền vào sau sẽ thắng class mặc định bị xung đột.
- **Trạng thái không bao giờ chỉ dựa vào màu**: luôn có icon hoặc chữ đi kèm (log, chip đang bật có dấu ✓, chấm trạng thái có chữ bên cạnh).
- Nút chỉ có icon phải có tên: `IconButton` bắt buộc prop `label` (làm cả `aria-label` lẫn tooltip).
- Danh sách trên 100 dòng dùng `VirtualList`.
- Phản hồi: **toast** (`useToast`) cho việc vừa xong (đã lưu, đã xuất file, kết thúc phiên gửi); **Notice** cho thứ cần ở lại (lý do nút bị khoá, kết quả, lỗi); **EmptyState** thay cho danh sách rỗng, luôn nói bước tiếp theo.
- Việc không thu hồi được (gửi tin thật hàng loạt) phải có hộp thoại xác nhận.

## Nút

Ba cỡ cho cả app (theo lưới 4 px): **sm 28** (`h-7`, thanh công cụ, chip) · **md 32** (`h-8`, mặc định) · **lg 40** (`h-10`, hành động chính của một vùng).

| Biến thể | Dùng khi |
|---|---|
| `primary` | **Hành động chính** của một vùng (mỗi vùng một nút): *Lấy danh sách*, *Bắt đầu gửi tới N người* |
| `secondary` | Hành động khác (mặc định) |
| `ghost` | Viền, nhấn nhẹ, đứng cạnh nút chính: *Mẫu tin*, *Lịch sử*, *Huỷ* |
| `subtle` | Chỉ chữ, trong thanh công cụ: *CSV*, *JSON* |
| `danger` / `danger-ghost` | Phá huỷ hoặc dừng: *Dừng gửi*, *Dừng lấy* |

Nhãn nút ghi rõ kết quả (*Bắt đầu gửi tới 8 người*, *Gửi 8 tin*), không ghi chung chung (*OK*). Nút bị khoá thì lý do hiện ngay bên trên (Notice), không chỉ trong tooltip. Đang chạy thì nút hiện spinner (`loading`).

## Màu

| Token | Utility | Giá trị | Dùng cho |
|---|---|---|---|
| `--bg` | `bg-bg` | `#0B0F14` | Nền app, khung chat |
| `--sidebar` | `bg-sidebar` | `#0F141B` | Sidebar, header chat, ô soạn tin |
| `--surface` | `bg-surface` | `#111821` | Danh sách, thẻ, panel |
| `--raised` | `bg-raised` | `#1A2230` | Hover, mục đang chọn, popover |
| `--bubble-in` | `bg-bubble` | `#1F2937` | Bong bóng tin đến, mục nav đang chọn |
| `--border` / `--border-strong` | `border-line` / `border-line-strong` | `#1F2937` / `#374151` | Viền |
| `--text` / `--text-strong` | `text-fg` / `text-strong` | `#E5E7EB` / `#F9FAFB` | Chữ thường / tiêu đề |
| `--text-soft` | `text-soft` | `#D1D5DB` | Nhãn, nav |
| `--muted` | `text-muted` | `#9CA3AF` | Chữ phụ, giờ (≥ 5.7:1 trên `#1F2937`) |
| `--accent` | `bg-accent` | `#7C3AED` | Nút chính, tin đi, badge (chữ trắng 5.7:1) |
| `--accent-soft` / `--on-accent-soft` | `bg-accent-soft` / `text-on-accent-soft` | `rgba(124,58,237,.2)` / `#EDE9FE` | Chip đang bật, segmented đang chọn |
| `--ok` · `--ok-bg` · `--ok-text` | `text-ok` · `bg-ok-bg` · `text-ok-text` | `#34D399` | Thành công, online |
| `--warn` · `--warn-bg` · `--warn-text` | tương tự | `#FBBF24` | Cảnh báo, lý do bị khoá, đang kết nối |
| `--bad` · `--bad-bg` · `--bad-text` | tương tự | `#F87171` | Lỗi |
| `--info` · `--info-bg` | tương tự | `#22D3EE` | Thông tin |
| `--danger` | `bg-danger` | `#B91C1C` | Nền nút phá huỷ (chữ trắng 6.5:1) |

Màu avatar khi không có ảnh: `#BE123C #1D4ED8 #7C3AED #15803D #B45309 #0E7490 #BE185D #4338CA` (chữ trắng).

Bảng màu sáng của hướng C (chưa dùng, để sau; token đã tách theo vai trò nên thêm được): nền `#F9FAFB`, bề mặt `#FFFFFF`, viền `#E5E7EB`, chữ `#111827`, chữ phụ `#4B5563`, nhấn `#7C3AED`, online `#047857`.

## Chữ

Inter Variable (đóng gói sẵn, có subset tiếng Việt). Năm cỡ, **không có chữ nhỏ hơn 12 px**:

| Utility | Cỡ | Vai trò |
|---|---|---|
| `text-xl` | 20 / 700 | Tiêu đề màn |
| `text-lg` | 16 / 700 | Tiêu đề panel, modal |
| `text-base` | 14 / 400 | Nội dung, tin nhắn |
| `text-sm` | 13 | Nút, ô nhập, chữ phụ trong danh sách |
| `text-xs` | 12 | Giờ, trạng thái, nhãn mục (IN HOA, giãn chữ, `Eyebrow`) |

Số đếm và giờ dùng `tabular-nums` để không nhảy khi thay đổi.

## Hình khối, khoảng cách, chuyển động

- Khoảng cách theo lưới 4 px (utility mặc định của Tailwind: `p-2` = 8 px).
- Bo góc: 4 (`rounded-xs`) · 6 (`rounded-sm`, chip, tab) · 8 (`rounded-md`, nút, ô nhập, hàng) · 12 (`rounded-lg`, thẻ, modal, bong bóng). Bong bóng có một góc nhỏ phía người gửi.
- Bóng: `shadow-pop` (toast, menu) · `shadow-modal`.
- Chuyển động: hover/focus 120–180 ms; modal/toast hiện ra 180 ms. `prefers-reduced-motion` tắt mọi chuyển động (`base.css`).
- Focus: viền `#A78BFA` 2 px trên mọi control (không bao giờ bỏ `outline`).
- Bố cục: rail tài khoản 64 px · sidebar 240 px · danh sách 260–340 px · nội dung co giãn. Tìm người & nhắn: cột trái 360 px; Auto gửi chia 2 cột khi vùng nội dung ≥ 768 px (container query), hẹp hơn thì dồn 1 cột.

## Component (`src/ui/`)

| Component | Ghi chú |
|---|---|
| `Button` | `variant`, `size`, `icon`, `loading`, `block` |
| `IconButton` | Bắt buộc `label`; `variant` outline / ghost / danger |
| `ToggleChip`, `Tag` | Chip bật/tắt (`aria-pressed`, có dấu ✓) · giá trị đã chọn có nút bỏ |
| `Badge`, `StatusDot` | Nhãn trạng thái/số đếm theo tông |
| `Field`, `Input`, `Select`, `Textarea`, `NumberInput` | Nhãn luôn hiện phía trên, gợi ý/lỗi phía dưới; `NumberInput` có đơn vị và tự kẹp giá trị |
| `Checkbox` | Checkbox thật, hỗ trợ trạng thái "chọn một phần" |
| `Segmented` | Chọn 1 trong N (radio group, phím mũi tên), có số đếm |
| `Modal` | Bẫy focus, Esc / bấm nền để đóng, trả focus về nút đã mở |
| `ToastProvider` / `useToast` | Thông báo tạm ở góc phải dưới, tự ẩn 4 s (lỗi 7 s) |
| `Notice`, `EmptyState`, `ProgressBar`, `Eyebrow`, `Spinner` | Phản hồi và trạng thái |
| `VirtualList` | Danh sách dài, chỉ render dòng đang thấy (`@tanstack/react-virtual`) |

Component cũ trong `src/components/`: AccountRail (cột tài khoản), Sidebar (thanh bên của một nick), Avatar, MessageList, Composer, Icon (Lucide, nét 2 px).

## Lộ trình chuyển màn

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| P0 | Token v2, Tailwind, chia CSS, bộ `src/ui/` | Xong |
| P1 | Khung app + Tìm người & nhắn / Auto gửi | Xong |
| P2 | Tin nhắn + Phòng chat | |
| P3 | Khám phá + Blog + Thông tin tài khoản | |
| P4 | Quản lý tài khoản, Cài đặt, hộp thoại đóng cửa sổ; xoá `components.css`/`layout.css`/`screens/*.css` | |
