# Architecture — Phase 2 (delta)

The Phase 1 architecture (`docs/phase1/architecture.md`) is unchanged and authoritative:
TypeScript + Node 24, SQLite via `better-sqlite3` (WAL + FTS5), raw parameterized SQL
through repositories (no ORM), the thin `node:http` adapter run via `tsx`, and the
three-column app shell. Phase 2 adds **no new runtime dependencies** and **no schema
migrations** — it builds on existing tables.

## What's new in Phase 2

### Shell becomes context-aware
The shared `layout()` gains a per-request `ShellContext` (viewer, unread counts, sidebar
data). The HTTP layer composes it once per request and passes it to the page renderer.
This is the one structural change; it stays within the UI/service/repository layering
(the context is built from services, not raw SQL).

### New service methods / a Discovery service
- `DiscoveryService` (or additions to `TrendService`): `whoToFollow`, `trendingTags`.
- `SearchService`: `latest` post search + tag search; tab-aware `query`.
- `NotificationService` / `NotificationRepository`: type-filtered list + pagination;
  unread counts already exist.
- `TrendService` / `TrendRepository`: window-scoped popular posts (`published_at` cutoff).

### No new tables
All features reuse Phase 1 tables: `users`, `follows`, `posts`, `tags`, `post_tags`,
`likes`, `reactions`, `comments`, `reposts`, `bookmarks`, `notifications`, `posts_fts`,
`dm_*`. New repository **methods** are added (parameterized); existing schema suffices.

## Performance

- Sidebar (Discover) and badge queries run on **every page**, so they must be small and
  bounded (tight `LIMIT`s, indexed lookups). `whoToFollow` excludes already-followed users
  via a subquery on `follows` (indexed on `follower_user_id`).
- Window-scoped trends add a `published_at >= ?` predicate (indexed via
  `idx_posts_published_at`).
- Search "Latest" reuses the FTS MATCH then orders by `published_at`.

## Security

- Unchanged Phase 1 posture. All new SQL parameterized and inside repositories.
- Sidebar/badge composition is best-effort and must never turn a page render into a 500.
- Rendered names/tags reuse the existing `escapeHtml`.

## Testing

- Same stack: Vitest (unit/integration against in-memory migrated DB) + Playwright E2E in
  the Dockerized test-mode environment. Each Phase 2 milestone adds its own specs.
