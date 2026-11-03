// napi/users/updateLastSeen — POST {} -> cập nhật thời điểm "online gần nhất" của tài khoản.
//
// Body source: runtime capture 2026-11-03 (khởi động) [Quan sát] — body thật rỗng `{}`;
//   work/api_inventory.csv (ola_flutter_features_message_message_provider.dart:1249) không list key.
// Định danh người gọi lấy từ Bearer token (không truyền uid trong body).
// Doc: ../../../../docs/api/endpoints/usersUpdateLastSeen.md
//
// ⚠️ MUTATE: đổi trạng thái "last seen"/online trên server, đừng gọi tùy tiện.

import { defineEndpoint } from '../endpoint.ts';

export const usersUpdateLastSeen = defineEndpoint({
  name: 'usersUpdateLastSeen',
  summary: 'Cập nhật mốc online gần nhất (last seen)',
  method: 'POST',
  path: 'napi/users/updateLastSeen',
  mutates: true,
  fields: {},
});
