// napi/post/stories/feed — GET -> danh sách story của những người đang theo dõi
//   (thanh story ở màn Blog/News feed).
//
// Body source [Quan sát]: runtime capture 2026-11-03 — luồng "Blog" gọi GET
//   napi/post/stories/feed KHÔNG kèm query (work/api_runtime_inventory.csv,
//   work/runtime_capture_live.log). work/api_inventory.csv
//   (ola_flutter_features_feed_story_stories_provider.dart:1138) liệt kê `viewer_id`
//   như một query tùy chọn → chưa thấy trên wire, để optional [Suy luận].
// Doc: ../../../../docs/api/endpoints/postStoriesFeed.md

import { defineEndpoint, text } from '../endpoint.ts';

export const postStoriesFeed = defineEndpoint({
  name: 'postStoriesFeed',
  summary: 'Story của những người đang theo dõi (thanh story màn Blog)',
  method: 'GET',
  path: 'napi/post/stories/feed',
  fields: {
    // Chỉ gửi khi truyền (wire thực tế không kèm query).
    viewer_id: text().optional().describe('UID người xem [Suy luận, chưa thấy trên wire]'),
  },
});
