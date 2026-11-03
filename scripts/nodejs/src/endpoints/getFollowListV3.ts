// faApi2/getFollowListV3.php — POST {uid, page, isFollowing, myUid}
//   -> danh sách "đang theo dõi" / "người theo dõi" của một tài khoản.
//
// Body source: work/api_inventory.csv
//   (ola_flutter_features_feed_sub_follow_provider.dart:592, keys
//   uid;page;isFollowing;myUid) [Suy luận/AOT]. Chưa bắt trên wire.
//   `isFollowing` (1=đang theo dõi, 0=người theo dõi) và mặc định page là [Suy luận].
// Doc: ../../../../docs/api/endpoints/getFollowListV3.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const getFollowListV3 = defineEndpoint({
  name: 'getFollowListV3',
  summary: 'Danh sách đang theo dõi / người theo dõi của một tài khoản',
  method: 'POST',
  path: 'faApi2/getFollowListV3.php',
  // Cả hai mặc định về chính tài khoản đăng nhập, khớp cách app xem danh sách của chính mình.
  session: { uid: 'localId', myUid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản đang được xem danh sách'),
    page: int().default(0).describe('Trang, bắt đầu từ 0'),
    isFollowing: int().default(1).describe('1 = đang theo dõi, 0 = người theo dõi [Suy luận]'),
    myUid: text().describe('Người đang xem'),
  },
});
