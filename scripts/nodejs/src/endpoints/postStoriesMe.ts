// napi/post/stories/me — GET -> danh sách story của chính tài khoản đăng nhập
//   (mục "Tin của tôi" trong hồ sơ).
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   (ola_flutter_features_profile_sub_my_stories_provider.dart:442, key uid). Chưa bắt trên wire.
//   Theo convention các endpoint `/me` (napi/caro/me, napi/users/unread-views) server
//   suy ra người dùng từ Bearer token; AOT vẫn liệt kê `uid` nên client gửi uid làm query,
//   mặc định về tài khoản đăng nhập. Có thể dư thừa so với token [Suy luận].
// Doc: ../../../../docs/api/endpoints/postStoriesMe.md

import { defineEndpoint, text } from '../endpoint.ts';

export const postStoriesMe = defineEndpoint({
  name: 'postStoriesMe',
  summary: 'Story của chính tài khoản đăng nhập ("Tin của tôi")',
  method: 'GET',
  path: 'napi/post/stories/me',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản (có thể dư thừa so với token)'),
  },
});
