// napi/users/getViewProfile — GET -> danh sách người đã xem hồ sơ của mình.
//
// Body source: work/api_inventory.csv
//   (ola_flutter_features_feed_sub_viewprofile_provider.dart:474) — GET, không list key [Suy luận/AOT].
//   Chưa bắt trên dây trong phiên 2026-11-03. Người gọi xác định qua Bearer token.
// Doc: ../../../../docs/api/endpoints/usersGetViewProfile.md

import { defineEndpoint } from '../endpoint.ts';

export const usersGetViewProfile = defineEndpoint({
  name: 'usersGetViewProfile',
  summary: 'Danh sách người đã xem hồ sơ của mình',
  method: 'GET',
  path: 'napi/users/getViewProfile',
  fields: {},
});
