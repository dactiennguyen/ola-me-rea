# napi/users/sync

Đồng bộ hồ sơ user với backend sau khi đăng nhập Firebase (Google / Apple / Email). Đây là **request backend duy nhất** của bước đăng nhập và cũng chạy lại trong chuỗi khởi động. Xem [luồng đăng nhập & khởi động](../luong-dang-nhap-khoi-dong.md).

## Method + path

`POST https://sgdev.vip/napi/users/sync`

**Auth:** bộ header ký chung, **bắt buộc** có `Authorization: Bearer <Firebase ID token>`. Xem [header xác thực](../auth-va-header.md).

## ⚠️ Tác dụng phụ

Endpoint này **thay đổi trạng thái server**: tạo/cập nhật bản ghi user và đăng ký thiết bị (`deviceId`). Response là `UserModel` được app lưu cache (`USER_DATA_JSON`, `USER_UID`...). Đừng gọi tùy tiện; mỗi lần gọi là một lần ghi hồ sơ/thiết bị.

## Request body

| field | kiểu | ý nghĩa | nguồn |
|---|---|---|---|
| `os` | string | Hệ điều hành, luôn `"android"` | `runtime_capture_session.log #16` [Quan sát] |
| `deviceId` | string | Android ID của thiết bị; **nên trùng** header `deviceid` đã ký | [Quan sát] |
| `ver` | string | **Phiên bản Android** (vd `"13"`) — khác header `ver` (phiên bản app `27.7.8`) | [Quan sát] |
| `displayName` | string | Tên hiển thị; app gửi `""` khi không cập nhật | [Quan sát] |
| `photoURL` | string | URL avatar; app gửi `""` khi không cập nhật | [Quan sát] |

Ví dụ (đã redact):

```json
{
  "os": "android",
  "deviceId": "<deviceId>",
  "ver": "13",
  "displayName": "",
  "photoURL": ""
}
```

Luồng Google điền `displayName`/`photoURL` từ tài khoản Google; luồng Email để trống hai field này.

## Response

[Quan sát] — `OlaClient.sync()` (`scripts/nodejs/src/client.ts`, chạy trong `login.ts`) đọc thành công object `user` và kiểm tra `user.uid === session.localId`.

```text
{
  "user": {
    "uid": string,          // trùng Firebase localId
    "autoID": number,       // ID nội bộ (không trùng UID hiển thị trừ khi đã đối chiếu)
    "displayName": string,
    "xu": number,           // số xu / ví
    "level": number,
    "email": string
    // ... các field hồ sơ khác, chưa liệt kê hết
  }
}
```

Giá trị thật (uid, email, tên) đã được redact; chỉ ghi shape key/kiểu. [Chưa xác minh] danh sách field đầy đủ.

## Dùng Node.js

Định nghĩa: [`scripts/nodejs/src/endpoints/usersSync.ts`](../../../scripts/nodejs/src/endpoints/usersSync.ts). `OlaClient.login()` đã tự gọi endpoint này (qua `ola.sync()`); gọi lại riêng khi cần body tuỳ chỉnh. Mặc định `os="android"`, `displayName`/`photoURL` rỗng, còn `deviceId`/`ver` lấy từ config của client đang gọi — với `loginFromEnv()` là `olaConfig` ([`scripts/nodejs/src/config.ts`](../../../scripts/nodejs/src/config.ts): `deviceId` = `OLA_DEVICE_ID` trong `.env`, mặc định `nodejs-probe`; `ver` = phiên bản Android `13`) — nên luôn trùng header `deviceid` đã ký.

```ts
// Một file .ts trong scripts/nodejs/; tài khoản lấy từ scripts/nodejs/.env
import { loginFromEnv } from './src/node.ts';
import { usersSync } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const res = await ola.call(usersSync, { displayName: 'Phong', photoURL: '' });
} finally {
  await ola.close();
}
```

CLI: `node scripts/nodejs/ola.ts usersSync [--deviceId <deviceId>] [--displayName "Phong"] [--photoURL <url>] [--os android] [--ver 13]` (thêm `--dry-run` để chỉ in request)

## Bằng chứng

- `work/api_inventory.csv`: `napi/users/sync,POST,ola_flutter_features_login_user_provider.dart,2170,os;android;deviceId;ver;displayName;photoURL`.
- `work/api_runtime_inventory.csv`: `POST,napi/users/sync,"os, deviceId, ver, displayName, photoURL",đăng nhập`.
- `work/runtime_capture_session.log` #16: body `{"os":"android","deviceId":"<deviceId>","ver":"13","displayName":"","photoURL":""}`; wire hdrs có `Authorization`.
- `scripts/nodejs/src/client.ts` `OlaClient.sync()` đọc `data.user`.
