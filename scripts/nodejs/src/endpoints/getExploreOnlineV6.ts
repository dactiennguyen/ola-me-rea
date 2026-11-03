// faApi2/getExploreOnlineV6.php — POST {uid, os, page, condition, lastSeenPaging}
//   -> tab "Online" của màn Khám phá (danh sách người đang hoạt động).
//
// Body source: [Quan sát] work/api_runtime_inventory.csv (BodyKeys
//   uid, os, page, condition, lastSeenPaging; Flow "Khám phá — Online") và
//   docs/api/luong-kham-pha.md. Các key lọc `gender`/`cityID` là [Suy luận/AOT]
//   (work/api_inventory.csv: ola_flutter_features_explore_explore_provider.dart:1059).
//   `condition` cố định = 2 cho tab Online. uid luôn là người đang xem (session).
// Doc: ../../../../docs/api/endpoints/getExploreOnlineV6.md

import { defineExplore } from './_explore.ts';

export const getExploreOnlineV6 = defineExplore({
  name: 'getExploreOnlineV6',
  summary: 'Khám phá — tab Online',
  path: 'faApi2/getExploreOnlineV6.php',
  tab: 'online',
});
