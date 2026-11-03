// faApi2/removeFollower.php — POST {uid1, uid2} -> gỡ một người đang theo dõi bạn.
//
// MUTATE: thay đổi quan hệ theo dõi trên server.
// Body source: work/api_inventory.csv
//   (ola_flutter_features_feed_sub_follow_provider.dart:1940, keys uid1;uid2)
//   [Suy luận/AOT]. Chưa bắt trên wire. Ngữ nghĩa uid1=tôi / uid2=follower là [Suy luận].
// Doc: ../../../../docs/api/endpoints/removeFollower.md

import { defineEndpoint, text } from '../endpoint.ts';

export const removeFollower = defineEndpoint({
  name: 'removeFollower',
  summary: 'Gỡ một người đang theo dõi bạn',
  method: 'POST',
  path: 'faApi2/removeFollower.php',
  mutates: true,
  session: { uid1: 'localId' },
  fields: {
    uid1: text().describe('Tài khoản của bạn (người gỡ follower)'),
    uid2: text().describe('Follower cần gỡ'),
  },
});
