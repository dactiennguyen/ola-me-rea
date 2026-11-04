// Blog (bài đăng, bình luận, lượt thích, story): read-only loaders and the
// shapes the app shows. Response shapes observed on 2026-11-04 (app 27.7.9):
//   - getFeedNoiBatV4 / getPostByUserV7 / getPostByID: post items with
//     `id` (number), `timePost` (ms as a string), `listImage` (URLs joined by
//     ","), `imgSize` ("w:h" joined by ","), `location` (province code, -1 none).
//     Feed items carry the author (displayName, photoURL...); getPostByUserV7
//     items do not (the caller knows the author).
//   - napi/post/{id}/comments: {success, data, totalComments}, 10 per page from 0.
//   - getLikesV2: {data: users}, 30 per page from 0.
//   - napi/post/stories/feed: {data: [{user_id, displayName, has_unseen, stories}]}.
// Nothing here writes: no like, comment or post.

import type { OlaClient } from './client.ts';
import { normalizeUser, type ChatUser } from './chat.ts';
import { getFeedNoiBatV4 } from './endpoints/getFeedNoiBatV4.ts';
import { getLikesV2 } from './endpoints/getLikesV2.ts';
import { getPostByID } from './endpoints/getPostByID.ts';
import { getPostByUserV7 } from './endpoints/getPostByUserV7.ts';
import { postComments } from './endpoints/postComments.ts';
import { postStoriesFeed } from './endpoints/postStoriesFeed.ts';

export interface BlogAuthor {
  uid: string;
  displayName: string;
  photoURL: string;
  isVip: boolean;
  verified: boolean;
  level: number;
}

export interface BlogImage {
  url: string;
  /** 0 when the server sent no size. */
  width: number;
  height: number;
}

export interface BlogPost {
  id: string;
  author: BlogAuthor;
  text: string;
  /** ms since epoch; 0 when unknown. */
  at: number;
  likeCount: number;
  commentCount: number;
  images: BlogImage[];
  /** Province code ('' when the post has none). */
  province: string;
  feeling: string;
  checkIn: string;
}

export interface BlogComment {
  id: string;
  author: BlogAuthor;
  text: string;
  at: number;
  likeCount: number;
  stickerUrl: string;
  isLiked: boolean;
}

export interface Story {
  id: string;
  mediaUrl: string;
  /** 'image' or 'video' as sent by the server. */
  mediaType: string;
  caption: string;
  viewCount: number;
  at: number;
  expiresAt: number;
  viewed: boolean;
}

export interface StoryGroup {
  author: BlogAuthor;
  unseen: boolean;
  latestAt: number;
  stories: Story[];
}

/** Comments per page of napi/post/{id}/comments (observed). */
export const COMMENTS_PER_PAGE = 10;
/** Users per page of getLikesV2 (observed). */
export const LIKES_PER_PAGE = 30;

export function normalizeAuthor(raw: unknown, fallback?: Partial<BlogAuthor>): BlogAuthor {
  const o = asObject(raw);
  const uid = str(o.uid) || str(o.user_id);
  return {
    uid: uid || fallback?.uid || '',
    displayName: str(o.displayName) || fallback?.displayName || '',
    photoURL: str(o.photoURL) || fallback?.photoURL || '',
    isVip: 'isVip' in o ? truthy(o.isVip) : fallback?.isVip ?? false,
    verified: 'isVerifyAvatar' in o ? truthy(o.isVerifyAvatar) : fallback?.verified ?? false,
    level: num(o.level) ?? fallback?.level ?? 0,
  };
}

/** listImage "a,b" with imgSize "w:h,w:h" (same order; sizes may be missing). */
export function postImages(listImage: unknown, imgSize: unknown): BlogImage[] {
  const urls = str(listImage).split(',').map(s => s.trim()).filter(Boolean);
  const sizes = str(imgSize).split(',').map(s => s.trim());
  return urls.map((url, i) => {
    const [w, h] = (sizes[i] ?? '').split(':').map(Number);
    return { url, width: w && w > 0 ? w : 0, height: h && h > 0 ? h : 0 };
  });
}

/** One post; `author` fills in what the item lacks (getPostByUserV7 items have no name or photo). */
export function normalizePost(raw: unknown, author?: Partial<BlogAuthor>): BlogPost | null {
  const o = asObject(raw);
  const id = str(o.id) || str(o.postID);
  if (!id || id === '0') return null;
  const location = num(o.location);
  return {
    id,
    author: normalizeAuthor(o, author),
    text: str(o.text),
    at: num(o.timePost) ?? 0,
    likeCount: num(o.likeCount) ?? 0,
    commentCount: num(o.commentCount) ?? 0,
    images: postImages(o.listImage, o.imgSize),
    province: location !== null && location > 0 ? String(location) : '',
    feeling: str(o.feeling),
    checkIn: str(o.checkIn),
  };
}

export function normalizeComment(raw: unknown): BlogComment | null {
  const o = asObject(raw);
  const id = str(o.id);
  if (!id) return null;
  return {
    id,
    author: normalizeAuthor(o),
    text: str(o.content) || str(o.text),
    at: num(o.timePost) ?? 0,
    likeCount: num(o.likeCount) ?? 0,
    stickerUrl: str(o.stickerUrl),
    isLiked: truthy(o.isLiked),
  };
}

export function normalizeStoryGroup(raw: unknown): StoryGroup | null {
  const o = asObject(raw);
  const author = normalizeAuthor(o);
  if (!author.uid) return null;
  const stories = (Array.isArray(o.stories) ? o.stories : []).flatMap(item => {
    const s = asObject(item);
    const id = str(s.id);
    const mediaUrl = str(s.media_url);
    if (!id || !mediaUrl) return [];
    return [{
      id,
      mediaUrl,
      mediaType: str(s.media_type) || 'image',
      caption: str(s.caption),
      viewCount: num(s.view_count) ?? 0,
      at: dateMs(s.created_at),
      expiresAt: dateMs(s.expires_at),
      viewed: truthy(s.is_viewed),
    }];
  });
  if (!stories.length) return null;
  return { author, unseen: truthy(o.has_unseen), latestAt: num(o.latest_created_at) ?? stories.at(-1)!.at, stories };
}

/** Feed "Nổi bật", page from 0; an empty page means the end. */
export async function loadFeed(ola: OlaClient, page = 0): Promise<BlogPost[]> {
  return posts(await ola.call(getFeedNoiBatV4, { page, new: 1 }));
}

/** Posts of one user (`author` names them: the items do not), page from 0. */
export async function loadUserPosts(ola: OlaClient, author: Partial<BlogAuthor> & { uid: string }, page = 0): Promise<BlogPost[]> {
  return posts(await ola.call(getPostByUserV7, { uid: author.uid, page }), author);
}

export async function loadPost(ola: OlaClient, postID: string): Promise<BlogPost | null> {
  const raw = asObject(await ola.call(getPostByID, { postID }));
  return normalizePost(raw.data);
}

/** Comments of a post, page from 0, with the post's total. */
export async function loadComments(ola: OlaClient, postId: string, page = 0): Promise<{ comments: BlogComment[]; total: number }> {
  const raw = asObject(await ola.call(postComments, { postId, page }));
  const comments = listOf(raw).map(normalizeComment).filter((c): c is BlogComment => c !== null);
  return { comments, total: num(raw.totalComments) ?? comments.length };
}

/** Users who liked a post, page from 0. */
export async function loadLikes(ola: OlaClient, postID: string, page = 0): Promise<ChatUser[]> {
  return listOf(await ola.call(getLikesV2, { postID, page })).map(item => normalizeUser(item)).filter(u => u.uid);
}

/** Stories of the people this account follows, newest group first. */
export async function loadStories(ola: OlaClient): Promise<StoryGroup[]> {
  return listOf(await ola.call(postStoriesFeed))
    .map(normalizeStoryGroup)
    .filter((g): g is StoryGroup => g !== null)
    .sort((a, b) => Number(b.unseen) - Number(a.unseen) || b.latestAt - a.latestAt);
}

// ---- helpers -----------------------------------------------------------------

function posts(raw: unknown, author?: Partial<BlogAuthor>): BlogPost[] {
  return listOf(raw).map(item => normalizePost(item, author)).filter((p): p is BlogPost => p !== null);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function truthy(value: unknown): boolean {
  if (value === true || value === 'true') return true;
  const n = num(value);
  return n !== null && n > 0;
}

function dateMs(value: unknown): number {
  const n = num(value);
  if (n !== null) return n;
  const t = Date.parse(str(value));
  return Number.isFinite(t) ? t : 0;
}

function listOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const o = asObject(raw);
  for (const key of ['data', 'list_data']) {
    if (Array.isArray(o[key])) return o[key] as unknown[];
  }
  return [];
}
