// faApi2/addStrict.php — POST {isStrict, uid} -> bật/tắt cờ "strict" cho tài khoản.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_profile_profile_provider.dart:5294 (isStrict;uid).
//   Chưa bắt trên dây -> chưa xác minh `isStrict` gửi dạng bool hay 0/1.
// Doc: ../../../../docs/api/endpoints/addStrict.md

import { z } from 'zod';
import { defineEndpoint, text } from '../endpoint.ts';

export const addStrict = defineEndpoint({
  name: 'addStrict',
  summary: 'Bật/tắt cờ strict của tài khoản',
  method: 'POST',
  path: 'faApi2/addStrict.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    isStrict: z.boolean().describe('true bật / false tắt (chưa xác minh bool hay 0/1)'),
    uid: text().describe('Tài khoản áp dụng'),
  },
});
