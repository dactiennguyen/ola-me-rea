// faApi2/getExplore3.php — POST {uid, os, page, condition}
//   -> tab "Đã xác thực" của màn Khám phá (hồ sơ đã xác minh).
//
// Body source: [Quan sát] work/api_runtime_inventory.csv (BodyKeys
//   uid, os, page, condition; Flow "Khám phá — Đã xác thực") và
//   docs/api/luong-kham-pha.md. Các key lọc `gender`/`cityID` là [Suy luận/AOT]
//   (work/api_inventory.csv: ola_flutter_features_explore_explore_provider.dart:1211).
//   `condition` cố định = 1 cho tab Đã xác thực; không dùng cursor lastSeenPaging.
//   uid luôn là người đang xem (session).
// Doc: ../../../../docs/api/endpoints/getExplore3.md

import { defineExplore } from './_explore.ts';

export const getExplore3 = defineExplore({
  name: 'getExplore3',
  summary: 'Khám phá — tab Đã xác thực',
  path: 'faApi2/getExplore3.php',
  tab: 'verified',
});
