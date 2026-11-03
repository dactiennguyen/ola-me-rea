// faApi2/upStory.php — POST -> đăng một tin (story) theo API faApi2 (luồng cũ).
//
// ⚠️ MUTATE: tạo story mới trên server (hiện ở thanh story / mục "Tin").
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   (ola_flutter_features_feed_story_StoryUploadNotifier.dart:712, keys
//   story_media;caption;uid;image). Chưa bắt trên wire. Cùng notifier còn gọi
//   napi/post/stories (xem postStories) — upStory.php là biến thể faApi2.
//   story_media = media đã upload (URL), image = ảnh/thumbnail, caption = chú thích.
//   uid mặc định tài khoản đăng nhập (người đăng).
// Doc: ../../../../docs/api/endpoints/upStory.md

import { defineEndpoint, text } from '../endpoint.ts';

export const upStory = defineEndpoint({
  name: 'upStory',
  summary: 'Đăng story (biến thể faApi2 cũ)',
  method: 'POST',
  path: 'faApi2/upStory.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người đăng'),
    story_media: text().optional().describe('URL media chính đã upload'),
    image: text().optional().describe('URL ảnh/thumbnail'),
    caption: text().optional().describe('Chú thích'),
  },
  validate(value) {
    // Story phải có ít nhất một nguồn media.
    if (value.story_media === undefined && value.image === undefined) {
      throw new Error('Provide story_media or image (URL of the uploaded media).');
    }
  },
});
