// napi/users/addViewProfile — POST {viewed_ids[, incognito]} -> ghi lượt xem hồ sơ (theo lô).
//
// Body source: runtime capture 2026-11-03 (rời hồ sơ → gửi lô) [Quan sát] — body thật
//   `{"viewed_ids":["<targetUid>"]}`; work/api_inventory.csv
//   (ola_flutter_core_common_ProfileViewTracker.dart:312) list `incognito;viewed_ids`.
//   `incognito` chỉ thấy trong AOT, chưa bắt trên dây [Suy luận/AOT].
// Người xem = chủ Bearer token; viewed_ids = danh sách uid bị xem (bắt buộc).
// Doc: ../../../../docs/api/endpoints/usersAddViewProfile.md
//
// ⚠️ MUTATE: ghi lượt xem hồ sơ của người khác lên server, đừng gọi tùy tiện.

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const usersAddViewProfile = defineEndpoint({
  name: 'usersAddViewProfile',
  summary: 'Ghi lượt xem hồ sơ người khác (theo lô)',
  method: 'POST',
  path: 'napi/users/addViewProfile',
  mutates: true,
  fields: {
    viewed_ids: z.array(text()).min(1).describe('Danh sách uid vừa xem (JSON array, không rỗng)'),
    incognito: z.boolean().optional().describe('Xem ẩn danh [Suy luận/AOT]'),
  },
});
