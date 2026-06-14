import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  loginPage,
  profilePage,
  settingsPage,
  postDetailPage,
  homePage,
  buildFeedPage,
  nextCursorFor,
  setShellContext,
} from './pages';
import {
  REACTION_EMOJIS,
  type CommentView,
  type PostCard,
  type PostSocial,
  type PostView,
  type ProfileView,
} from '../types';

describe('escapeHtml', () => {
  it('escapeHtml_escapesAllDangerousCharacters', () => {
    expect(escapeHtml(`<script>alert("x")&'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;&lt;/script&gt;'
    );
  });

  it('escapeHtml_nullOrUndefined_returnsEmptyString', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escapeHtml_plainText_isUnchanged', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });
});

describe('pages render with escaped user content', () => {
  const profile: ProfileView = {
    username: 'ken',
    displayName: '<b>Ken</b>',
    bio: '<img src=x onerror=alert(1)>',
    avatarMediaId: null,
    coverMediaId: null,
    websiteUrl: null,
    location: null,
    dmPolicy: 'everyone',
    createdAt: '2026-06-13T00:00:00.000Z',
    postCount: 0,
    followerCount: 0,
    followingCount: 0,
    avatarUrl: null,
    coverUrl: null,
  };

  it('profilePage_escapesDisplayNameAndBio', () => {
    const html = profilePage(profile, false);
    expect(html).not.toContain('<b>Ken</b>');
    expect(html).toContain('&lt;b&gt;Ken&lt;/b&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('profilePage_ownerShowsControls_visitorDoesNot', () => {
    expect(profilePage(profile, true)).toContain('data-testid="logout"');
    expect(profilePage(profile, false)).not.toContain('data-testid="logout"');
  });

  it('navRail_showsLoginWhenLoggedOut_logoutWhenLoggedIn', () => {
    const render = () =>
      homePage({ tab: 'foryou', loggedIn: false, feed: [], nextCursor: null, timeline: [] });

    setShellContext({ loggedIn: false, unreadNotifications: 0, unreadMessages: 0, siteName: 'AstroSocial' });
    const out = render();
    expect(out).toContain('data-testid="rail-login"');
    expect(out).toContain('href="/login"');
    expect(out).not.toContain('data-testid="rail-logout"');

    setShellContext({ loggedIn: true, unreadNotifications: 0, unreadMessages: 0, siteName: 'AstroSocial' });
    const inn = render();
    expect(inn).toContain('data-testid="rail-logout"');
    expect(inn).not.toContain('data-testid="rail-login"');

    setShellContext(null); // reset shared module state for other tests
  });

  it('shell_rendersConfiguredSiteNameInBrandAndTitle', () => {
    setShellContext({
      loggedIn: false,
      unreadNotifications: 0,
      unreadMessages: 0,
      siteName: 'Nebula <Net>',
    });
    const html = homePage({ tab: 'foryou', loggedIn: false, feed: [], nextCursor: null, timeline: [] });
    // Brand label, window title, and og:site_name all use the (escaped) DB value.
    expect(html).toContain('Nebula &lt;Net&gt;');
    expect(html).toContain('<title>Home · Nebula &lt;Net&gt;</title>');
    expect(html).toContain('<meta property="og:site_name" content="Nebula &lt;Net&gt;" />');
    expect(html).not.toContain('· AstroSocial</title>');
    setShellContext(null); // reset shared module state for other tests
  });

  it('loginPage_testMode_showsHint', () => {
    expect(loginPage(true)).toContain('000000');
    expect(loginPage(false)).not.toContain('test-mode-hint');
  });

  it('settingsPage_prefillsEscapedValues', () => {
    const html = settingsPage(profile);
    expect(html).toContain('&lt;b&gt;Ken&lt;/b&gt;');
    expect(html).toContain('data-testid="error"');
  });

  it('settingsPage_hasAvatarAndCoverUploadFields', () => {
    const html = settingsPage(profile);
    expect(html).toContain('data-testid="settings-avatar-file"');
    expect(html).toContain('data-testid="settings-cover-file"');
  });

  it('profilePage_withAvatarUrl_rendersAvatarImage', () => {
    const html = profilePage({ ...profile, avatarUrl: '/media/m_av/thumbnail' }, false);
    expect(html).toContain('data-testid="profile-avatar"');
    expect(html).toContain('src="/media/m_av/thumbnail"');
  });

  it('profilePage_withCoverUrl_rendersCoverBanner', () => {
    const html = profilePage({ ...profile, coverUrl: '/media/m_cv/original' }, false);
    expect(html).toContain('data-testid="profile-cover"');
    expect(html).toContain("background-image:url('/media/m_cv/original')");
  });

  it('profilePage_noAvatar_rendersPlaceholderInitial', () => {
    const html = profilePage(profile, false);
    expect(html).toContain('avatar-placeholder');
  });
});

describe('postDetailPage', () => {
  const baseView: PostView = {
    id: 'id1',
    publicId: 'p_1234abcd',
    userId: 'u1',
    title: '<b>Title</b>',
    slug: 'title',
    canonicalPath: '/@ken/posts/title',
    markdownBody: '# x',
    excerpt: 'x',
    coverMediaId: null,
    quotePostId: null,
    status: 'published',
    publishedAt: '2026-06-13T00:00:00.000Z',
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z',
    html: '<p><strong>safe</strong></p>',
    authorUsername: 'ken',
    authorDisplayName: 'Ken',
    coverUrl: null,
    quoted: null,
    tags: [],
  };

  const social: PostSocial = {
    likeCount: 0,
    liked: false,
    commentCount: 0,
    reactions: REACTION_EMOJIS.map((emoji) => ({ emoji, count: 0, reacted: false })),
    repostCount: 0,
    reposted: false,
    bookmarked: false,
  };

  it('passes pre-sanitized html through without double-escaping', () => {
    const html = postDetailPage(baseView, false, social, [], false);
    expect(html).toContain('<p><strong>safe</strong></p>');
  });

  it('escapes the title (which is rendered as text, not html)', () => {
    const html = postDetailPage(baseView, false, social, [], false);
    expect(html).toContain('&lt;b&gt;Title&lt;/b&gt;');
    expect(html).not.toContain('<b>Title</b>');
  });

  it('shows owner controls only to the owner', () => {
    expect(postDetailPage(baseView, true, social, [], true)).toContain('data-testid="post-owner-controls"');
    expect(postDetailPage(baseView, false, social, [], true)).not.toContain('data-testid="post-owner-controls"');
  });

  it('shows a status badge for non-published posts', () => {
    const draft = postDetailPage({ ...baseView, status: 'draft' }, true, social, [], true);
    expect(draft).toContain('data-testid="post-status"');
    expect(postDetailPage(baseView, true, social, [], true)).not.toContain('data-testid="post-status"');
  });

  it('renders a like button and reactions', () => {
    const html = postDetailPage(baseView, false, social, [], true);
    expect(html).toContain('data-testid="like-button"');
    expect(html).toContain('data-testid="social-bar"');
  });

  it('renders the lightbox share bar (copyable per-image URL)', () => {
    const html = postDetailPage(baseView, false, social, [], false);
    expect(html).toContain('data-testid="lightbox-share"');
    expect(html).toContain('data-testid="lightbox-url"');
    expect(html).toContain('data-testid="lightbox-copy"');
  });

  it('the lightbox script wires per-image URLs, history, deep-link, and copy', () => {
    const html = postDetailPage(baseView, false, social, [], false);
    expect(html).toContain("'#image-'"); // per-image fragment
    expect(html).toContain('/\\/media\\/([^/]+)\\//'); // media publicId extraction regex
    expect(html).toContain('history.pushState'); // open adds one entry
    expect(html).toContain('history.replaceState'); // nav/close rewrites the URL
    expect(html).toContain("addEventListener('popstate'"); // back/forward sync
    expect(html).toContain('clipboard'); // copy-to-clipboard
  });

  const author: ProfileView = {
    username: 'ken',
    displayName: 'Ken',
    bio: 'Indie dev',
    avatarMediaId: null,
    coverMediaId: null,
    websiteUrl: null,
    location: null,
    dmPolicy: 'everyone',
    createdAt: '2026-06-13T00:00:00.000Z',
    postCount: 2,
    followerCount: 0,
    followingCount: 0,
    avatarUrl: '/media/m_av/thumbnail',
    coverUrl: null,
  };

  it('renders the author card at the bottom when an author is provided', () => {
    const html = postDetailPage(baseView, false, social, [], false, null, author);
    expect(html).toContain('data-testid="post-author"');
    expect(html).toContain('data-testid="author-name"');
    expect(html).toContain('data-testid="author-bio"');
  });

  it('omits the author card when no author is provided', () => {
    const html = postDetailPage(baseView, false, social, [], false);
    expect(html).not.toContain('data-testid="post-author"');
  });

  it('renders a latest-posts strip when latest posts are provided', () => {
    const latest: PostCard[] = [
      {
        publicId: 'p_2',
        title: 'Another',
        slug: 'another',
        canonicalPath: '/@ken/posts/another',
        excerpt: 'x',
        status: 'published',
        publishedAt: '2026-06-12T00:00:00.000Z',
        createdAt: '2026-06-12T00:00:00.000Z',
        authorUsername: 'ken',
        authorDisplayName: 'Ken',
        coverUrl: null,
        readingMinutes: 1,
        likeCount: 0,
        commentCount: 0,
      },
    ];
    const html = postDetailPage(baseView, false, social, [], false, null, author, latest);
    expect(html).toContain('data-testid="latest-posts"');
    expect(html).toContain('/@ken/posts/another');
  });

  it('injects the lightbox markup so post images are zoomable', () => {
    const html = postDetailPage(baseView, false, social, [], false);
    expect(html).toContain('data-testid="lightbox"');
    expect(html).toContain('data-testid="lightbox-next"');
  });

  it('renders comment avatars and usernames', () => {
    const comment: CommentView = {
      id: 'c1',
      postId: 'id1',
      authorUsername: 'alice',
      authorDisplayName: 'Alice',
      authorAvatarUrl: '/media/m_al/thumbnail',
      guestName: null,
      body: 'nice',
      createdAt: '2026-06-13T00:00:00.000Z',
    };
    const html = postDetailPage(baseView, false, social, [comment], false);
    expect(html).toContain('data-testid="comment-avatar"');
    expect(html).toContain('data-testid="comment-username"');
    expect(html).toContain('@alice');
  });
});

describe('infinite-scroll feed', () => {
  function card(id: string, publishedAt: string): PostCard {
    return {
      publicId: id,
      title: `Post ${id}`,
      slug: id,
      canonicalPath: `/@ken/posts/${id}`,
      excerpt: 'x',
      status: 'published',
      publishedAt,
      createdAt: publishedAt,
      authorUsername: 'ken',
      authorDisplayName: 'Ken',
      coverUrl: null,
      readingMinutes: 1,
      likeCount: 0,
      commentCount: 0,
    };
  }

  describe('buildFeedPage', () => {
    it('renders the cards and returns the last publishedAt as the next cursor on a full page', () => {
      const cards = [card('p1', '2026-06-12T00:00:00.000Z'), card('p2', '2026-06-11T00:00:00.000Z')];
      const page = buildFeedPage(cards, 2);
      expect(page.html).toContain('data-testid="post-card"');
      expect(page.html).toContain('/@ken/posts/p1');
      expect(page.html).toContain('/@ken/posts/p2');
      expect(page.nextCursor).toBe('2026-06-11T00:00:00.000Z');
    });

    it('returns a null cursor when fewer than a full page is returned (end of feed)', () => {
      const page = buildFeedPage([card('p1', '2026-06-12T00:00:00.000Z')], 2);
      expect(page.nextCursor).toBeNull();
    });

    it('returns an empty page for no cards', () => {
      expect(buildFeedPage([], 12)).toEqual({ html: '', nextCursor: null });
    });
  });

  describe('homePage auto-load markup', () => {
    const feed = [card('p1', '2026-06-12T00:00:00.000Z')];

    it('renders the load-more row, cursor, loading indicator, and script when more posts exist', () => {
      const html = homePage({
        tab: 'foryou',
        loggedIn: false,
        feed,
        nextCursor: '2026-06-11T00:00:00.000Z',
        timeline: [],
      });
      expect(html).toContain('data-testid="load-more-row"');
      expect(html).toContain('data-cursor="2026-06-11T00:00:00.000Z"');
      expect(html).toContain('data-testid="feed-loading"');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('data-testid="load-more"');
      expect(html).toContain('IntersectionObserver');
      // The fetch endpoint now lives in a (HTML-escaped) data attribute on the row.
      expect(html).toContain('data-grid="feed"');
      expect(html).toContain('/api/feed?tab=foryou&amp;cursor=');
    });

    it('omits the load-more row and script when there are no more posts', () => {
      const html = homePage({ tab: 'foryou', loggedIn: false, feed, nextCursor: null, timeline: [] });
      expect(html).not.toContain('data-testid="load-more-row"');
      expect(html).not.toContain('IntersectionObserver');
    });
  });

  describe('nextCursorFor', () => {
    it('returns the last card publishedAt when a full page was returned', () => {
      const cards = [card('p1', '2026-06-12T00:00:00.000Z'), card('p2', '2026-06-11T00:00:00.000Z')];
      expect(nextCursorFor(cards, 2)).toBe('2026-06-11T00:00:00.000Z');
    });

    it('returns null on a short page (end reached) and for no cards', () => {
      expect(nextCursorFor([card('p1', '2026-06-12T00:00:00.000Z')], 2)).toBeNull();
      expect(nextCursorFor([], 12)).toBeNull();
    });
  });

  describe('profilePage auto-load markup', () => {
    const profile: ProfileView = {
      username: 'ken',
      displayName: 'Ken',
      bio: '',
      avatarMediaId: null,
      coverMediaId: null,
      websiteUrl: null,
      location: null,
      dmPolicy: 'everyone',
      createdAt: '2026-06-13T00:00:00.000Z',
      postCount: 20,
      followerCount: 0,
      followingCount: 0,
      avatarUrl: null,
      coverUrl: null,
    };
    const posts = [card('p1', '2026-06-12T00:00:00.000Z')];

    it('renders the profile load-more row targeting the profile grid + endpoint when more posts exist', () => {
      const html = profilePage(profile, false, posts, {
        loggedIn: false,
        isFollowing: false,
        nextCursor: '2026-06-11T00:00:00.000Z',
      });
      expect(html).toContain('data-testid="load-more-row"');
      expect(html).toContain('data-grid="profile-posts"');
      expect(html).toContain('data-cursor="2026-06-11T00:00:00.000Z"');
      expect(html).toContain('/api/users/ken/posts?cursor=');
      expect(html).toContain('IntersectionObserver');
      // Manual fallback link navigates to the same profile with a cursor query.
      expect(html).toContain('href="/@ken?cursor=2026-06-11T00%3A00%3A00.000Z"');
    });

    it('omits the load-more row when there are no more posts', () => {
      const html = profilePage(profile, false, posts, { loggedIn: false, isFollowing: false });
      expect(html).toContain('data-testid="profile-posts"');
      expect(html).not.toContain('data-testid="load-more-row"');
      expect(html).not.toContain('IntersectionObserver');
    });
  });
});

describe('loginPage site identity', () => {
  it('shows the configured site name and description', () => {
    const html = loginPage(false, { name: 'Stargazers', description: 'Astro community' });
    expect(html).toContain('Welcome to Stargazers');
    expect(html).toContain('Astro community');
  });

  it('falls back to defaults when no site is provided', () => {
    const html = loginPage(false);
    expect(html).toContain('Welcome to AstroSocial');
    expect(html).toContain('Sign in with a one-time PIN');
  });

  it('escapes a malicious site name/description', () => {
    const html = loginPage(false, {
      name: '<script>alert(1)</script>',
      description: '<img src=x onerror=alert(2)>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img src=x onerror');
  });
});
