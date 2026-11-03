// faApi2/apiAddPostV9.php — POST -> đăng một bài viết (post) lên news feed/blog.
//
// ⚠️ MUTATE: tạo bài viết mới trên server (hiện trên feed, đẩy noti NEW_CONTENT).
// Body source [Suy luận/AOT]: work/api_inventory.csv
//   (ola_flutter_features_create_create_post_provider.dart:1499, keys
//   uid;requestNewFeed;listImage;text;listDimen;isVip;feeling;checkIn). Chưa bắt trên wire.
//   Ảnh phải upload trước bằng upLoadImage2 rồi truyền URL vào listImage; listDimen là
//   kích thước (w/h) tương ứng từng ảnh. uid mặc định tài khoản đăng nhập (người đăng).
// Doc: ../../../../docs/api/endpoints/apiAddPostV9.md

import { z } from 'zod';
import { defineEndpoint, scalar, text } from '../endpoint.ts';

// feeling/checkIn: chuỗi hoặc object tuỳ call-site [Suy luận].
const attachment = () => z.union([scalar(), z.record(z.string(), z.unknown())]);

export const apiAddPostV9 = defineEndpoint({
  name: 'apiAddPostV9',
  summary: 'Đăng một bài viết lên feed',
  method: 'POST',
  path: 'faApi2/apiAddPostV9.php',
  mutates: true,
  session: { uid: 'localId' },
  fields: {
    uid: text().describe('Người đăng'),
    // Bài chỉ có ảnh gửi text "".
    text: z.string().default('').describe('Nội dung chữ'),
    listImage: z.array(text()).default([]).describe('URL ảnh đã upload trước bằng upLoadImage2'),
    listDimen: z.array(z.unknown()).optional().describe('Kích thước (w/h) từng ảnh, cùng thứ tự listImage'),
    // Cờ/giá trị tùy biến giữ nguyên kiểu từ caller, chỉ gửi khi được truyền (AOT).
    requestNewFeed: scalar().optional().describe('Yêu cầu server trả lại feed item vừa tạo'),
    isVip: scalar().optional().describe('Cờ tài khoản VIP'),
    feeling: attachment().optional().describe('Cảm xúc/mood đính kèm'),
    checkIn: attachment().optional().describe('Địa điểm check-in đính kèm'),
  },
  validate(value) {
    // Bài viết phải có nội dung chữ hoặc ít nhất một ảnh.
    if (!value.text.trim() && value.listImage.length === 0) {
      throw new Error('Provide text or at least one listImage URL.');
    }
  },
});
