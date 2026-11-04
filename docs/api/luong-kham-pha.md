# Khám phá: lấy danh sách, bộ lọc và phân trang

Đối chiếu app 27.7.8 / vc405 trên máy root ngày 2026-11-03, bằng ADB + Frida tại request Dio và điểm nhận response của ExploreProvider. Ba tab đang hiển thị là **Online**, **Đã xác thực**, **Ảnh có mặt**.

## API theo tab

Base URL: `https://sgdev.vip`. Tất cả dùng **POST JSON**, cùng [header xác thực và hash](auth-va-header.md): Firebase Bearer token của người đang đăng nhập, `key2`, `deviceid`, `os`, `ver`, `timestamp`, `hash`.

| Tab | Path | Body mặc định ở lần tải đầu |
|---|---|---|
| Online | `/faApi2/getExploreOnlineV6.php` | `{uid, page:0, os:"android", condition:2, lastSeenPaging:0}` |
| Đã xác thực | `/faApi2/getExplore3.php` | `{uid, page:0, os:"android", condition:1}` |
| Ảnh có mặt | `/faApi2/getExploreAvatarV4.php` | `{uid, page:0, os:"android"}` |

`uid` là Firebase UID của **tài khoản đang xem danh sách**, không phải UID người cần tìm. Đây là HTTP tới backend Ola; luồng lấy danh sách này không đọc Firebase Database hoặc Socket.IO.

## Bộ lọc

Cả ba API đều có thể thêm `gender` và `cityID`. App chỉ thêm key khi có lọc:

| Chọn trên UI | Body |
|---|---|
| Nữ | `gender: 0` |
| Nam | `gender: 1` |
| LGBT | `gender: 2` |
| Tất cả giới tính | Bỏ key `gender`, không gửi số 3 |
| Hà Nội | `cityID: "1"` |
| Tất cả tỉnh thành | Bỏ key `cityID` |

Nữ + Hà Nội đã được bắt trực tiếp trên cả ba tab. LGBT = `gender: 2` đã bắt trực tiếp ngày 2026-11-04 trên Ảnh có mặt và Đã xác thực (kể cả LGBT + Bắc Kạn = `cityID: "6"`). Nam = `1` vẫn chỉ đối chiếu enum Gender và các nhánh tạo body trong AOT. `cityID` là **chuỗi mã trong dữ liệu tỉnh thành của app**; không tự thay bằng tên tỉnh hoặc mã của nguồn khác.

Ví dụ request Online với bộ lọc đã kiểm chứng:

```json
{
  "uid": "<Firebase UID của tôi>",
  "page": 0,
  "condition": 2,
  "os": "android",
  "cityID": "1",
  "gender": 0,
  "lastSeenPaging": 0
}
```

Trong lần áp dụng bộ lọc thực tế, app giữ cursor Online cũ thay vì gửi lại 0; ví dụ trên mô tả một truy vấn mới chưa có cursor.

## Đọc danh sách từ response

Response HTTP 200 đã thấy các key:

```text
Online:       {is_success, message, list_data: [...], lastSeenPaging: <integer>}
Đã xác thực:  {is_success, message, list_data: [...]}
Ảnh có mặt:   {is_success, message, list_data: [...]}
```

**Không ai khớp bộ lọc** thì server vẫn trả HTTP 200 nhưng `is_success` là **false**: `{is_success: false, message: "", list_data: []}` (bắt ngày 2026-11-04, Ảnh có mặt + LGBT + Bắc Kạn). App gốc không coi đó là lỗi mà hiện "Không tìm thấy người dùng nào". `message` cũng không phải thông báo lỗi: các lần thành công đã thấy `"done"`, `""`, `-1`, `2`.

Danh sách nằm ở **`response.data.list_data` khi dùng Dio**, hoặc **`result.raw.list_data` (đã tách sẵn thành `result.items`) với `ola.call()` trong Node**. Mỗi phần tử được chuyển qua `UserModel.fromJson()` rồi hiển thị thành thẻ người dùng.

| Tab | Các key của phần tử đầu đã quan sát |
|---|---|
| Online | `uid`, `lastSeen`, `displayName`, `photoURL`, `isVerifyAvatar`, `isVip`, `level` |
| Đã xác thực | Các key trên và `state` |
| Ảnh có mặt | Các key trên, `state`, `isMale`, `followers`, `isNew`, `createDate` |

Các key này là mẫu thực tế, không phải schema bắt buộc cho mọi user. `uid`, tên và URL ảnh là string; các flag `isVip`, `isVerifyAvatar` trong mẫu là number; `isNew` là boolean. `lastSeen` và cursor lớn hơn 32-bit nhưng vẫn trong miền integer an toàn của JavaScript ở capture này. Không dùng phép ép `|0` cho timestamp.

Với bộ lọc Nữ + Hà Nội, lần kiểm tra nhận **50** phần tử Online, **40** Đã xác thực và **12** Ảnh có mặt. Đây là số lượng trong response của phiên đó, không chứng minh page size cố định hoặc tổng số tài khoản.

## Phân trang và làm mới

```text
Mở Khám phá / chọn tab / áp dụng bộ lọc
  -> ExploreProvider.fetchData(isRefresh: true)
  -> POST API theo tab
  -> lấy list_data -> UserModel.fromJson -> thay danh sách đang hiển thị

Cuộn gần cuối danh sách (còn khoảng 200 đơn vị scroll)
  -> fetchData() nếu chưa loading và còn dữ liệu
  -> POST trang tiếp theo -> nối list_data vào danh sách cũ
```

- `page` bắt đầu bằng **0**, tăng một sau response có danh sách không rỗng.
- Online lưu `response.lastSeenPaging` rồi gửi nguyên giá trị đó trong request tiếp theo, cùng `page: 1`, `page: 2`, …
- Đã bắt trực tiếp Online `page:0` trả 50 phần tử và cursor C1, sau đó `page:1` gửi C1, trả tiếp 50 phần tử cùng cursor C2. Không tự tính cursor bằng giờ hiện tại.
- Hai tab còn lại không gửi cursor; phân trang bằng `page`.
- Theo AOT, danh sách rỗng đặt cờ hết dữ liệu; không suy ra hết trang chỉ vì nhận ít hơn 50 phần tử.
- Làm mới/đổi tab/bộ lọc reset page và cờ còn dữ liệu. Riêng cursor Online không được reset trong nhánh refresh này; runtime cũng thấy page về 0 nhưng vẫn gửi cursor cũ. Chưa kết luận server có sử dụng hay bỏ qua cursor khi page bằng 0.
- Chỉ `build()` ban đầu đặt cả page và cursor bằng 0. App có cờ loading để hạn chế gọi chồng.

## Client Node: explore.ts

CLI phân trang nằm tại [scripts/nodejs/explore.ts](../../scripts/nodejs/explore.ts); ba tab là ba endpoint [getExploreOnlineV6](endpoints/getExploreOnlineV6.md), [getExplore3](endpoints/getExplore3.md) và [getExploreAvatarV4](endpoints/getExploreAvatarV4.md), dùng chung định nghĩa trong `scripts/nodejs/src/endpoints/_explore.ts`. Node.js 22.18+ (ưu tiên 24, xem [chi tiết](nodejs-login.md)); cài dependency và điền `scripts/nodejs/.env` trước ([chi tiết](nodejs-login.md)). Đây là client gọi API Ola, không mở HTTP server local.

Chạy từ thư mục gốc repo:

```powershell
# Một trang Online mặc định
node scripts/nodejs/explore.ts

# Hai tab còn lại
node scripts/nodejs/explore.ts --tab verified
node scripts/nodejs/explore.ts --tab avatar

# Nữ, Hà Nội, tối đa hai trang; tự chuyển cursor giữa các trang
node scripts/nodejs/explore.ts --tab online --gender 0 --city 1 --pages 2

# Xem body, không đăng nhập hoặc gọi mạng
node scripts/nodejs/explore.ts --tab online --gender 0 --city 1 --dry-run

node scripts/nodejs/explore.ts --help
```

| Tham số CLI | Ý nghĩa |
|---|---|
| `--tab online/verified/avatar` | Tab, mặc định online |
| `--gender 0/1/2/all` | Nữ/Nam/LGBT/tất cả; mặc định bỏ lọc |
| `--city <mã>/all` | Mã tỉnh theo app; mặc định bỏ lọc |
| `--page <số>` | Trang bắt đầu, mặc định 0 |
| `--cursor <số>` | Cursor response Online trước; bắt buộc khi bắt đầu Online ở page > 0 |
| `--pages <số>` | Số trang tối đa trong lần chạy, mặc định 1; dừng sớm khi list_data rỗng |
| `--dry-run` | Chỉ in request đầu tiên (UID là `SIGNED_IN_UID`); không đăng nhập, không gọi mạng |

Online trang đầu mặc định cursor 0. Khi tự lấy trang tiếp theo, client dùng nguyên cursor response và giữ bộ lọc. Bắt đầu một truy vấn mới bằng page 0/cursor 0; nếu cần tái hiện hành vi refresh của app giữ cursor cũ, truyền `--cursor` rõ ràng. Tab verified/avatar không nhận `--cursor`.

CLI đăng nhập một lần mỗi lần chạy, rồi gọi tuần tự các trang. Mỗi trang in một dòng JSON đầy đủ dạng `{tab, page, count, next, response}`. Danh sách ở `response.list_data`; `next` chứa tham số trang kế tiếp hoặc null nếu hết dữ liệu. Không tự ghi file, refresh token hay thử lại request lỗi. Lỗi giữa chừng trả exit code 1; các trang trước đã in vẫn giữ nguyên. CLI Khám phá không in session đăng nhập.

## API TypeScript để dùng lại

```ts
// Một file .ts trong scripts/nodejs/
import { loginFromEnv } from './src/node.ts';
import { getExplore3, getExploreAvatarV4, getExploreOnlineV6 } from './src/endpoints/index.ts';

const ola = await loginFromEnv();
try {
  const first = await ola.call(getExploreOnlineV6, { gender: 0, cityID: '1' });
  console.log(first.items); // Giữ đầy đủ field của từng hồ sơ.
  if (first.next) {
    const second = await ola.call(getExploreOnlineV6, first.next);
    console.log(second.items);
  }
  // Hai tab khác có cùng cấu trúc kết quả:
  // await ola.call(getExplore3, { page: 0 });
  // await ola.call(getExploreAvatarV4, { page: 0 });
} finally {
  await ola.close();
}
```

- Mỗi tab là một endpoint riêng; `explore.ts` export `exploreTabs` = `{ online, verified, avatar }` nếu cần chọn tab theo tên.
- `uid` mặc định là tài khoản đăng nhập (`ola.session.localId`); truyền `uid` để ghi đè.
- Input: `page`, `gender`, `cityID`, `lastSeenPaging` (chỉ tab Online); các giá trị số phải là integer an toàn, không âm. `gender` nhận number 0/1/2 hoặc chuỗi `all`; `cityID` nhận chuỗi mã hoặc `all`. Field khác bị từ chối.
- Kết quả: `{tab, page, items, next, raw}`. `items` là `raw.list_data`, giữ nguyên toàn bộ trường. `next` là input của trang kế tiếp (giữ `uid` và bộ lọc, tăng page, kèm cursor với tab Online) — truyền lại nguyên cho cùng endpoint; chỉ dừng khi danh sách rỗng, không dựa vào số lượng ít hơn 50.
- `getExploreOnlineV6.build(session, input)` chỉ tạo `{method, path, body}`, không gọi mạng.
- `is_success` false kèm `list_data: []` là **kết quả rỗng** (không ai khớp, `next: null`), không phải lỗi. HTTP lỗi, `is_success` false mà thiếu `list_data` hoặc vẫn có phần tử, thiếu mảng `list_data`, hoặc Online có dữ liệu nhưng thiếu cursor hợp lệ đều gây lỗi. Không suy ra thành công chỉ từ HTTP 200.

`--help` và `--dry-run` của explore.ts kiểm tra input mà không đăng nhập hay gọi mạng.

## Bằng chứng và giới hạn

- AOT: `work/dae-aot-20261102/dart/ola_flutter_features_explore_explore_provider.dart`: `fetchData` tại `0x9909d0`, map response `list_data` tại `0x991144`, `UserModel.fromJson` tại `0x9915b4`, `updateAdvancedFilters` tại `0x9915cc`, `changeFilter` tại `0xaae6f4`, `build` tại `0xccff88`.
- UI: `ola_flutter_features_explore_explore.dart`, scroll callback `0x991ec0`. Enum label: `ola_flutter_core_model_user_model.dart`, Gender tại `0xab049c`, HeaderFilterType tại `0xaae2c0`; pool `pp.txt` xác nhận label Nữ/Nam.
- Runtime: `work/explore-investigation.log` và `work/explore-confirm.log` (ignored). Hook response tại `0x9910f0` chỉ in tên key, kiểu dữ liệu, số lượng và cursor, không in giá trị hồ sơ.
- Đã sửa [logger](../../work/scripts/ola_api_logger.js): Dart Smi `0` từng bị giải mã thành `null`; int64 từng bị in thành chuỗi. Log cũ có `page:null` / cursor null không phản ánh JSON thật. Kiểm tra decoder cho Smi zero, Dart null và integer 64-bit an toàn đã qua.
- AOT có enum `nearby` nhưng header của màn Khám phá phiên này chỉ dựng ba tab trên. Không coi Nearby là API thứ tư của màn này khi chưa chứng minh nhánh UI/runtime tương ứng.
- Chỉ quan sát danh sách và bộ lọc; không mở hồ sơ, không gửi tin hay like trong phiên điều tra này.
