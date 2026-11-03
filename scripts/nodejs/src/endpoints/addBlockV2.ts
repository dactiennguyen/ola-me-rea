// faApi2/addBlockV2.php — POST {uid, userBlock, friendID} -> chặn một người dùng
//   trong luồng chat/quà.
//
// Body source [Suy luận/AOT]: work/api_inventory.csv:2
//   (ola_flutter_core_chat_gift_provider.dart:1059) keys `uid;userBlock;friendID`.
//   `uid` = tài khoản thực hiện (mặc định session), `userBlock` = UID người bị chặn,
//   `friendID` = id quan hệ bạn/hội thoại (ngữ nghĩa chưa chắc). Chưa bắt trên dây.
// Doc: ../../../../docs/api/endpoints/addBlockV2.md

import { defineEndpoint, text } from '../endpoint.ts';

export const addBlockV2 = defineEndpoint({
  name: 'addBlockV2',
  summary: 'Chặn một người dùng từ luồng chat/quà',
  method: 'POST',
  path: 'faApi2/addBlockV2.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người thực hiện chặn'),
    userBlock: text().describe('UID người bị chặn'),
    friendID: text().describe('ID quan hệ bạn/hội thoại (ngữ nghĩa chưa chắc)'),
  },
});
