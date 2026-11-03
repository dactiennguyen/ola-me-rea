// napi/post/stories/:storyId[/:action] — thao tác trên MỘT story theo id (path động).
//
// ⚠️ MUTATE: xem/thả cảm xúc/xoá một story (thay đổi trạng thái server).
// Body source [Chưa xác minh]: work/api_inventory.csv liệt kê 4 call-site tới
//   napi/post/stories/ (method/keys = unknown) ở
//   ola_flutter_features_feed_story_StoryApiService.dart:187/453/750/985.
//   work/libid_map.txt (_StoryViewerScreenState) cho thấy các thao tác tương ứng:
//   _markStoryAsViewed, _onReact, _onTapDeleteCurrentStory, _fetchViewersForCurrentStory.
//   -> suy ra client này gọi: POST .../<id>/view (đánh dấu đã xem),
//      POST .../<id>/react (thả cảm xúc), DELETE .../<id> (xoá),
//      GET .../<id>/viewers (danh sách người xem). Sub-path + method CHƯA kiểm chứng.
// Doc: ../../../../docs/api/endpoints/postStoriesId.md

import { z } from 'zod';
import { defineEndpoint, scalar, segment } from '../endpoint.ts';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export const postStoriesId = defineEndpoint({
  name: 'postStoriesId',
  summary: 'Thao tác trên một story: view / react / xoá / viewers [Chưa xác minh]',
  method: value => value.method,
  path: 'napi/post/stories/:storyId/:action?',
  mutates: true,
  fields: {
    storyId: segment().describe('ID story'),
    action: segment().optional().describe('Sub-path: view | react | viewers | ...'),
    method: z.string().default('POST').transform(m => m.toUpperCase()).pipe(z.enum(METHODS))
      .describe('HTTP method, mặc định POST'),
    body: z.record(z.string(), z.unknown()).optional().describe('Body JSON (method khác GET)'),
    query: z.record(z.string(), scalar()).optional().describe('Query { tên: scalar } (chỉ GET)'),
  },
  validate(value) {
    if (value.method === 'GET' && value.body !== undefined) throw new Error('body is not sent with GET; use query.');
    if (value.method !== 'GET' && value.query !== undefined) throw new Error('query is only sent with GET; use body.');
  },
  request: value => (value.method === 'GET' ? { query: value.query ?? {} } : { body: value.body ?? {} }),
});
