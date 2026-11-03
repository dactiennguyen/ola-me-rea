// faApi2/updateStrictDel.php — POST {uid, postID, tyleP, avatar, delAll} -> xoá bản ghi
//   vi phạm/"strict" của một người dùng: xoá 1 bài (postID) hoặc xoá tất cả (delAll).
//
// MUTATE: xoá dữ liệu kiểm duyệt trên server (hành động quản trị, thường cần quyền admin).
// Body source [Suy luận/AOT]: work/api_inventory.csv:92
//   (ola_flutter_features_violation_violation_provider.dart:476,
//    CandidateKeys `uid;postID;tyleP;avatar;delAll`). Chưa bắt trên dây.
//   Cùng nhóm vi phạm với updateStrictV2.php / addStrict.php. `uid` mặc định tài khoản
//   đăng nhập (giống updateStrictV2), truyền uid khác để thao tác người bị chấm strict.
// Doc: ../../../../docs/api/endpoints/updateStrictDel.md

import { z } from 'zod';
import { defineEndpoint, oneOf, scalar, text } from '../endpoint.ts';

export const updateStrictDel = defineEndpoint({
  name: 'updateStrictDel',
  summary: 'Xoá bản ghi vi phạm: 1 bài (postID) hoặc tất cả (delAll)',
  method: 'POST',
  path: 'faApi2/updateStrictDel.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người bị xoá bản ghi vi phạm'),
    postID: scalar().optional().describe('Bài vi phạm cần xoá (xoá 1 bài)'),
    tyleP: scalar().optional().describe('Loại bài (type post) kèm theo'),
    // Avatar của người không đặt ảnh là "".
    avatar: z.string().optional().describe('URL avatar của người bị xử lý'),
    delAll: scalar().optional().describe('Xoá TẤT CẢ bản ghi của uid'),
  },
  // Chống xoá nhầm: nêu rõ đúng một thao tác, xoá 1 bài hoặc xoá tất cả.
  validate: value => oneOf(value, ['postID', 'delAll'], { required: true }),
});
