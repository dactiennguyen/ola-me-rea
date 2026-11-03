// faApi2/addRestricted.php — POST {id} -> hạn chế (restrict) một người dùng theo id.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   ola_flutter_features_profile_profile_provider.dart:5148 (id).
//   Chỉ có đúng một field `id` (uid người bị hạn chế); danh tính người gọi đi
//   qua Bearer token. Chưa bắt trên dây.
// Doc: ../../../../docs/api/endpoints/addRestricted.md

import { defineEndpoint, text } from '../endpoint.ts';

export const addRestricted = defineEndpoint({
  name: 'addRestricted',
  summary: 'Hạn chế (restrict) một người dùng',
  method: 'POST',
  path: 'faApi2/addRestricted.php',
  mutates: true,
  fields: {
    id: text().describe('UID người bị hạn chế'),
  },
});
