// faApi2/inserNotiV2.php — POST {actionUid, uid, <type>, <context...>} -> chèn một
//   thông báo cho người nhận (uid): ai đó thả tim/bình luận/tặng quà/theo dõi/match...
//
// MUTATE: tạo một bản ghi thông báo đẩy tới người dùng khác.
// Body source [Suy luận/AOT]: work/api_inventory.csv (13 call-site, dòng 52–64).
//   Mọi call-site đều gửi `actionUid` (người thực hiện = tôi) và `uid` (người nhận);
//   kèm một token loại thông báo (GIFT/MATCH/FRIEND/FOLLOW/LIKE_COMMENT/TOPUPXU/REMIND/
//   icReact...) và các field ngữ cảnh (postID/commentId/content/stickerURL/displayName/...).
//   Chưa bắt trên dây -> chưa xác minh token là value của `type` hay là field cờ riêng.
// Doc: ../../../../docs/api/endpoints/inserNotiV2.md

import { defineEndpoint, extraFields, scalar, text } from '../endpoint.ts';

export const inserNotiV2 = defineEndpoint({
  name: 'inserNotiV2',
  summary: 'Chèn một thông báo cho người nhận (tim/bình luận/quà/theo dõi/match...)',
  method: 'POST',
  path: 'faApi2/inserNotiV2.php',
  mutates: true,
  session: { actionUid: 'localId' },
  fields: {
    actionUid: text().describe('Người gây ra thông báo (tôi)'),
    uid: text().describe('Người NHẬN thông báo'),
    type: text().optional().describe('Token loại thông báo: GIFT/MATCH/FRIEND/FOLLOW/LIKE_COMMENT/TOPUPXU/REMIND/...'),
    // Các field ngữ cảnh đã thấy ở call-site (tùy biến thể).
    postID: scalar().optional().describe('Bài viết liên quan'),
    commentId: scalar().optional().describe('Bình luận liên quan (like bình luận)'),
    content: text().optional().describe('Nội dung bình luận kèm theo'),
    stickerURL: text().optional().describe('Sticker kèm bình luận'),
    displayName: text().optional().describe('Tên hiển thị (biến thể follow/kết bạn)'),
    // Field/cờ còn lại (icReact, action, mess, FRIEND, FOLLOW, GIFT, ...); không được ghi đè uid/actionUid.
    extra: extraFields(),
  },
});
