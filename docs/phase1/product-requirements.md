# Product Requirements Document

## Product overview

### Name
**AstroSocial** - A self-hostable open-source social publishing platform

### Product concept
- **Long-form publishing meets social networking**: Combine the simplicity of a Twitter/X-like social feed with a beautiful, readable long-form writing experience in a single platform.
- **Media-rich, visual-first discovery**: Posts are presented as a cover-image grid so the home page feels like a publishing platform, not a plain text timeline. Images and videos can be inserted visually inside post content.
- **Simple to self-host, simple to hack**: One `docker compose up`, SQLite for storage, raw SQL with no ORM, and a codebase intentionally kept easy to understand and modify for open-source contributors.

### Product vision
AstroSocial gives developers, creators, and small communities a single place to publish short posts, long-form articles, and media-rich content without surrendering their data to a hosted platform. It sits between Twitter/X, Medium, Ghost, and WordPress: Markdown-first writing, WYSIWYG editing, beautiful long-form presentation, and lightweight social interaction (comments, likes, reactions, follows, reposts, quote posts, bookmarks, and DMs). Existing WordPress authors can migrate their content in and continue publishing in a more social, media-rich environment. The whole product is designed to run on a single small server with Docker Compose and SQLite, and to remain approachable enough that contributors can read the code top to bottom.

### Purpose
- Provide a simple social posting experience alongside beautiful long-form articles.
- Support both Markdown and WYSIWYG editing, with images and videos inserted visually into post content.
- Provide lightweight social features: comments, likes, emoji reactions, follows, reposts, quote posts, bookmarks, notifications, and DMs.
- Let users migrate existing WordPress content (posts, pages, media, comments, categories, tags) via WordPress Export XML.
- Give every post and media item a stable, unique public URL.
- Be trivially self-hostable with Docker Compose and persist all data on local volumes.
- Remain easy to understand and modify as an open-source project, avoiding unnecessary complexity in the first version.

## Target users

### Primary persona: Ken (32, indie developer / blogger)
- Runs a personal blog and a few side projects; currently on WordPress but frustrated by plugin bloat, maintenance, and hosting cost.
- Comfortable with Markdown, Git, Docker, and the command line.
- Wants a clean, self-hosted home for both long-form articles and short social updates, without ads, tracking, or a SaaS subscription.
- Expected solution: a single self-hostable app where he can import his existing WordPress content, publish Markdown/WYSIWYG posts with cover images, and get lightweight social engagement.
- Daily workflow: writes a post in Markdown or the visual editor, drops in a cover image and a few inline images, publishes to a unique URL, and shares it; checks notifications, likes, and comments later.

### Secondary persona: Maya (27, creator / writer in a small community)
- Publishes essays, photo sets, and short videos; wants a beautiful reading and viewing experience for her audience.
- Less technical, but can follow a Docker Compose setup guide or use a friend's instance.
- Values media-rich posts, cover-image discovery, bookmarks for long reads, and simple social interaction (reactions, follows, DMs).
- Expected solution: a visual, mobile-friendly, PWA-installable publishing space that looks good on phones and supports inline media.
- Daily workflow: uploads images/videos to the media library, composes a media-rich post in the WYSIWYG editor, publishes, and engages with followers via reactions and DMs.

### Tertiary persona: Sam (35, small team lead)
- Wants a private or semi-public internal publishing space for project updates and notes.
- Self-hosts the instance on a small VPS for the team.
- Values simple auth (email PIN, no password management), unique URLs for sharing, and the ability to keep everything on infrastructure the team controls.

## Success metrics (KPIs)

### Primary KPIs
- One-command self-host success: a new user can go from clone to a running instance with a single `docker compose up`, with database migrations applied automatically, in under 10 minutes on a typical machine.
- Core publishing flow works end-to-end: ≥ 95% pass rate on the Playwright E2E suite covering auth, post creation, media upload, and unique URL access.
- WordPress migration fidelity: ≥ 95% of posts, media, comments, and users from a representative WordPress Export XML are imported successfully, with zero duplicates on re-import of the same file.
- Test coverage of core logic: unit tests cover all repository classes, auth/PIN/session logic, Markdown rendering/sanitization, URL generation, and WordPress conversion.

### Secondary KPIs
- Long-form readability: post detail pages render with constrained content width, comfortable line height, responsive media, and optional table of contents for long articles.
- Performance: home/post list views use pagination or cursor loading, lazy-load images, and serve thumbnails (not full bodies) in card views.
- PWA readiness: the app is installable on mobile, ships a manifest and service worker, and shows an offline fallback page.
- Contributor approachability: the repository ships with README, sample data, license, contribution guide, and security policy by open-source release.

## Functional requirements

### Core features (MVP)

#### Authentication: passwordless email PIN login

**User story**:
As a user, I want to log in with a 6-digit PIN sent to my email so that I never have to manage a password.

**Acceptance criteria**:
- [ ] User enters an email address and receives a 6-digit PIN by email.
- [ ] Entering the correct PIN within 10 minutes logs the user in; on first login a user account is created automatically.
- [ ] PINs are hashed before storage (never stored in plain text); session tokens are stored as hashes.
- [ ] Sessions use HTTP-only cookies with Secure and SameSite attributes.
- [ ] PIN requests and verifications are rate-limited; failed attempts are limited and PINs can be resent.
- [ ] Expired or already-consumed PINs are rejected.
- [ ] User can log out, which invalidates the session.

**Priority**: P0 (Required)

#### User profile

**User story**:
As a user, I want a public profile page and the ability to edit my details so that others can find and recognize me.

**Acceptance criteria**:
- [ ] Each user has a public profile showing username, display name, avatar, cover image, bio, website URL, location, created date, and post/follower/following counts.
- [ ] User can edit display name, bio, avatar, cover image, website URL, and location.
- [ ] Profile page shows the user's posts as a cover-image grid.

**Priority**: P0 (Required)

#### Posts (create, edit, publish, archive, delete)

**User story**:
As a writer, I want to create short or long-form posts with Markdown and rich content so that I can publish anything from a quick note to a full article.

**Acceptance criteria**:
- [ ] User can create a post with title, body (stored as Markdown), excerpt, cover image, and attached media.
- [ ] Posts support draft, published, and archived statuses, with publish/archive actions.
- [ ] Supported content includes headings, paragraphs, bold/italic, links, blockquotes, code blocks, inline code, bullet/numbered lists, tables, images, videos, horizontal rules, and checklists.
- [ ] Long-form posts render with limited content width, comfortable line height, clear heading hierarchy, responsive images/videos with captions, code blocks, and an optional table of contents.
- [ ] User can edit and delete their own posts.

**Priority**: P0 (Required)

#### Markdown and WYSIWYG editor

**User story**:
As a writer, I want to write either in raw Markdown or in a visual editor so that I can choose the mode that fits my flow.

**Acceptance criteria**:
- [ ] Editor supports both Markdown editing and visual WYSIWYG editing with a preview mode.
- [ ] Formatting toolbar covers headings, bold/italic, links, images, videos, blockquotes, code blocks, lists, and tables, plus undo/redo.
- [ ] User can open the media library, select uploaded images/videos, and insert them at the cursor position; inserted media can be removed.
- [ ] User can set alt text, captions, and display size for inserted media.
- [ ] Drafts auto-save.

**Priority**: P0 (Required) for foundation; full WYSIWYG and auto-save are P1.

#### Media upload and library

**User story**:
As a creator, I want to upload images and videos and manage them in a library so that I can reuse them across posts.

**Acceptance criteria**:
- [ ] User can upload JPEG, PNG, WebP, GIF, MP4, and WebM files via multiple-file and drag-and-drop upload, with upload progress.
- [ ] Uploads are validated by MIME type, file extension, and file size; stored files use randomized names; path traversal is prevented; files are not executable from the upload directory.
- [ ] Thumbnails are generated where possible; media usage is tracked.
- [ ] A media library lets the user browse uploaded media and insert it into post bodies.
- [ ] Files are stored on the local file system and persisted via Docker volumes.

**Priority**: P0 (Required) for images; video upload and full library are P1.

#### Cover images

**User story**:
As a writer, I want each post to have a cover image so that it looks attractive in the discovery grid.

**Acceptance criteria**:
- [ ] User can upload a cover image, select one from existing media, replace it, or remove it.
- [ ] A thumbnail is generated and alt text can be set.
- [ ] Cover images appear on home page cards, the post detail page, the profile post grid, and as the OGP image.

**Priority**: P0 (Required)

#### Unique public URLs for posts and media

**User story**:
As a publisher, I want every post and media item to have a stable, shareable URL so that links never break.

**Acceptance criteria**:
- [ ] Posts are addressable at `/@username/posts/slug`, falling back to `/@username/posts/postPublicId` when there is no title.
- [ ] Slugs are lowercase, alphanumeric-plus-hyphen, max 80 chars, generated from the title, user-editable, unique per user, with a suffix appended on collision.
- [ ] Media items are addressable at `/@username/media/mediaPublicId`, with direct file URLs `/media/:publicId/original` and `/media/:publicId/thumbnail`.
- [ ] `public_id` and `canonical_path` are unique across posts and media respectively (enforced by unique indexes).
- [ ] Media visibility supports public, unlisted, and private (default public).

**Priority**: P0 (Required)

#### Home page (cover-image grid)

**User story**:
As a visitor, I want to browse the latest posts as a visual grid so that discovery feels like a publishing platform.

**Acceptance criteria**:
- [ ] Desktop shows a 3- or 4-column grid with left navigation and an optional right sidebar for trends/search.
- [ ] Mobile shows single-column cards with bottom navigation and large cover images.
- [ ] Post cards show cover image, title, author name/avatar, published date, comment/like/reaction/repost counts, short excerpt, and estimated reading time.
- [ ] List views are paginated or cursor-loaded, lazy-load images, and use thumbnails rather than full bodies.

**Priority**: P0 (Required)

#### WordPress migration (Export XML import)

**User story**:
As a WordPress author, I want to import my exported WordPress content so that I can move to AstroSocial without losing my history.

**Acceptance criteria**:
- [ ] User can upload a WordPress Export XML file and see an import preview (counts of users, posts, pages, media, comments, categories, tags; estimated media download size; warnings).
- [ ] Import covers users, posts, pages, media (downloaded from original URLs), comments (including guest comments), categories, and tags.
- [ ] WordPress featured images become AstroSocial cover images; inline media URLs in post bodies are replaced with AstroSocial media URLs.
- [ ] WordPress HTML is converted to Markdown; Gutenberg block comments are stripped while preserving inner content; common shortcodes (gallery, caption, video) are handled and unknown shortcodes are kept as text with a logged warning.
- [ ] Status mapping is applied (publish→published, draft/private/pending→draft, trash→archived).
- [ ] Import runs as a tracked job with progress, logs (info/warning/error), cancel, and retry; re-importing the same XML does not create duplicates.
- [ ] Import is hardened: XML size limited, external entities disabled (no XXE), downloaded media URLs validated, localhost/private IPs blocked, redirects/size/time limited, converted content sanitized.

**Priority**: P0 (Required) for the core MVP migration scope (XML method).

### Social features (MVP scope, phased)

#### Comments

**User story**:
As a reader, I want to comment on posts so that I can respond to authors.

**Acceptance criteria**:
- [ ] User can create, edit, and delete their own comments; post owners can delete comments on their posts.
- [ ] Comment count and comment list are shown.
- [ ] MVP supports single-level comments only (no threaded replies, no media attachments).

**Priority**: P1 (Important)

#### Likes and emoji reactions

**User story**:
As a reader, I want to like and react with emojis so that I can give lightweight feedback.

**Acceptance criteria**:
- [ ] User can like/unlike a post; like count and the current user's like state are shown; a user can like a post only once.
- [ ] User can react with a default emoji set (👍 ❤️ 😺 😂 👏 🔥 👀 😮) and remove their reaction; reaction counts per emoji are shown and the current user's reactions are highlighted.
- [ ] A user can use each emoji once per post but may use multiple emoji types.

**Priority**: P1 (Important)

#### Follow and following timeline

**User story**:
As a user, I want to follow others and see their content in a timeline so that I can keep up with people I care about.

**Acceptance criteria**:
- [ ] User can follow/unfollow; follower and following counts and lists are shown.
- [ ] A following timeline returns timeline items (normal post, repost, quote post), not just raw posts.
- [ ] MVP supports public accounts only (no private approval flow; blocking/muting are future features).

**Priority**: P1 (Important)

#### Reposts and quote posts

**User story**:
As a user, I want to repost or quote another post so that I can reshare content with or without my own commentary.

**Acceptance criteria**:
- [ ] User can repost/un-repost (once per post); repost count and current-user state are shown; reposts appear in the following timeline labeled "X reposted".
- [ ] User can create a quote post that embeds the original post card plus their own commentary; quote count and quote list are shown.
- [ ] A quote post is stored as a normal post referencing `quote_post_id`; if the original is deleted, the quote remains and the embedded card shows "This post has been deleted."
- [ ] Deleted posts cannot be reposted.

**Priority**: P1 (Important)

#### Bookmarks and notifications

**User story**:
As a user, I want to bookmark posts and be notified of interactions so that I can save long reads and stay informed.

**Acceptance criteria**:
- [ ] User can bookmark/un-bookmark posts and view a bookmark list.
- [ ] Notifications are generated for comment, like, reaction, follow, repost, quote post, and DM message.
- [ ] Notification list shows unread count, with mark-as-read and mark-all-as-read.

**Priority**: P1 (Important)

#### Direct messages

**User story**:
As a user, I want to send private 1-to-1 text messages so that I can talk to others privately.

**Acceptance criteria**:
- [ ] User can start a 1-to-1 conversation and send text messages; conversation list, message list, unread count, and read status are shown.
- [ ] User can delete their own messages; DM notifications are generated.
- [ ] DM privacy setting lets a user choose who can message them: everyone, users they follow, mutual follows only, or nobody.
- [ ] MVP excludes group DM, media attachments, E2E encryption, and voice/video messages.

**Priority**: P1 (Important)

### Discovery features (MVP scope)

#### Search

**User story**:
As a user, I want to search posts and users so that I can find content.

**Acceptance criteria**:
- [ ] Search covers post title, post body, username, display name, and tags.
- [ ] Implemented with SQLite FTS5 full-text search.

**Priority**: P1 (Important)

#### Tags and categories

**User story**:
As a publisher, I want tags and categories so that content is organized (and WordPress taxonomies migrate cleanly).

**Acceptance criteria**:
- [ ] User can add tags and categories to posts; tag and category pages list their posts; tag-based search and trend tags are supported.

**Priority**: P1 (Important)

#### Trends

**User story**:
As a visitor, I want to see popular posts, tags, and users so that I can discover what's active.

**Acceptance criteria**:
- [ ] Trends cover popular posts, tags, and users over last 24h / 7d / 30d windows.
- [ ] Trend score = likes×1 + reactions×1 + comments×2 + reposts×3 + quotes×3 + bookmarks×2, optionally adjusted by age decay.
- [ ] Trends may be computed from periodic snapshots rather than fully in real time.

**Priority**: P2 (Nice to have for MVP)

### PWA and self-hosting

**User story**:
As a self-hoster and mobile user, I want a Docker-deployable, installable app so that I can run it anywhere and use it like a native app.

**Acceptance criteria**:
- [ ] Ships `manifest.json`, a service worker, app icons, an installable mobile experience, an offline fallback page, and static asset caching.
- [ ] `docker compose up` builds the app, persists SQLite/uploads/thumbnails/logs on volumes, validates env vars, creates data/upload directories, runs migrations, and starts the server.
- [ ] Database migrations run in filename order, are recorded in a migrations table, are checked on startup, and a failed migration fails startup.

**Priority**: P0 (Required) for Docker/migrations; PWA polish is P1.

### API surface (reference)

The MVP exposes REST endpoints under `/api` for auth, posts (incl. publish/archive/repost/quote), media (incl. public file serving), comments, likes/reactions, follows, DMs, trends, and WordPress import (preview/start/job status/logs/cancel/retry). See `docs/functional-design.md` and `docs/architecture.md` for the detailed contract.

### Future features (Post-MVP)

#### WordPress REST API import
Migration via the WordPress REST API (site URL + application password) as an alternative to XML upload.
**Priority**: P2 (Nice to have)

#### Out-of-scope expansions
ActivityPub/Fediverse, S3-compatible storage, HLS/advanced video transcoding, threaded comments, group DM, blocking/muting, private accounts, advanced moderation, and old-URL redirect mapping are explicitly deferred.
**Priority**: P2 (Nice to have)

## Non-functional requirements

### Performance
- List/feed views are paginated or cursor-loaded; full post bodies are never loaded in list views.
- Images lazy-load; cards use generated thumbnails with optimized cover image sizes.
- SQLite runs in WAL mode with a configured `busy_timeout`, the recommended indexes applied, and queries written against those indexes.

### Usability
- A new visitor can read a post and a new author can publish their first post without consulting documentation.
- Long-form reading is comfortable on both desktop and mobile (constrained width, responsive media, optional TOC).
- The app is mobile-friendly and installable as a PWA with an offline fallback.

### Reliability
- All persistent data (SQLite DB, uploads, thumbnails, logs) survives container restarts via volumes.
- Application startup fails loudly if a migration fails, preventing running against a half-migrated schema.
- Re-running a WordPress import of the same file is idempotent (no duplicate content), enforced via `import_mappings`.

### Security
- Auth: PINs and session tokens are hashed; HTTP-only + Secure + SameSite cookies; rate limiting on PIN request/verify; capped failed attempts.
- SQL: prepared statements only; never concatenate user input into SQL; allowlists for dynamic sort fields; all IDs and slugs validated. No ORM — each table has a repository class executing parameterized raw SQL.
- XSS: Markdown and imported WordPress HTML are sanitized (strip script tags, event-handler attributes, `javascript:` URLs, unsafe iframes/styles); external links use `rel="noopener noreferrer"`.
- File upload: validate MIME and extension, randomize stored names, disallow execution from the upload dir, limit file size, re-encode images where possible, generate thumbnails safely, prevent path traversal.
- WordPress import: limit XML size, disable external entities (prevent XXE), validate downloaded media URLs, block localhost/private IPs, limit redirects/size, use download timeouts, sanitize converted content.

### Scalability
- MVP targets single-instance, single-node self-hosting on SQLite; the architecture should keep the storage layer (local filesystem) behind an interface so S3-compatible storage can be added later without rewrites.
- The repository pattern isolates SQL so the schema can evolve via the migration system after public release.

## Out of scope

Explicitly out of scope for the MVP:
- Ads, paid subscriptions, and complex recommendation algorithms.
- Live streaming, audio/spaces rooms, voice/video messages.
- Advanced AI moderation.
- ActivityPub / Fediverse support.
- Large-scale distributed infrastructure and Elasticsearch-based search (SQLite FTS5 is used instead).
- WooCommerce migration and custom WordPress post types.
- Advanced SEO redirect management / old-WordPress-URL → new-URL redirect mapping.
- End-to-end encryption for DMs and group DMs.
