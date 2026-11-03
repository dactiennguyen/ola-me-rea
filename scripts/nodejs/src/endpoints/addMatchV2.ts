// faApi2/addMatchV2.php — POST {uid1, uid2} -> tạo một lượt "thích"/match giữa hai tài khoản.
//
// MUTATE: ghi một match/like thật trên server (có thể sinh thông báo "Tim" cho uid2).
// Body source: work/api_inventory.csv:6 — ola_flutter_core_chat_gift_provider.dart:1518,
//   CandidateKeys uid1;uid2 [Suy luận/AOT]. Chưa bắt trên wire. Ngữ nghĩa uid1=tôi (actor,
//   người bấm thích) / uid2=mục tiêu là [Suy luận]. Call-site nằm trong gift provider ->
//   nhiều khả năng gắn với luồng tặng quà/thích trong chat.
// Doc: ../../../../docs/api/endpoints/addMatchV2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const addMatchV2 = defineEndpoint({
  name: 'addMatchV2',
  summary: 'Thích / tạo match với một tài khoản',
  method: 'POST',
  path: 'faApi2/addMatchV2.php',
  mutates: true,
  session: { uid1: 'localId' },
  fields: {
    uid1: text().describe('Người bấm thích'),
    uid2: text().describe('Người được thích'),
  },
});
