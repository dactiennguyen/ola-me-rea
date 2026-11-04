import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  loadComments, loadFeed, loadLikes, loadStories, loadUserPosts,
  normalizeComment, normalizePost, normalizeStoryGroup, postImages,
} from '../src/blog.ts';
import { OlaClient } from '../src/client.ts';

/** Answers each path with a canned body and records the requests. */
function fakeOla(replies: Record<string, unknown>) {
  const calls: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname.slice(1);
    if (path === 'napi/general/getTimes') return Response.json({ serverTime: 1_700_000_000 });
    calls.push({ method: init.method ?? 'GET', path, body: init.body ? JSON.parse(String(init.body)) : {} });
    return Response.json(replies[path] ?? { is_success: true, data: [] });
  }) as typeof globalThis.fetch;
  return { ola: new OlaClient({ session: { idToken: 't', localId: 'me-uid' }, fetch }), calls };
}

// Shapes observed on 2026-11-04 (values made up).
const FEED_ITEM = {
  text: 'Mùa đông', id: 205358, timePost: '1700011483283', likeCount: 86, commentCount: 2,
  listImage: 'https://cdn/a.jpg,https://cdn/b.jpg', imgSize: '1080:1293,1080:1451',
  displayName: 'Rose', fcmToken: 'tok', location: 79, uid: 'author-uid', photoURL: 'https://cdn/p.jpg',
  isVerifyAvatar: true, isVip: false, level: 2, feeling: '', checkIn: '',
};

describe('normalizePost', () => {
  it('reads a feed item', () => {
    assert.deepEqual(normalizePost(FEED_ITEM), {
      id: '205358',
      author: { uid: 'author-uid', displayName: 'Rose', photoURL: 'https://cdn/p.jpg', isVip: false, verified: true, level: 2 },
      text: 'Mùa đông', at: 1700011483283, likeCount: 86, commentCount: 2,
      images: [{ url: 'https://cdn/a.jpg', width: 1080, height: 1293 }, { url: 'https://cdn/b.jpg', width: 1080, height: 1451 }],
      province: '79', feeling: '', checkIn: '',
    });
  });

  it('fills the author of a getPostByUserV7 item, drops location -1 and items without id', () => {
    const { displayName, photoURL, isVerifyAvatar, isVip, level, ...bare } = FEED_ITEM;
    void displayName; void photoURL; void isVerifyAvatar; void isVip; void level;
    const post = normalizePost({ ...bare, location: -1 }, { uid: 'author-uid', displayName: 'Rose', verified: true });
    assert.equal(post?.author.displayName, 'Rose');
    assert.equal(post?.author.verified, true);
    assert.equal(post?.province, '');
    assert.equal(normalizePost({ text: 'x' }), null);
  });
});

describe('postImages', () => {
  it('pairs URLs with sizes and tolerates missing sizes', () => {
    assert.deepEqual(postImages('', ''), []);
    assert.deepEqual(postImages('https://a, https://b', '10:20'), [
      { url: 'https://a', width: 10, height: 20 },
      { url: 'https://b', width: 0, height: 0 },
    ]);
  });
});

describe('comments and stories', () => {
  it('reads a comment', () => {
    assert.deepEqual(normalizeComment({
      id: 1007102, content: 'a', likeCount: 0, timePost: '1793781544757', displayName: ' Kim',
      photoURL: 'https://p', fcmToken: 'tok', uid: 'u1', isVip: 0, stickerUrl: '', isLiked: false,
    }), {
      id: '1007102', text: 'a', at: 1793781544757, likeCount: 0, stickerUrl: '', isLiked: false,
      author: { uid: 'u1', displayName: ' Kim', photoURL: 'https://p', isVip: false, verified: false, level: 0 },
    });
  });

  it('reads a story group and skips stories without media', () => {
    const group = normalizeStoryGroup({
      user_id: 'u2', displayName: 'An', photoURL: 'https://p', has_unseen: true, latest_created_at: 1793773729000,
      stories: [
        { id: 8289, media_url: 'https://s/1.jpg', media_type: 'image', caption: '', view_count: 46,
          created_at: '2026-11-04T06:28:49.000Z', expires_at: '2026-11-05T06:28:49.000Z', is_viewed: 0 },
        { id: 8290, media_url: '' },
      ],
    });
    assert.equal(group?.author.uid, 'u2');
    assert.equal(group?.unseen, true);
    assert.deepEqual(group?.stories, [{
      id: '8289', mediaUrl: 'https://s/1.jpg', mediaType: 'image', caption: '', viewCount: 46,
      at: Date.parse('2026-11-04T06:28:49.000Z'), expiresAt: Date.parse('2026-11-05T06:28:49.000Z'), viewed: false,
    }]);
    assert.equal(normalizeStoryGroup({ user_id: 'u3', stories: [] }), null);
  });
});

describe('loaders', () => {
  it('call the read endpoints with the observed bodies', async () => {
    const { ola, calls } = fakeOla({
      'faApi2/getFeedNoiBatV4.php': { is_success: true, message: 'done', list_data: [FEED_ITEM, { id: 0 }] },
      'faApi2/getPostByUserV7.php': { is_success: true, data: [FEED_ITEM], num_rows: 1 },
      'napi/post/205358/comments': { success: true, data: [{ id: 1, content: 'hi', uid: 'u' }], totalComments: 12 },
      'faApi2/getLikesV2.php': { is_success: true, data: [{ uid: 'l1', displayName: 'L' }, { displayName: 'no uid' }] },
      'napi/post/stories/feed': { is_success: true, data: [
        { user_id: 'old', has_unseen: false, latest_created_at: 5, stories: [{ id: 1, media_url: 'https://x' }] },
        { user_id: 'new', has_unseen: true, latest_created_at: 1, stories: [{ id: 2, media_url: 'https://y' }] },
      ] },
    });

    assert.deepEqual((await loadFeed(ola, 2)).map(p => p.id), ['205358']);
    assert.equal((await loadUserPosts(ola, { uid: 'author-uid', displayName: 'Rose' }, 1))[0]?.author.displayName, 'Rose');
    assert.deepEqual(await loadComments(ola, '205358', 1).then(r => [r.total, r.comments[0]?.text]), [12, 'hi']);
    assert.deepEqual((await loadLikes(ola, '205358')).map(u => u.uid), ['l1']);
    assert.deepEqual((await loadStories(ola)).map(g => g.author.uid), ['new', 'old'], 'unseen first');

    assert.deepEqual(calls.map(c => [c.method, c.path, c.body]), [
      ['POST', 'faApi2/getFeedNoiBatV4.php', { uid: 'me-uid', page: 2, new: 1 }],
      ['POST', 'faApi2/getPostByUserV7.php', { uid: 'author-uid', page: 1 }],
      ['POST', 'napi/post/205358/comments', { page: 1 }],
      ['POST', 'faApi2/getLikesV2.php', { postID: '205358', page: 0 }],
      ['GET', 'napi/post/stories/feed', {}],
    ]);
  });
});
