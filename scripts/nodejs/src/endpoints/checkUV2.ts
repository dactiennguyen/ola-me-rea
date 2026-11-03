// faApi2/checkUV2.php — POST {uid} -> kiểm tra trạng thái tài khoản (user check) khi khởi động.
//
// Body source: [Quan sát] runtime capture 2026-11-03 (khởi động) gửi
//   {"uid":"<firebase uid>"} — xem work/runtime_capture_session.log #4/#10 và
//   work/api_runtime_inventory.csv. [Suy luận] work/api_inventory.csv
//   (ola_flutter_features_config_init_provider.dart:1243) liệt kê key `uid`.
//   uid mặc định = tài khoản đang đăng nhập.
// Doc: ../../../../docs/api/endpoints/checkUV2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const checkUV2 = defineEndpoint({
  name: 'checkUV2',
  summary: 'Kiểm tra trạng thái tài khoản lúc khởi động',
  method: 'POST',
  path: 'faApi2/checkUV2.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần kiểm tra'),
  },
  // Endpoint hỏi–đáp: `is_success`/`success` có thể chính là câu trả lời "không"
  // (chưa bắt response nào), nên không coi false là lỗi; xem response thô.
  success: false,
});
