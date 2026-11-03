// faApi2/addIgnoreMess.php — POST {id} -> bỏ qua / ẩn một tin nhắn trong phòng chat
//   theo định danh tin (id dạng "<ms_timestamp><uid>" như tin phòng).
//
// Body source: work/api_inventory.csv
//   (ola_flutter_features_room_room_provider.dart:4049, CandidateKeys=id) [Suy luận/AOT].
//   Chưa bắt trên dây trong phiên 2026-11-03 -> chưa có response.
// Doc: ../../../../docs/api/endpoints/addIgnoreMess.md

import { defineEndpoint, text } from '../endpoint.ts';

export const addIgnoreMess = defineEndpoint({
  name: 'addIgnoreMess',
  summary: 'Bỏ qua / ẩn một tin nhắn trong phòng chat',
  method: 'POST',
  path: 'faApi2/addIgnoreMess.php',
  mutates: true,
  fields: {
    id: text().describe('Định danh tin, dạng "<ms_timestamp><uid>"'),
  },
});
