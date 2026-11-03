// faApi2/getUserInfoV7.php — POST {targetUid, myUid} -> hồ sơ của một người dùng.
//
// Body source [Quan sát]: runtime capture 2026-11-03 (luồng "xem hồ sơ"),
//   work/runtime_capture_session.log #29/#35 body {"targetUid":...,"myUid":...};
//   work/api_runtime_inventory.csv + work/api_inventory.csv
//   (ola_flutter_features_profile_profile_provider.dart:5799, keys targetUid;myUid).
//   targetUid = người được xem (bắt buộc); myUid = người đang xem, mặc định tài khoản đăng nhập.
// Doc: ../../../../docs/api/endpoints/getUserInfoV7.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getUserInfoV7 = defineEndpoint({
  name: 'getUserInfoV7',
  summary: 'Hồ sơ của một người dùng (màn xem hồ sơ)',
  method: 'POST',
  path: 'faApi2/getUserInfoV7.php',
  session: { myUid: 'localId' },
  fields: {
    targetUid: text().describe('Người được xem'),
    myUid: text().describe('Người đang xem'),
  },
});
