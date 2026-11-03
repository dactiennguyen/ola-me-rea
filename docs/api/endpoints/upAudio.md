# faApi2/upAudio.php

Tải lên **tin nhắn thoại (voice)** trong chat. Sau khi upload xong, client gửi tin với `isAudio=1` qua [addLastMessage5](addLastMessage5.md) + socket `new message`.

**Method + path**: `POST https://sgdev.vip/faApi2/upAudio.php`

**Auth**: cần [header xác thực](../auth-va-header.md) (Bearer + key2/timestamp/hash/deviceid/os/ver).

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `uid` | string | chủ tài khoản gửi voice (mặc định tài khoản đăng nhập) | [Suy luận/AOT] |
| `audio` | string | dữ liệu/đường dẫn file audio cần upload | [Suy luận/AOT] |

> **[Chưa xác minh]**: chưa bắt được endpoint này trên wire, nên cách mã hoá `audio` (base64 trong JSON hay `multipart/form-data`) chưa chắc chắn. Client Node.js hiện gửi JSON `{uid, audio}` theo đúng tên field AOT; nếu server yêu cầu multipart thì cần chỉnh lại khi có capture thật.

Ví dụ (đã redact):

```json
{ "uid": "<uid>", "audio": "<base64 hoặc đường dẫn audio>" }
```

## Response

**Chưa bắt response** — chạy `node scripts/nodejs/ola.ts upAudio --audio ./voice.m4a --dry-run` để xem request; bỏ `--dry-run` (có đăng nhập) để lấy response. [Chưa xác minh]

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/upAudio.ts`](../../../scripts/nodejs/src/endpoints/upAudio.ts). Thiếu `audio` sẽ báo lỗi trước khi gửi. `audio` được gửi nguyên chuỗi trong body JSON (client không đọc file); `uid` mặc định là tài khoản đăng nhập.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { OlaClient } from './src/client.ts';
import { upAudio } from './src/endpoints/index.ts';

const ola = await OlaClient.login();
try {
  const res = await ola.call(upAudio, { audio: '<base64 hoặc đường dẫn audio>' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts upAudio --audio <base64-hoặc-đường-dẫn> [--uid <uid>]` (thêm `--dry-run` để chỉ in request)

## ⚠️ Tác dụng phụ

Thay đổi state server — tạo bản ghi/file audio. Đừng gọi tùy tiện.

## Bằng chứng

- AOT: `work/api_inventory.csv:72` (`ola_flutter_core_chat_upload_provider.dart:618`), CandidateKeys = `uid;audio`.
- Runtime: không có (endpoint chưa phát sinh trong các phiên đã bắt).
