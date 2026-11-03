// napi/post/stories — POST -> tạo một tin (story) theo API napi (luồng mới).
//
// ⚠️ MUTATE: tạo story mới trên server (đẩy noti NEW_CONTENT contenType="stories").
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   (ola_flutter_features_feed_story_StoryUploadNotifier.dart:812, keys
//   is_success;LOCATION;uid;media_url;caption;media_type;image;privacy). Chưa bắt trên wire.
//   `is_success` gần như chắc là trường RESPONSE lẫn vào union → KHÔNG gửi trong request.
//   media_url = media đã upload; media_type = "image"/"video"; image = thumbnail;
//   privacy = "public"/"private"/"friends"; LOCATION = vị trí (chưa rõ, [Chưa xác minh]).
//   uid mặc định tài khoản đăng nhập (người đăng).
// Doc: ../../../../docs/api/endpoints/postStories.md

import { defineEndpoint, text } from '../endpoint.ts';

export const postStories = defineEndpoint({
  name: 'postStories',
  summary: 'Tạo một story mới (napi)',
  method: 'POST',
  path: 'napi/post/stories',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người đăng'),
    media_url: text().optional().describe('URL media chính đã upload'),
    image: text().optional().describe('URL ảnh / thumbnail'),
    media_type: text().optional().describe('image | video'),
    caption: text().optional().describe('Chú thích'),
    privacy: text().optional().describe('public | private | friends'),
    LOCATION: text().optional().describe('Vị trí [Chưa xác minh]'),
  },
  validate(value) {
    // Story phải có nguồn media.
    if (value.media_url === undefined && value.image === undefined) {
      throw new Error('Provide media_url or image (URL of the uploaded media).');
    }
  },
});
