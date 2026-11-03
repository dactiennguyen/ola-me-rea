// faApi2/getFeedNoiBatV4.php — POST {uid, page, new} -> feed "Nổi bật" (Blog).
//
// Body source: runtime capture 2026-11-03 — work/api_runtime_inventory.csv
//   (Flow "Blog", BodyKeys uid,page,new) [Quan sát]; đối chiếu
//   work/api_inventory.csv (ola_flutter_features_feed_feed_provider.dart:796).
//   `page`/`new` mặc định (0/1) là [Suy luận].
// Doc: ../../../../docs/api/endpoints/getFeedNoiBatV4.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const getFeedNoiBatV4 = defineEndpoint({
  name: 'getFeedNoiBatV4',
  summary: 'Feed "Nổi bật" ở tab Blog (phân trang)',
  method: 'POST',
  path: 'faApi2/getFeedNoiBatV4.php',
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Tài khoản đang xem feed'),
    page: int().default(0).describe('Trang, bắt đầu từ 0'),
    new: int().default(1).describe('Cờ tải bản mới nhất [Suy luận]'),
  },
});
