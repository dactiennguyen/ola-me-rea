# Phần còn thiếu

Danh sách những gì **chưa** bắt được hoặc chưa phân tích, xếp theo mức ưu tiên.

## Ưu tiên cao

| # | Việc | Cách làm |
|---|---|---|
| 1 | **Socket query key và delivery ACK** | Chưa chốt nguồn key cho client Node và chưa kiểm thử giao nhận hai đầu |
| 2 | **Response body** | Logger chỉ log request; Node đã nhận response login/sync. Cần thêm response interceptor cho các luồng khác |
| 3 | **Apple; đăng ký và quên mật khẩu trên dây** | Đăng ký/quên mật khẩu đã viết từ AOT ([luong-dang-ky.md](luong-dang-ky.md)); còn thiếu response thật của `checkEmail.php` và bắt runtime với một email test (tạo tài khoản thật) |
| 4 | **Đăng xuất** | Chưa thấy nút trong màn đã xem; AOT có hàm logout. Không thử xóa tài khoản |

## Ưu tiên trung bình

| # | Việc | Ghi chú |
|---|---|---|
| 5 | Gửi **ảnh / voice / sticker / quà** trong chat | Sẽ đi qua `FormData` — logger đã có `readFormData` nhưng chưa kiểm chứng trên luồng thật |
| 6 | **Reply** tin nhắn | Payload đã có `replyID`/`replyText` nhưng chưa thấy giá trị khác rỗng |
| 7 | Upload post / story (`/napi/post/upload-post`, `/napi/post/stories`) | Endpoint đã có trong inventory tĩnh, chưa chạy |
| 8 | Nạp xu / IAP / VIP / Boost | Chưa đụng tới |

## Ưu tiên thấp

| # | Việc | Ghi chú |
|---|---|---|
| 9 | Caro online | `https://sgdev.vip:5000/caro`, chưa mở |
| 10 | Gọi thoại / video | Chưa tìm thấy endpoint trong inventory |
| 11 | Xác định backend PHP hay Node.js | Cần response header/banner server, hoặc quyền truy cập source/deployment. APK và hook client **không** trả lời được — xem [03 §PHP hay Node.js](../03-api-calls-and-hooks.md#php-hay-nodejs) |

## Những màn không phát sinh API trong capture hiện có

- Danh sách quà tặng, danh sách phòng chat, Boost Profile (trước kích hoạt), Tiện ích, danh sách mini game: không thấy request trong phiên quan sát; không kết luận mọi trạng thái đều không có API.
- Danh sách tỉnh/thành trong Phòng chat: dữ liệu tĩnh trong app, id phòng = mã tỉnh.

## Cải tiến logger

[ola_api_logger.js](../../work/scripts/ola_api_logger.js) hiện tại:

- Chỉ hook `DioMixin.fetch` / `_dispatchRequest` và 3 điểm của Socket.IO.
- Chưa giải mã `FormData` trên luồng thật.
- Đã thêm hook cấu trúc response của Khám phá tại `0x9910f0` (key/type/count/cursor); chưa bắt response tổng quát cho các endpoint khác.
- Bảng `Classes` trong `work/dae-aot-20261102/frida.js` của dae **lệch 4 byte** (giả định header 4 byte, thật là 8) — nếu dùng lại file đó phải sửa; `ola_api_logger.js` đã hardcode layout đúng.
