// faApi2/getExploreAvatarV4.php — POST {uid, os, page}
//   -> tab "Ảnh có mặt" của màn Khám phá (hồ sơ có ảnh gương mặt).
//
// Body source: [Quan sát] work/api_runtime_inventory.csv (BodyKeys
//   uid, os, page; Flow "Khám phá — Ảnh có mặt") và docs/api/luong-kham-pha.md.
//   Các key lọc `gender`/`cityID` là [Suy luận/AOT] (work/api_inventory.csv:
//   ola_flutter_features_explore_explore_provider.dart:1133). Tab này không gửi
//   `condition` và không dùng cursor lastSeenPaging. uid luôn là người đang xem (session).
// Doc: ../../../../docs/api/endpoints/getExploreAvatarV4.md

import { defineExplore } from './_explore.ts';

export const getExploreAvatarV4 = defineExplore({
  name: 'getExploreAvatarV4',
  summary: 'Khám phá — tab Ảnh có mặt',
  path: 'faApi2/getExploreAvatarV4.php',
  tab: 'avatar',
});
