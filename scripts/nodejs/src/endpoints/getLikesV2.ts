// faApi2/getLikesV2.php — POST {postID, page} -> danh sách người đã thích một bài viết.
//
// Body source: work/api_inventory.csv
//   (ola_flutter_features_feed_sub_like_provider.dart:444, keys postID;page)
//   [Suy luận/AOT]. Chưa bắt trên wire. `page` mặc định 0 là [Suy luận].
// Doc: ../../../../docs/api/endpoints/getLikesV2.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const getLikesV2 = defineEndpoint({
  name: 'getLikesV2',
  summary: 'Danh sách người đã thích một bài viết',
  method: 'POST',
  path: 'faApi2/getLikesV2.php',
  fields: {
    // postID không suy ra được từ session: bắt buộc truyền.
    postID: text().describe('ID bài viết'),
    page: int().default(0).describe('Trang, bắt đầu từ 0'),
  },
});
