// napi/users/nearby — GET ?lat&lng&gender&page -> danh sách người dùng ở gần một toạ độ.
//   Màn "Quanh đây" (nearby). READ: chỉ đọc, không đổi trạng thái server.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:129
//   (ola_flutter_features_nearby_nearby_provider.dart:834) CandidateKeys = lat;lng;gender;page.
//   Chưa bắt trên wire -> ngữ nghĩa `gender` (bộ lọc) và `page` (phân trang) là [Suy luận].
//   Người gọi xác định qua Bearer token; không có uid trong query.
// Doc: ../../../../docs/api/endpoints/usersNearby.md

import { z } from 'zod';
import { defineEndpoint, int } from '../endpoint.ts';

export const usersNearby = defineEndpoint({
  name: 'usersNearby',
  summary: 'Người dùng ở gần một toạ độ (màn Quanh đây)',
  method: 'GET',
  path: 'napi/users/nearby',
  fields: {
    // Toạ độ là số thực, không dùng int().
    lat: z.number().describe('Vĩ độ'),
    lng: z.number().describe('Kinh độ'),
    page: int().default(0).describe('Trang phân trang [Suy luận]'),
    gender: int().optional().describe('Bộ lọc giới tính [Suy luận]'),
  },
});
