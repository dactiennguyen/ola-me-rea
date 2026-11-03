// faApi2/apiAddBlockChatV3.php — POST {name, uid} -> chặn chat với một người dùng.
//   uid = người bị chặn, name = tên hiển thị của họ (không mặc định theo session).
//
// Body source: work/api_inventory.csv
//   (ola_flutter_features_room_room_provider.dart:3786, CandidateKeys=name;uid) [Suy luận/AOT].
//   Chưa bắt trên dây trong phiên 2026-11-03 -> chưa có response; uid là self hay target
//   chưa kiểm chứng runtime (suy từ ngữ cảnh "chặn chat").
// Doc: ../../../../docs/api/endpoints/apiAddBlockChatV3.md

import { defineEndpoint, text } from '../endpoint.ts';

export const apiAddBlockChatV3 = defineEndpoint({
  name: 'apiAddBlockChatV3',
  summary: 'Chặn chat với một người dùng',
  method: 'POST',
  path: 'faApi2/apiAddBlockChatV3.php',
  mutates: true,
  fields: {
    name: text().describe('Tên hiển thị người bị chặn'),
    uid: text().describe('UID người bị chặn (không lấy từ session)'),
  },
});
