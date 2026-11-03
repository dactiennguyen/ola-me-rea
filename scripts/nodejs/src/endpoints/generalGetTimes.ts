// napi/general/getTimes — GET -> server time (Unix giây) dùng để ký request.
//
// Body source: work/api_runtime_inventory.csv + runtime_capture_session.log #1
//   (GET không tham số, chạy lúc khởi động trước login). [Quan sát].
//   OlaClient.serverTime() (src/client.ts) đọc `serverTime` của endpoint này để
//   tính header hash cho mọi call; riêng request đó được ký bằng giờ máy.
//   Gọi qua ola.call(generalGetTimes) thì request được ký bằng giờ server như mọi
//   call khác — vẫn hợp lệ.
// Doc: ../../../../docs/api/endpoints/generalGetTimes.md

import { defineEndpoint } from '../endpoint.ts';

export const generalGetTimes = defineEndpoint({
  name: 'generalGetTimes',
  summary: 'Giờ server (Unix giây) dùng để ký request',
  method: 'GET',
  path: 'napi/general/getTimes',
  fields: {},
});
