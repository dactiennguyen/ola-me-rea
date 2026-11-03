// napi/users/unread-views — GET -> số lượt xem hồ sơ chưa đọc (badge "ai đã xem bạn").
//
// Body source: runtime capture 2026-11-03 (hồ sơ của mình) [Quan sát] — GET, không bắt được query trên dây;
//   work/api_inventory.csv (ola_flutter_features_profile_profile_provider.dart:691) list
//   `last_checked_views_at;last_checked` [Suy luận/AOT] — suy đoán là query param mốc thời gian
//   "đã xem tới đâu", nhưng chưa xác minh là query hay là field trong response.
// Người gọi xác định qua Bearer token.
// Doc: ../../../../docs/api/endpoints/usersUnreadViews.md

import { defineEndpoint, int } from '../endpoint.ts';

export const usersUnreadViews = defineEndpoint({
  name: 'usersUnreadViews',
  summary: 'Số lượt xem hồ sơ chưa đọc (badge)',
  method: 'GET',
  path: 'napi/users/unread-views',
  fields: {
    last_checked_views_at: int().optional().describe('Mốc epoch lần cuối mở danh sách lượt xem [Suy luận/AOT]'),
    last_checked: int().optional().describe('Mốc epoch "đã kiểm tra" [Suy luận/AOT]'),
  },
});
