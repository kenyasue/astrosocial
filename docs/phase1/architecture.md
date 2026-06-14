# Architecture Design Document

This document defines the system structure and technology choices that realize the requirements in `docs/product-requirements.md` and the design in `docs/functional-design.md`. It also contains the authoritative database schema.

## Technology Stack

### Languages and Runtimes

| Technology | Version |
|------|-----------|
| Node.js | v24.11.0 |
| TypeScript | 5.x |
| npm | 11.x |

### Frameworks and Libraries

| Technology | Version | Purpose | Rationale |
|------|-----------|------|----------|
| Next.js | latest stable (App Router) | Web framework: pages, RSC, route handlers, PWA | One framework for server + client; fast feed rendering; built-in `/api` handlers. |
| React | 18+ | UI rendering | Required by Next.js. |
| better-sqlite3 | latest stable | SQLite driver | Synchronous, fast, simple, test-friendly; ideal for single-node self-hosting. |
| Tiptap (or Milkdown) | latest stable | Markdown + WYSIWYG editor | Dual-mode editing, extensible toolbar, media insertion at cursor. |
| sharp | latest stable | Image processing | Re-encoding and thumbnail generation safely and fast. |
| A Markdown renderer + HTML sanitizer | latest stable | Render/sanitize Markdown and imported HTML | XSS protection for user and imported content. |
| fast-xml-parser (or equivalent, XXE-safe) | latest stable | WordPress Export XML parsing | Parse large XML with external entities disabled. |
| node-fetch / undici | bundled | Safe media downloads during import | Timeouts, redirect limits, SSRF guards. |
| nodemailer (or provider SDK) | latest stable | PIN email delivery | SMTP abstraction; mock server in E2E. |

### Development Tools

| Technology | Version | Purpose | Rationale |
|------|-----------|------|----------|
| Vitest or Jest | latest stable | Unit/integration tests | Fast TS-native testing of core logic. |
| Playwright | latest stable | E2E tests | Cross-browser flows in a Dockerized environment. |
| ESLint + Prettier | latest stable | Linting/formatting | Consistent, reviewable code. |
| TypeScript (tsc) | 5.x | Type checking | `npm run typecheck` gate. |
| Docker + Docker Compose | latest stable | Build, run, persist, E2E | One-command self-host and reproducible E2E. |
| ffmpeg | system (optional) | Video thumbnails/posters | Optional poster generation for uploaded video. |

## Architecture Pattern

### Layered Architecture

AstroSocial uses a strict layered architecture inside a single Next.js application. There is no ORM; the Data layer is a set of repository classes that own all raw SQL.

```
┌───────────────────────────────────────────────┐
│ UI Layer                                       │  App Router pages / RSC / client components
│  - render feeds, editor, profile, import UI    │
├───────────────────────────────────────────────┤
│ API Layer (/api route handlers)                │  HTTP contract, auth/session, validation
├───────────────────────────────────────────────┤
│ Service Layer                                  │  business logic: auth, posts, media,
│  - AuthService, PostService, MediaService,     │  social, import, trends, notifications
│    SocialService, WordPressImporter            │
├───────────────────────────────────────────────┤
│ Data Layer (Repositories, raw SQL)             │  one repository per table, parameterized SQL
├───────────────────────────────────────────────┤
│ Infrastructure                                 │  SQLite (WAL+FTS5), local FS storage, email
└───────────────────────────────────────────────┘
```

#### UI Layer
- **Responsibility**: Render pages and components; collect input; client-side validation; display results.
- **Permitted**: Call API route handlers; call the service layer directly from server components.
- **Prohibited**: Direct repository/SQL access from client components; embedding business rules.

#### API Layer
- **Responsibility**: Define the HTTP contract, authenticate via session cookie, validate inputs, map errors to the standard envelope.
- **Permitted**: Call the service layer.
- **Prohibited**: Direct SQL; business rules beyond request shaping.

#### Service Layer
- **Responsibility**: Business logic, transactions, cross-entity coordination, URL/slug generation, sanitization orchestration, notifications.
- **Permitted**: Call repositories, storage provider, email, Markdown/sanitize utils.
- **Prohibited**: Depending on UI/HTTP types; writing raw SQL inline.

> **Implementation note (M0/M1, 2026-06-13):** The current web layer is a thin,
> dependency-free `node:http` adapter (`src/server.ts`) plus minimal
> server-rendered pages, run directly with `tsx`. This is a deliberate
> foundation-stage simplification. All business logic lives in the
> framework-agnostic service layer (`src/lib/services`), so migrating the
> adapter to Next.js App Router route handlers (the target above) is mechanical
> and does not affect services, repositories, or the schema. Test mode
> (`OPENMEOW_TEST_MODE=1`) forces the login PIN to `000000` for deterministic
> end-to-end tests.

#### Data Layer
- **Responsibility**: Persistence via parameterized raw SQL; enforce table constraints; map rows to typed entities.
- **Permitted**: Access SQLite through the shared connection.
- **Prohibited**: Business logic; string-concatenated SQL with user input.

## Data Persistence Strategy

### Storage Method

| Data type | Storage | Format | Rationale |
|-----------|----------|-------------|------|
| Relational data (users, posts, social, import) | SQLite | Tables (raw SQL) | Zero-ops, single-file, perfect for self-hosting. |
| Full-text search | SQLite FTS5 | Virtual table | No external search service needed. |
| Uploaded originals | Local filesystem | Files (randomized names) | Simple, volume-persisted; pluggable for future S3. |
| Thumbnails | Local filesystem | WebP files | Fast card/grid rendering. |
| Logs | Local filesystem / stdout | Text | Operator visibility; persisted via volume. |
| Sessions/PINs | SQLite | Hashed tokens | Secure, server-validated. |

### Database Schema (authoritative)

Migrations live in `migrations/NNNN_*.sql`, applied in filename order and recorded in `migrations`. Schema (SQLite):

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL, bio TEXT, avatar_media_id TEXT, cover_media_id TEXT,
  website_url TEXT, location TEXT, dm_policy TEXT DEFAULT 'everyone',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE login_pins (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, pin_hash TEXT NOT NULL, expires_at TEXT NOT NULL,
  consumed_at TEXT, failed_attempts INTEGER DEFAULT 0, created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, session_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL, last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE media (
  id TEXT PRIMARY KEY, public_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL,
  canonical_path TEXT NOT NULL UNIQUE, file_name TEXT NOT NULL, original_file_name TEXT,
  mime_type TEXT NOT NULL, file_size INTEGER NOT NULL, width INTEGER, height INTEGER,
  duration_seconds INTEGER, storage_path TEXT NOT NULL, thumbnail_path TEXT, alt_text TEXT,
  caption TEXT, visibility TEXT DEFAULT 'public', created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY, public_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, title TEXT,
  slug TEXT, canonical_path TEXT NOT NULL UNIQUE, markdown_body TEXT NOT NULL, excerpt TEXT,
  cover_media_id TEXT, quote_post_id TEXT, status TEXT NOT NULL, published_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (cover_media_id) REFERENCES media(id),
  FOREIGN KEY (quote_post_id) REFERENCES posts(id)
);

CREATE TABLE post_media (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL, media_id TEXT NOT NULL,
  usage_type TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (media_id) REFERENCES media(id)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT, guest_name TEXT, guest_email TEXT,
  guest_url TEXT, body TEXT NOT NULL, status TEXT DEFAULT 'approved', created_at TEXT NOT NULL,
  updated_at TEXT, deleted_at TEXT,
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE likes (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE reactions (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(post_id, user_id, emoji),
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE follows (
  id TEXT PRIMARY KEY, follower_user_id TEXT NOT NULL, following_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(follower_user_id, following_user_id),
  FOREIGN KEY (follower_user_id) REFERENCES users(id),
  FOREIGN KEY (following_user_id) REFERENCES users(id)
);

CREATE TABLE reposts (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, actor_user_id TEXT, type TEXT NOT NULL,
  post_id TEXT, comment_id TEXT, read_at TEXT, created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (actor_user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (comment_id) REFERENCES comments(id)
);

CREATE TABLE dm_conversations (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE dm_conversation_members (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL, last_read_at TEXT,
  created_at TEXT NOT NULL, UNIQUE(conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE dm_messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender_user_id TEXT NOT NULL,
  body TEXT NOT NULL, deleted_at TEXT, created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
  FOREIGN KEY (sender_user_id) REFERENCES users(id)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE post_tags (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL, tag_id TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE trend_snapshots (
  id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, period TEXT NOT NULL,
  score INTEGER NOT NULL, rank INTEGER NOT NULL, calculated_at TEXT NOT NULL
);

CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_name TEXT, status TEXT NOT NULL,
  total_items INTEGER DEFAULT 0, processed_items INTEGER DEFAULT 0, failed_items INTEGER DEFAULT 0,
  options_json TEXT, started_at TEXT, finished_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE import_logs (
  id TEXT PRIMARY KEY, import_job_id TEXT NOT NULL, level TEXT NOT NULL, message TEXT NOT NULL,
  source_ref TEXT, created_at TEXT NOT NULL,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id)
);

CREATE TABLE import_mappings (
  id TEXT PRIMARY KEY, import_job_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
  target_type TEXT NOT NULL, target_id TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(import_job_id, source_type, source_id),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id)
);

CREATE TABLE migrations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL
);

-- Unique indexes for URLs
CREATE UNIQUE INDEX idx_posts_public_id ON posts(public_id);
CREATE UNIQUE INDEX idx_posts_user_slug ON posts(user_id, slug);
CREATE UNIQUE INDEX idx_posts_canonical_path ON posts(canonical_path);
CREATE UNIQUE INDEX idx_media_public_id ON media(public_id);
CREATE UNIQUE INDEX idx_media_canonical_path ON media(canonical_path);

-- Performance indexes
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_reactions_post_id ON reactions(post_id);
CREATE INDEX idx_follows_follower ON follows(follower_user_id);
CREATE INDEX idx_follows_following ON follows(following_user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_media_user_id ON media(user_id);
CREATE INDEX idx_reposts_post_id ON reposts(post_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);

-- Auth lookup indexes (added in migration 0002 / 0008)
CREATE INDEX idx_login_pins_email ON login_pins(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE UNIQUE INDEX idx_sessions_token_hash ON sessions(session_token_hash);

-- Admin-configurable settings, e.g. SMTP (migration 0010). Generic key/value.
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
```

> **Admin console**: a single admin account (credentials from `ADMIN_USERNAME`/
> `ADMIN_PASSWORD`, never a DB row) authenticates at `/admin` with a separate `as_admin`
> HttpOnly cookie and an in-memory session. `AdminService` moderates users/posts/comments
> and edits SMTP settings (`app_settings`). Login email is delivered by `SmtpEmailProvider`
> using those settings, with a console fallback.

### Backup Strategy

- **Frequency**: Operator-driven (cron) — SQLite is a single file plus the uploads directory.
- **Destination**: A backup volume/host path; use SQLite Online Backup API or `VACUUM INTO` for a consistent snapshot while running (WAL-safe).
- **Generation management**: Operator policy (e.g., retain last 7 daily snapshots).
- **Restoration**: Stop the app, replace `data/openmeow.db` and `uploads/`, restart (migrations re-validate on startup).

## Performance Requirements

### Response Time

| Operation | Target time | Measurement environment |
|------|---------|---------|
| Home feed (first page, cached thumbnails) | < 300 ms server render | Single small VPS (2 vCPU) |
| Post detail render | < 300 ms server render | Single small VPS |
| Media file serve (original/thumbnail) | < 100 ms TTFB | Local FS |
| Search (FTS5, typical dataset) | < 200 ms | Single small VPS |
| Migrations on startup | Fail-fast within seconds | Container start |

### Resource Usage

| Resource | Limit | Rationale |
|---------|------|------|
| Memory | ~512 MB baseline | Next.js + better-sqlite3 are light; fits small VPS. |
| CPU | 1–2 vCPU | Image processing (sharp) is the main spike; bounded by upload concurrency. |
| Disk | Grows with media | Dominated by uploads; SQLite DB stays small. |

## Security Architecture

### Data Protection
- **Encryption**: PINs and session tokens hashed at rest; transport over HTTPS (operator-terminated TLS / reverse proxy).
- **Access control**: Media `visibility` (public/unlisted/private) enforced on serve; ownership checks on mutations. Upload directory is non-executable.
- **Sensitive info**: Secrets (SMTP creds, app secret) via environment variables / `.env`, never committed.

### Input Validation
- **Validation**: All IDs/slugs validated; allowlists for dynamic sort/order; MIME + extension + size checks on uploads; XML size cap on import.
- **Sanitization**: Markdown render output and imported HTML sanitized (strip scripts, event handlers, `javascript:` URLs, unsafe iframes/styles).
- **Error handling**: Standard error envelope; never leak stack traces or SQL to clients.

### Threat-specific controls
- **SQL injection**: parameterized statements only; repository pattern; no string concatenation with user input.
- **XSS**: sanitization + `rel="noopener noreferrer"` on external links.
- **SSRF/XXE (import)**: disable XML external entities; validate/allowlist download URLs; block localhost/private IPs; limit redirects/size; download timeouts.
- **Auth abuse**: rate-limit PIN request/verify; cap failed attempts; HttpOnly + Secure + SameSite cookies.

## Scalability Design

### Handling Data Growth
- **Expected data volume**: Single-instance self-host — thousands of posts/users, tens of thousands of media files.
- **Degradation countermeasures**: Cursor pagination, list-only column selection, thumbnails, indexes, WAL + `busy_timeout`, periodic trend snapshots.
- **Archive strategy**: `archived` post status; old import jobs/logs prunable by operators.

### WordPress dump import (implemented)
The first import source is a **WordPress MySQL dump** (`wp_*` tables). It lives in
`src/lib/import/wordpress/` and is run via `npm run import:wordpress -- <dump.sql>`:

- `sqlDump.ts` — pure parser for `mysqldump` extended INSERTs (backslash escapes, NULL, multi-row).
- `contentTransform.ts` — strips Gutenberg block comments, extracts/rewrites `wp-content/uploads`
  image URLs, builds excerpts.
- `mediaFetcher.ts` — `ImageFetcher` interface + `HttpImageFetcher` (global `fetch`, http→https,
  timeout). Injectable so tests/imports run offline.
- `ImportRepository.ts` — all import SQL: `import_jobs`/`import_logs`/`import_mappings` plus
  **timestamp-preserving** inserts for `users`/`media`/`posts`/`comments` (the regular repos stamp
  `now`; an import keeps original dates). Batched inside a transaction.
- `WordPressImporter.ts` — orchestrator: users → media (copied from the live site, re-processed with
  `sharp` + thumbnail) → posts (body image URLs rewritten to local `/media/<id>/original`, featured
  image → cover) → tags/categories → comments (no-op when the dump has none). Imports `post_type='post'`
  only; AstroSocial generates fresh public ids/slugs/canonical paths (original WP permalinks are not preserved).

Post bodies are stored as cleaned WordPress HTML; AstroSocial's `marked → sanitizeHtml` pipeline passes
the allowlisted markup through so posts render almost identically to the source.

The importer first **scans the dump to build a plan** (counts of users, posts, images to download,
tag links, and comments) reported via an `onPlan` callback, then streams `done/total` per-phase
updates via `onProgress`. The CLI prints the plan up front and renders a live progress line for the
users, media, and posts phases (overwriting in a TTY; 10% milestones when piped).

> Security note: the importer fetches operator-supplied URLs from an operator-configured host
> (`--media-base`, defaulting to the dump's site). Private-IP/SSRF allowlisting (per the security
> section) is a future hardening item; today the CLI is an operator-run, trusted-input tool.

### Extensibility
- **Storage provider interface**: local FS implementation behind an interface so S3-compatible storage can be added without touching services.
- **Import sources**: `import_jobs.source_type` + mapping tables allow adding WordPress REST API (Phase 2) and other sources.
- **Migrations**: schema evolves safely post-release via ordered SQL migrations.
- **Editor**: Tiptap/Milkdown extensions allow adding content node types later.

## Test Strategy

### Unit Tests
- **Framework**: Vitest or Jest.
- **Target**: repositories, migration runner, auth/PIN/session, Markdown render/sanitize, URL generation, social logic, trend score, WordPress parse/convert/replace, duplicate prevention, permission checks, SQL-injection safety.
- **Coverage target**: All core logic modules covered; aim ≥ 80% on `lib/`.

### Integration Tests
- **Method**: Service + repository against a temporary SQLite DB.
- **Target**: post+media creation, import job lifecycle, timeline assembly.

### E2E Tests
- **Tool**: Playwright in a Docker Compose environment (`docker-compose.e2e.yml`) with app, test DB, migrations, and a mock email server.
- **Scenarios**: auth, post creation + media + unique URLs, social interactions, DM, WordPress import (incl. idempotent re-import), responsive + PWA.

## Technical Constraints

### Environment Requirements
- **OS**: Any Docker-capable host (Linux recommended); dev on Windows/macOS via devcontainer.
- **Minimum memory**: ~512 MB for the app container.
- **Required disk space**: Base image + growing uploads volume.
- **External dependencies**: SMTP/email for PIN delivery (mock in E2E); optional ffmpeg for video thumbnails.

### Performance Constraints
- SQLite is single-writer; high write concurrency is bounded — acceptable for self-hosted scale, mitigated by WAL + `busy_timeout`.
- Image processing concurrency must be bounded to protect CPU/memory.

### Security Constraints
- No ORM permitted — all SQL via parameterized repository methods.
- Uploaded files must never be executed; stored names randomized; serving respects visibility.
- TLS is expected to be terminated by the operator (reverse proxy); cookies require Secure in production.

## Dependency Management

| Library | Purpose | Version management policy |
|-----------|------|-------------------|
| next, react, react-dom | Web framework/UI | Pinned minor, periodic upgrades |
| better-sqlite3 | DB driver | Pinned (native module) |
| tiptap / milkdown | Editor | Pinned minor |
| sharp | Image processing | Pinned (native module) |
| markdown renderer + sanitizer | Render/XSS safety | Pinned; security-sensitive |
| xml parser (XXE-safe) | Import parsing | Pinned; security-sensitive |
| nodemailer / provider SDK | Email | Range within minor |
| vitest/jest, playwright | Testing | Range within minor |
| eslint, prettier, typescript | Tooling | Range within minor |
