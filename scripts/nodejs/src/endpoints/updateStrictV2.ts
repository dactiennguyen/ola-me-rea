// faApi2/updateStrictV2.php — POST {label, score, uid[, admin, photoURL, action]}
//   -> cập nhật nhãn/điểm "strict" (kiểm duyệt vi phạm) của một người dùng.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv (hai biến thể call-site)
//   ola_flutter_features_profile_profile_provider.dart:4630      (label;admin;uid;photoURL;score)
//   ola_flutter_features_violation_ViolationListScreen.dart:2191 (label;admin;uid;photoURL;score;action)
//   Chưa bắt trên dây. Đây là hành động kiểm duyệt (thường cần quyền admin).
// Doc: ../../../../docs/api/endpoints/updateStrictV2.md

import { z } from 'zod';
import { defineEndpoint, int, text } from '../endpoint.ts';

export const updateStrictV2 = defineEndpoint({
  name: 'updateStrictV2',
  summary: 'Cập nhật nhãn/điểm strict (kiểm duyệt) của người dùng',
  method: 'POST',
  path: 'faApi2/updateStrictV2.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    label: text().describe('Nhãn vi phạm/strict'),
    score: int().describe('Điểm strict'),
    uid: text().describe('Người bị chấm strict'),
    admin: text().optional().describe('Admin thực hiện'),
    // Người không đặt ảnh có photoURL "".
    photoURL: z.string().optional().describe('Ảnh kèm theo'),
    action: text().optional().describe('Hành động áp dụng (biến thể ViolationList)'),
  },
});
