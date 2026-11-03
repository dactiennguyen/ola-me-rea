// faApi2/getBlockV3.php — POST {uid} -> danh sách người dùng mà tài khoản đã chặn.
//
// Body source [Quan sát]: work/api_runtime_inventory.csv:35 (Flow "Danh sách chặn")
//   BodyKeys `uid`; khớp work/api_inventory.csv:27
//   (ola_flutter_features_block_block_provider.dart:1142). `uid` mặc định session.
// Doc: ../../../../docs/api/endpoints/getBlockV3.md

import { defineEndpoint, text } from '../endpoint.ts';

export const getBlockV3 = defineEndpoint({
  name: 'getBlockV3',
  summary: 'Danh sách người dùng đã chặn',
  method: 'POST',
  path: 'faApi2/getBlockV3.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản cần lấy danh sách chặn'),
  },
});
