// napi/users/update — PUT {name?, birth_year?, gender?, location?, job?, introduceText?}
//   -> cập nhật hồ sơ (màn Chỉnh sửa hồ sơ). Cập nhật từng phần: chỉ gửi field đổi.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:133-134
//   (dio_src_dio_dio_for_native.dart:4556 = PUT; ola_flutter_features_profile_sub_edit_provider.dart:410
//   CandidateKeys = name;birth_year;gender;location;job;introduceText). Chưa bắt trên wire
//   -> kiểu `birth_year`/`gender` (số) là [Suy luận]. Người gọi = chủ token (không gửi uid).
// Doc: ../../../../docs/api/endpoints/usersUpdate.md

import { defineEndpoint, int, text } from '../endpoint.ts';

export const usersUpdate = defineEndpoint({
  name: 'usersUpdate',
  summary: 'Cập nhật hồ sơ (chỉ gửi các field đổi)',
  method: 'PUT',
  path: 'napi/users/update',
  mutates: true,
  fields: {
    name: text().optional(),
    birth_year: int().optional(),
    gender: int().optional(),
    location: text().optional(),
    job: text().optional(),
    introduceText: text().optional(),
  },
  validate(value) {
    if (Object.keys(value).length === 0) {
      throw new Error('Provide at least one profile field to update (name/birth_year/gender/location/job/introduceText).');
    }
  },
});
