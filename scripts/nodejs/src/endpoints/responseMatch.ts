// faApi2/responseMatch.php — POST {uid1, uid2, response} -> phản hồi một lượt match
//   (đồng ý / từ chối lời thích từ người khác).
//
// MUTATE: ghi quyết định match thật trên server (đồng ý -> tạo cặp match; có thể sinh thông báo).
// Body source: work/api_inventory.csv:68 & :69 — hai call-site cùng keys uid1;uid2;response trong
//   ola_flutter_features_match_match_provider.dart:403 và :2105 [Suy luận/AOT]. Chưa bắt trên wire.
//   Ngữ nghĩa uid1=tôi (người phản hồi) / uid2=người đã thích tôi; `response` = quyết định
//   (suy luận 1=đồng ý, 0=từ chối) là [Suy luận], giá trị cụ thể [Chưa xác minh].
// Doc: ../../../../docs/api/endpoints/responseMatch.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const responseMatch = defineEndpoint({
  name: 'responseMatch',
  summary: 'Đồng ý / từ chối một lượt thích (match)',
  method: 'POST',
  path: 'faApi2/responseMatch.php',
  mutates: true,
  session: { uid1: 'localId' },
  fields: {
    uid1: text().describe('Người phản hồi (tôi)'),
    uid2: text().describe('Người đã thích mình'),
    response: int().describe('Quyết định: 1 = đồng ý, 0 = từ chối [Suy luận]'),
  },
});
