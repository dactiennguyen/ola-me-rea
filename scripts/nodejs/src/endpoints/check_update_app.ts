// faApi2/check_update_app.php — POST {uid} -> kiểm tra bản cập nhật app khi khởi động.
//
// Body source: [Quan sát] runtime capture 2026-11-03 (khởi động) gửi {"uid":1}
//   — uid ở đây là HẰNG SỐ 1 (không phải Firebase UID của tài khoản), xem
//   work/runtime_capture_session.log #3/#9 và work/api_runtime_inventory.csv.
//   [Suy luận] work/api_inventory.csv (ola_flutter_features_config_init_provider.dart:1684) liệt kê key `uid`.
// Doc: ../../../../docs/api/endpoints/check_update_app.md

import { z } from 'zod';
import { defineEndpoint, int, text } from '../endpoint.ts';

export const check_update_app = defineEndpoint({
  name: 'check_update_app',
  summary: 'Kiểm tra bản cập nhật app (uid hằng số 1)',
  method: 'POST',
  path: 'faApi2/check_update_app.php',
  fields: {
    // uid cho endpoint này là hằng số 1 đã bắt trên dây, không phải uid tài khoản.
    uid: z.union([int(), text()]).default(1).describe('Hằng số 1 đã bắt trên dây, không phải uid tài khoản'),
  },
  // Endpoint hỏi–đáp: `is_success`/`success` có thể chính là câu trả lời "không"
  // (chưa bắt response nào), nên không coi false là lỗi; xem response thô.
  success: false,
});
