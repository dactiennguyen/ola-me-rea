// napi/reward/checkReward — POST {uid, condition} -> kiểm tra/nhận phần thưởng sau
//   khi xác minh khuôn mặt (liveness / face-compare KYC).
//
// MUTATE: có thể ghi nhận/nhả thưởng cho tài khoản.
// Body source [Suy luận/AOT]: work/api_inventory.csv:126
//   (ola_flutter_features_liveness_face_compare_provider.dart:251) CandidateKeys =
//   uid;condition. Chưa bắt trên wire -> kiểu/giá trị `condition` là [Suy luận]
//   (coi như mã điều kiện dạng số, giống condition của Khám phá). uid mặc định session.
// Doc: ../../../../docs/api/endpoints/rewardCheckReward.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const rewardCheckReward = defineEndpoint({
  name: 'rewardCheckReward',
  summary: 'Kiểm tra/nhận thưởng sau xác minh khuôn mặt',
  method: 'POST',
  path: 'napi/reward/checkReward',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Chủ tài khoản nhận thưởng'),
    condition: int().describe('Mã điều kiện thưởng [Suy luận]'),
  },
  // Endpoint hỏi–đáp: `is_success`/`success` có thể chính là câu trả lời "không"
  // (chưa bắt response nào), nên không coi false là lỗi; xem response thô.
  success: false,
});
