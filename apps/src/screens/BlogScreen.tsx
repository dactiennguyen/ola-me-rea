// Blog of one account: story bar, feed Nổi bật and anyone's posts, with
// comments and likes. Read-only: the app does not like, comment or post here.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COMMENTS_PER_PAGE, LIKES_PER_PAGE, loadComments, loadFeed, loadLikes, loadStories, loadUserPosts,
  type BlogAuthor, type BlogComment, type BlogImage, type BlogPost, type StoryGroup,
} from '@ola/core/blog.ts';
import type { ChatUser } from '@ola/core/chat.ts';
import { Avatar } from '../components/Avatar.tsx';
import { Icon } from '../components/Icon.tsx';
import { agoLabel } from '../lib/format.ts';
import { provinceName } from '../lib/provinces.ts';
import { useOla } from '../lib/session.tsx';
import type { PeerTarget } from './MessagesScreen.tsx';

type Mode = { kind: 'feed' } | { kind: 'user'; author: BlogAuthor };

/** One picture or video in the full-screen viewer. */
interface Media {
  url: string;
  video?: boolean;
  author?: BlogAuthor;
  caption?: string;
  meta?: string;
}

export function BlogScreen({ hidden, onMessage }: { hidden: boolean; onMessage: (peer: PeerTarget) => void }) {
  const { ola, me } = useOla();
  const myAuthor: BlogAuthor = {
    uid: me.uid, displayName: me.displayName, photoURL: me.photoURL,
    isVip: Boolean(me.isVip), verified: Boolean(me.isVerifyAvatar), level: me.level ?? 0,
  };
  const [mode, setMode] = useState<Mode>({ kind: 'feed' });
  const [posts, setPosts] = useState<BlogPost[]>([]);
  // Mirrors posts so a page's new items are counted outside a setState updater.
  const postsRef = useRef<BlogPost[]>([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ items: Media[]; index: number } | null>(null);
  const nextPage = useRef(0);
  const loadingRef = useRef(false);
  const generation = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async (reset: boolean) => {
    if (loadingRef.current && !reset) return;
    const gen = reset ? ++generation.current : generation.current;
    if (reset) nextPage.current = 0;
    const page = nextPage.current;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const list = mode.kind === 'feed' ? await loadFeed(ola, page) : await loadUserPosts(ola, mode.author, page);
      if (gen !== generation.current) return;
      nextPage.current = page + 1;
      const base = reset ? [] : postsRef.current;
      const seen = new Set(base.map(p => p.id));
      const fresh = list.filter(p => !seen.has(p.id));
      postsRef.current = [...base, ...fresh];
      setPosts(postsRef.current);
      // An empty page ends the list; so does a page of only repeats (no endless loading).
      setDone(!list.length || (!reset && !fresh.length));
    } catch (e) {
      if (gen === generation.current) setError((e as Error).message);
    } finally {
      if (gen === generation.current) { loadingRef.current = false; setLoading(false); }
    }
  }, [ola, mode]);

  useEffect(() => {
    postsRef.current = [];
    setPosts([]);
    setDone(false);
    scroller.current?.scrollTo({ top: 0 });
    void load(true);
  }, [load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || hidden) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !done && !loadingRef.current && posts.length) void load(false);
    }, { rootMargin: '600px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [load, done, posts.length, hidden]);

  const showAuthor = useCallback((author: BlogAuthor) => setMode({ kind: 'user', author }), []);
  const message = useCallback((a: BlogAuthor) => onMessage({ uid: a.uid, name: a.displayName, photo: a.photoURL }), [onMessage]);
  const openImages = useCallback((post: BlogPost, index: number) => setViewer({
    index,
    items: post.images.map(img => ({ url: img.url, author: post.author, caption: post.text, meta: agoLabel(post.at) })),
  }), []);

  const viewing = mode.kind === 'user' ? mode.author : null;
  const mine = viewing?.uid === me.uid;

  return (
    <div className="screen screen-scroll blog" hidden={hidden} ref={scroller}>
      <div className="blog-column">
        <header className="page-head">
          <div>
            <h1>Blog</h1>
            <p className="muted small">{mode.kind === 'feed' ? 'Bài nổi bật' : mine ? 'Bài của bạn' : `Bài của ${viewing?.displayName || 'người này'}`}</p>
          </div>
          <div className="blog-head-actions">
            <div className="tabs tabs-sm" role="tablist" aria-label="Danh sách bài">
              <button type="button" role="tab" aria-selected={mode.kind === 'feed'} className={`tab${mode.kind === 'feed' ? ' is-active' : ''}`} onClick={() => setMode({ kind: 'feed' })}>Nổi bật</button>
              <button type="button" role="tab" aria-selected={mine} className={`tab${mine ? ' is-active' : ''}`} onClick={() => setMode({ kind: 'user', author: myAuthor })}>Bài của tôi</button>
            </div>
            <button type="button" className="icon-btn" title="Làm mới" aria-label="Làm mới" disabled={loading} onClick={() => void load(true)}>
              <Icon name="refresh" size={16} />
            </button>
          </div>
        </header>

        {mode.kind === 'feed' && <StoryBar hidden={hidden} onOpen={setViewer} />}

        {viewing && !mine && (
          <div className="blog-author-bar">
            <button type="button" className="icon-btn" title="Về Nổi bật" aria-label="Về Nổi bật" onClick={() => setMode({ kind: 'feed' })}>
              <Icon name="chevronLeft" size={18} />
            </button>
            <Avatar name={viewing.displayName || viewing.uid} photo={viewing.photoURL} seed={viewing.uid} size={36} />
            <span className="grow strong ellipsis">{viewing.displayName || viewing.uid}</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => message(viewing)}>
              <Icon name="message" size={15} /> Nhắn tin
            </button>
          </div>
        )}

        {error && <p className="notice notice-bad">Không tải được bài: {error}</p>}

        {posts.map(post => (
          <PostCard key={post.id} post={post} isMe={post.author.uid === me.uid}
            onAuthor={mode.kind === 'feed' ? showAuthor : undefined} onMessage={message} onImage={i => openImages(post, i)} />
        ))}

        <div ref={sentinel} className="load-more">
          {loading && <span className="muted small">Đang tải…</span>}
          {!loading && done && posts.length > 0 && <span className="muted small">Đã hết bài.</span>}
          {!loading && !done && posts.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load(false)}>Tải thêm</button>}
          {!loading && !error && done && !posts.length && <span className="muted small">{mine ? 'Bạn chưa đăng bài nào.' : 'Chưa có bài nào.'}</span>}
        </div>
      </div>

      {viewer && <MediaViewer items={viewer.items} start={viewer.index} onClose={() => setViewer(null)} onAuthor={a => { setViewer(null); showAuthor(a); }} />}
    </div>
  );
}

function PostCard({ post, isMe, onAuthor, onMessage, onImage }: {
  post: BlogPost;
  isMe: boolean;
  /** Undefined when the list already is this author's posts. */
  onAuthor?: (a: BlogAuthor) => void;
  onMessage: (a: BlogAuthor) => void;
  onImage: (index: number) => void;
}) {
  const [open, setOpen] = useState<'comments' | 'likes' | null>(null);
  const a = post.author;
  const name = a.displayName || `${a.uid.slice(0, 10)}…`;
  const meta = [agoLabel(post.at), post.province && provinceName(post.province), post.feeling && `đang cảm thấy ${post.feeling}`, post.checkIn && `tại ${post.checkIn}`].filter(Boolean).join(' · ');
  const toggle = (what: 'comments' | 'likes') => setOpen(v => (v === what ? null : what));

  return (
    <article className="post-card">
      <header className="post-head">
        <AuthorButton author={a} size={40} onAuthor={onAuthor} />
        <div className="post-who">
          <AuthorName author={a} onAuthor={onAuthor} name={name} />
          <span className="small muted">{meta}</span>
        </div>
        {!isMe && (
          <button type="button" className="icon-btn" title={`Nhắn tin cho ${name}`} aria-label={`Nhắn tin cho ${name}`} onClick={() => onMessage(a)}>
            <Icon name="message" size={17} />
          </button>
        )}
      </header>
      {post.text && <p className="post-text">{post.text}</p>}
      {post.images.length > 0 && <ImageGrid images={post.images} onOpen={onImage} />}
      <footer className="post-foot">
        <button type="button" className={`post-stat${open === 'likes' ? ' is-active' : ''}`} aria-expanded={open === 'likes'} disabled={!post.likeCount} onClick={() => toggle('likes')}>
          <Icon name="heart" size={16} /> {post.likeCount} thích
        </button>
        <button type="button" className={`post-stat${open === 'comments' ? ' is-active' : ''}`} aria-expanded={open === 'comments'} disabled={!post.commentCount} onClick={() => toggle('comments')}>
          <Icon name="comment" size={16} /> {post.commentCount} bình luận
        </button>
        <span className="grow" />
        <span className="small muted" title="Mã bài">#{post.id}</span>
      </footer>
      {open === 'comments' && <Comments postId={post.id} onAuthor={onAuthor ?? (() => {})} />}
      {open === 'likes' && <Likes postId={post.id} onMessage={u => onMessage({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL, isVip: u.isVip, verified: u.verified, level: u.level })} />}
    </article>
  );
}

function AuthorButton({ author, size, onAuthor }: { author: BlogAuthor; size: number; onAuthor?: (a: BlogAuthor) => void }) {
  const avatar = <Avatar name={author.displayName || author.uid} photo={author.photoURL} seed={author.uid} size={size} />;
  if (!onAuthor) return avatar;
  return <button type="button" className="avatar-btn" title="Xem bài của người này" onClick={() => onAuthor(author)}>{avatar}</button>;
}

function AuthorName({ author, name, onAuthor }: { author: BlogAuthor; name: string; onAuthor?: (a: BlogAuthor) => void }) {
  const tags = (
    <>
      {author.verified && <Icon name="badgeCheck" size={14} label="Ảnh đại diện đã xác thực" />}
      {author.isVip && <span className="vip-tag">VIP</span>}
    </>
  );
  return onAuthor ? (
    <button type="button" className="post-name link-btn" title="Xem bài của người này" onClick={() => onAuthor(author)}>
      <span className="ellipsis">{name}</span>{tags}
    </button>
  ) : <span className="post-name"><span className="ellipsis">{name}</span>{tags}</span>;
}

/** One picture keeps its shape; several make a grid of up to four, "+N" on the last. */
function ImageGrid({ images, onOpen }: { images: BlogImage[]; onOpen: (index: number) => void }) {
  if (images.length === 1) {
    const img = images[0]!;
    const ratio = img.width && img.height ? `${img.width} / ${img.height}` : undefined;
    return (
      <button type="button" className="post-image single" style={{ aspectRatio: ratio }} onClick={() => onOpen(0)} aria-label="Xem ảnh">
        <img src={img.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      </button>
    );
  }
  const shown = images.slice(0, 4);
  return (
    <div className={`post-images count-${shown.length}`}>
      {shown.map((img, i) => (
        <button key={img.url + i} type="button" className="post-image" onClick={() => onOpen(i)} aria-label={`Xem ảnh ${i + 1}/${images.length}`}>
          <img src={img.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          {i === 3 && images.length > 4 && <span className="post-image-more">+{images.length - 4}</span>}
        </button>
      ))}
    </div>
  );
}

function Comments({ postId, onAuthor }: { postId: string; onAuthor: (a: BlogAuthor) => void }) {
  const { ola } = useOla();
  const [items, setItems] = useState<BlogComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [end, setEnd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const more = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await loadComments(ola, postId, p);
      setItems(prev => {
        const seen = new Set(prev.map(c => c.id));
        return [...prev, ...r.comments.filter(c => !seen.has(c.id))];
      });
      setTotal(r.total);
      setPage(p + 1);
      setEnd(r.comments.length < COMMENTS_PER_PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ola, postId]);

  useEffect(() => { void more(0); }, [more]);

  return (
    <section className="post-thread" aria-label="Bình luận">
      {items.map(c => (
        <div key={c.id} className="comment">
          <AuthorButton author={c.author} size={30} onAuthor={onAuthor} />
          <div className="comment-body">
            <div className="comment-bubble">
              <AuthorName author={c.author} name={c.author.displayName.trim() || c.author.uid.slice(0, 10)} onAuthor={onAuthor} />
              {c.text && <span className="comment-text">{c.text}</span>}
              {c.stickerUrl && <img className="comment-sticker" src={c.stickerUrl} alt="Sticker" loading="lazy" referrerPolicy="no-referrer" />}
            </div>
            <span className="small muted">{agoLabel(c.at)}{c.likeCount > 0 && ` · ${c.likeCount} thích`}</span>
          </div>
        </div>
      ))}
      {error && <p className="small tone-bad">Không tải được bình luận: {error}</p>}
      {loading ? <span className="small muted">Đang tải bình luận…</span>
        : !end && items.length < total && (
          <button type="button" className="link-btn small" onClick={() => void more(page)}>Xem thêm bình luận ({total - items.length})</button>
        )}
      {!loading && !error && !items.length && <span className="small muted">Chưa có bình luận.</span>}
    </section>
  );
}

function Likes({ postId, onMessage }: { postId: string; onMessage: (u: ChatUser) => void }) {
  const { ola } = useOla();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [page, setPage] = useState(0);
  const [end, setEnd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const more = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await loadLikes(ola, postId, p);
      setUsers(prev => {
        const seen = new Set(prev.map(u => u.uid));
        return [...prev, ...list.filter(u => !seen.has(u.uid))];
      });
      setPage(p + 1);
      setEnd(list.length < LIKES_PER_PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ola, postId]);

  useEffect(() => { void more(0); }, [more]);

  return (
    <section className="post-thread" aria-label="Người đã thích">
      <ul className="like-list">
        {users.map(u => (
          <li key={u.uid}>
            <Avatar name={u.displayName || u.uid} photo={u.photoURL} seed={u.uid} size={28} />
            <span className="grow ellipsis small">{u.displayName || u.uid.slice(0, 10)}</span>
            {u.isVip && <span className="vip-tag">VIP</span>}
            <button type="button" className="icon-btn icon-btn-sm" title="Nhắn tin" aria-label={`Nhắn tin cho ${u.displayName || u.uid}`} onClick={() => onMessage(u)}>
              <Icon name="message" size={14} />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="small tone-bad">Không tải được lượt thích: {error}</p>}
      {loading ? <span className="small muted">Đang tải…</span>
        : !end && <button type="button" className="link-btn small" onClick={() => void more(page)}>Xem thêm</button>}
    </section>
  );
}

/** Stories of followed people; opening one shows it in the viewer (no "seen" is sent). */
function StoryBar({ hidden, onOpen }: { hidden: boolean; onOpen: (v: { items: Media[]; index: number }) => void }) {
  const { ola } = useOla();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hidden || groups) return;
    let live = true;
    loadStories(ola).then(g => { if (live) setGroups(g); }, e => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [ola, hidden, groups]);

  if (error) return <p className="small muted">Không tải được story: {error}</p>;
  if (!groups?.length) return null;

  const items: Media[] = groups.flatMap(g => g.stories.map(s => ({
    url: s.mediaUrl, video: s.mediaType === 'video', author: g.author, caption: s.caption,
    meta: `${agoLabel(s.at)} · ${s.viewCount} lượt xem`,
  })));
  const firstOf = (gi: number) => groups.slice(0, gi).reduce((n, g) => n + g.stories.length, 0);

  return (
    <div className="story-bar" role="list" aria-label="Story">
      {groups.map((g, gi) => (
        <button key={g.author.uid} type="button" role="listitem" className={`story-chip${g.unseen ? ' is-unseen' : ''}`}
          title={`${g.author.displayName} · ${g.stories.length} story`} onClick={() => onOpen({ items, index: firstOf(gi) })}>
          <Avatar name={g.author.displayName || g.author.uid} photo={g.author.photoURL} seed={g.author.uid} size={52} ring="var(--bg)" />
          <span className="small ellipsis">{g.author.displayName.trim() || '…'}</span>
        </button>
      ))}
    </div>
  );
}

function MediaViewer({ items, start, onClose, onAuthor }: {
  items: Media[];
  start: number;
  onClose: () => void;
  onAuthor: (a: BlogAuthor) => void;
}) {
  const [index, setIndex] = useState(start);
  const item = items[index]!;
  const go = useCallback((step: number) => setIndex(i => Math.min(items.length - 1, Math.max(0, i + step))), [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Xem ảnh" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="viewer-top">
        {item.author && (
          <button type="button" className="viewer-author" onClick={() => onAuthor(item.author!)} title="Xem bài của người này">
            <Avatar name={item.author.displayName || item.author.uid} photo={item.author.photoURL} seed={item.author.uid} size={32} ring="transparent" />
            <span className="strong ellipsis">{item.author.displayName || item.author.uid}</span>
          </button>
        )}
        <span className="small muted grow">{item.meta}{items.length > 1 && ` · ${index + 1}/${items.length}`}</span>
        <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><Icon name="x" size={20} /></button>
      </div>
      <div className="viewer-stage" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <button type="button" className="viewer-nav" aria-label="Trước" disabled={index === 0} onClick={() => go(-1)}><Icon name="chevronLeft" size={26} /></button>
        {item.video
          ? <video key={item.url} src={item.url} controls autoPlay playsInline />
          : <img key={item.url} src={item.url} alt="" referrerPolicy="no-referrer" />}
        <button type="button" className="viewer-nav" aria-label="Sau" disabled={index === items.length - 1} onClick={() => go(1)}><Icon name="chevronRight" size={26} /></button>
      </div>
      {item.caption && <p className="viewer-caption">{item.caption}</p>}
    </div>
  );
}
