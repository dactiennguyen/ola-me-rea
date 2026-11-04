// faApi2/checkEmail.php — POST {email} -> kiểm tra một email đã đăng ký hay chưa.
//
// Theo AOT chỉ màn đăng ký gọi (RegisterScreenState._addUser, trước khi tạo tài
// khoản Firebase, nên không có Bearer); app đọc response.valid (bool).
// Luồng: ../../../../docs/api/luong-dang-ky.md
// Body source: work/api_inventory.csv (check_email_provider.dart:202, key `email`).
//   [Suy luận/AOT] — chưa bắt được trên dây trong phiên 2026-11-03.
// Doc: ../../../../docs/api/endpoints/checkEmail.md

import { defineEndpoint, text } from '../endpoint.ts';

export const checkEmail = defineEndpoint({
  name: 'checkEmail',
  summary: 'Kiểm tra một email đã đăng ký hay chưa',
  method: 'POST',
  path: 'faApi2/checkEmail.php',
  // Phiên không có email -> phải truyền email, không bao giờ gửi placeholder.
  session: { email: 'email' },
  fields: {
    email: text().describe('Email cần kiểm tra'),
  },
  // Endpoint hỏi–đáp: `is_success`/`success` có thể chính là câu trả lời "không"
  // (chưa bắt response nào), nên không coi false là lỗi; xem response thô.
  success: false,
});
