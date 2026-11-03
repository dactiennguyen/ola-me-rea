# Ola Me — Tài liệu điều tra và tích hợp

Kho này lưu tài liệu, bằng chứng và công cụ phục vụ việc điều tra app Ola
(`com.olaachat`), lập inventory API, bắt request runtime, và thử nghiệm client
Node.js/TypeScript. Tài liệu được chia theo mục đích tra cứu:

| Nội dung | Tài liệu |
|---|---|
| Tổng quan APK, package, kiến trúc Flutter/Dart AOT và các module chức năng | [Tổng quan app](docs/01-tong-quan-app.md) |
| Phân tích `libapp.so` bằng `dae`: snapshot, class, function, pseudocode và call graph | [Điều tra Dart AOT](docs/02-dart-aot-dae.md) |
| Cách suy ra endpoint, method, base URL và giới hạn của phân tích tĩnh | [API calls, AOT mapping và hook](docs/03-api-calls-and-hooks.md) |
| Cách bắt plaintext HTTP và frame Socket.IO ở tầng Dart bằng Frida | [Bắt API runtime](docs/04-runtime-api-capture.md) |
| Host, header, xác thực, luồng đăng nhập, chat, phòng và giao thức Socket.IO | [Tài liệu API](docs/api/README.md) |
| Inventory 40 endpoint đã chạy thật và 135 path tìm thấy trong AOT | [Endpoint runtime](docs/api/endpoint-runtime.md) · [Endpoint tĩnh](docs/api/endpoint-tinh.md) |
| Chạy client Node.js, đăng nhập, gọi endpoint, dry-run và dùng như thư viện | [Client Node.js](docs/api/nodejs-login.md) |
| Ví dụ workflow chat 1-1 bằng hai client Node.js | [Ví dụ chat Node.js](docs/api/vi-du-chat-nodejs.md) |
| Luồng đăng nhập/khởi động, khám phá, chat và phòng chat | [Các luồng API](docs/api/luong-dang-nhap-khoi-dong.md) |
| Nguồn dữ liệu điều tra và danh sách file Dart nhận diện được | [ola_files.txt](olaachat/ola_files.txt) |

Artifact hiện được phân tích là app Ola `com.olaachat`, version `27.7.8`
(versionCode `405`), bản Flutter phát hành dạng split APK. Các kết luận trong
tài liệu đều ghi rõ nguồn và mức độ tin cậy; kết quả runtime mới nhất được ghi
trong [báo cáo bắt API](docs/04-runtime-api-capture.md).

## Quyền sử dụng và sở hữu

Đây là phần tài liệu, mã nguồn, script và dữ liệu nghiên cứu do tôi thực hiện
và thuộc quyền sở hữu của tôi. Tôi cho phép mọi người tự do đọc, sử dụng, sao
chép, chỉnh sửa và mở rộng các nội dung trong phần này cho mục đích cá nhân,
học tập, nghiên cứu và phát triển tương thích; khi tái sử dụng, vui lòng giữ
ghi công và liên kết về repository này.

Việc điều tra và kiểm thử được thực hiện trên APK, thiết bị, tài khoản và môi
trường mà tôi có quyền truy cập hoặc được cho phép sử dụng. Quyền sử dụng này
không bao gồm việc truy cập trái phép vào tài khoản/hệ thống, thu thập dữ liệu
của người khác, gửi nội dung ngoài ý muốn hoặc gây tác động lên dịch vụ thật.
Các file có ghi điều kiện riêng thì áp dụng theo điều kiện của file đó.

## Quy trình

Repo được tổ chức theo chuỗi điều tra và kiểm chứng sau:

1. **Nhận diện APK và native/Dart**: xác định manifest, ABI, Flutter/Dart AOT,
   artifact hash và cấu trúc app; ghi kết quả vào [tổng quan app](docs/01-tong-quan-app.md).
2. **Phân tích tĩnh**: dùng `dae` và các script trong `scripts/` để xuất
   function, class, library, endpoint và call graph; ghi bằng chứng vào
   [điều tra Dart AOT](docs/02-dart-aot-dae.md).
3. **Kiểm chứng runtime**: hook Frida ở tầng Dart để đối chiếu method, URL,
   body, header và frame Socket.IO; cập nhật [inventory runtime](docs/api/endpoint-runtime.md).
4. **Tích hợp Node.js**: chỉ mô phỏng những giao thức đã có bằng chứng, dùng
   client trong `scripts/nodejs/`, rồi ghi cách chạy và kết quả vào [tài liệu
   Node.js](docs/api/nodejs-login.md).

Phần phân tích tĩnh cho biết API surface nhưng không tự chứng minh endpoint đã
được gọi. Kết luận “chạy thật” chỉ dùng cho request/frame đã được hook quan sát.
Không commit mật khẩu, token, cookie, authorization header, FCM token, nội dung
tin nhắn hoặc dữ liệu cá nhân; log runtime thô nằm trong `work/` và đã được
`.gitignore`.

## Chạy client Node.js

Client nằm trong `scripts/nodejs/`, chạy trực tiếp file `.ts` bằng Node.js
22.18+ (nên dùng Node 24 LTS vì Firebase JS SDK 13 khai báo Node 24.12+):

```bash
cd scripts/nodejs
corepack yarn install --ignore-engines
cp .env.example .env
# điền OLA_EMAIL và OLA_PASSWORD trong .env

node login.ts
node ola.ts list
node ola.ts getPostByID --postID 123 --dry-run
node explore.ts --tab online --pages 2
```

Tài khoản chỉ được đọc từ `scripts/nodejs/.env` hoặc biến môi trường. Xem đầy
đủ lệnh, kiểu input, chữ ký request và cách dùng như thư viện trong [Client
Node.js](docs/api/nodejs-login.md). Muốn chạy lại phiên bắt request bằng Frida,
xem [Bắt API runtime](docs/04-runtime-api-capture.md#2-cách-chạy-lại).
