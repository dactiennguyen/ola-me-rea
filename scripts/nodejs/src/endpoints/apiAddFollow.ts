// faApi2/apiAddFollow.php — POST {uid1, uid2} -> theo dõi (toggle) một tài khoản.
//
// MUTATE: thay đổi quan hệ theo dõi trên server.
// Body source: work/api_inventory.csv — hai call-site cùng keys uid1;uid2
//   (ola_flutter_features_feed_sub_follow_provider.dart:1304 và
//    ola_flutter_features_profile_profile_provider.dart:3302) [Suy luận/AOT].
//   Chưa bắt trên wire. Ngữ nghĩa uid1=tôi (actor) / uid2=mục tiêu là [Suy luận].
// Doc: ../../../../docs/api/endpoints/apiAddFollow.md

import { defineEndpoint, text } from '../endpoint.ts';

export const apiAddFollow = defineEndpoint({
  name: 'apiAddFollow',
  summary: 'Theo dõi (toggle) một tài khoản',
  method: 'POST',
  path: 'faApi2/apiAddFollow.php',
  mutates: true,
  session: { uid1: 'localId' },
  fields: {
    uid1: text().describe('Người bấm theo dõi'),
    uid2: text().describe('Người được theo dõi'),
  },
});
