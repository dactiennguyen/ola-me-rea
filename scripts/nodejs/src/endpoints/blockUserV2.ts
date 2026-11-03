// faApi2/blockUserV2.php — POST {id, isForever, uid} -> chặn một người dùng.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv (hai call-site trùng key)
//   ola_flutter_features_profile_profile_provider.dart:4829        (id;isForever;uid)
//   ola_flutter_features_setting_local_settings_provider.dart:518  (id;isForever)
//   `id` = uid người bị chặn, `uid` = tài khoản thực hiện (mặc định session),
//   `isForever` = chặn vĩnh viễn (mặc định false). Chưa bắt trên dây.
// Doc: ../../../../docs/api/endpoints/blockUserV2.md

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const blockUserV2 = defineEndpoint({
  name: 'blockUserV2',
  summary: 'Chặn một người dùng (tạm thời hoặc vĩnh viễn)',
  method: 'POST',
  path: 'faApi2/blockUserV2.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    id: text().describe('UID người bị chặn'),
    isForever: z.boolean().default(false).describe('Chặn vĩnh viễn'),
    uid: text().describe('Người thực hiện chặn'),
  },
});
