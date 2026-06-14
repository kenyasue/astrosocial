# Functional Design — Phase 2 (Sidebar destinations build-out)

Builds on `docs/phase1/functional-design.md`. Same layered architecture (UI/API →
services → repositories, no ORM) and the three-column app shell. This doc covers only
the deltas needed for the Phase 2 milestones.

## 1. Shell data plumbing (shared)

Today `layout()` is stateless. Phase 2 needs per-request data for two things: the
**Discover** widget and **unread badges**. Introduce a `ShellContext`:

```typescript
interface ShellContext {
  viewer: { username: string } | null;
  unreadNotifications: number;   // 0 hides the badge
  unreadMessages: number;
  sidebar: {
    trendingTags: { name: string; slug: string; count: number }[];
    whoToFollow: { username: string; displayName: string }[];
  };
}
```

- The HTTP layer builds a `ShellContext` once per request (cheap, small LIMITs) and
  passes it to the page renderer / `layout()`.
- `navRail()` / `bottomNav()` render an unread badge when a count > 0.
- `rightSidebar(ctx)` renders the live Discover widget (or an empty state).

To avoid touching every page signature, add a small helper, e.g.
`renderPage(title, body, ctx, opts?)`, and have route handlers pass `ctx`. Page builder
functions that need it (sidebar, badges) receive `ctx`; content builders stay as-is.

## 2. Discovery (P2.1)

`DiscoveryService` (or extend `TrendService`):
- `trendingTags(limit)` → reuse `TagRepository.popularTags`.
- `whoToFollow(viewerId | null, limit)` → users excluding the viewer and anyone the
  viewer already follows, ordered by follower count then recency.

New repository query (parameterized) on `UserRepository`/`FollowRepository`:
```sql
SELECT u.username, u.display_name
FROM users u
WHERE u.id != @viewer
  AND u.id NOT IN (SELECT following_user_id FROM follows WHERE follower_user_id = @viewer)
ORDER BY (SELECT COUNT(*) FROM follows f WHERE f.following_user_id = u.id) DESC, u.created_at DESC
LIMIT @limit
```
(For an anonymous viewer, drop the exclusion subqueries.)

Sidebar follow buttons reuse `POST/DELETE /api/users/:username/follow` (returns
`{ following }`), toggling in place.

## 3. Search tabs (P2.2)

Extend `SearchService.query` to support a `tab`:
- **Top**: current FTS relevance ordering (`SearchRepository.searchPostIds`).
- **Latest**: matching posts ordered by `published_at DESC` — add
  `SearchRepository.searchPostIdsLatest(matchExpr, limit)` (same MATCH, `ORDER BY
  p.published_at DESC`).
- **People**: `UserRepository.search`.
- **Tags**: `TagRepository.searchByName(q)` (LIKE on name/slug) → tag chips linking to
  `/tags/:slug`.

`searchPage(query, results, tab)` renders the tab bar (`?tab=top|latest|people|tags`),
echoes the query, and shows per-tab empty states. No query → a suggestions view
(trending tags + popular people).

## 4. Notifications (P2.3)

`NotificationRepository` additions (parameterized):
- `listByUser(userId, { type?, limit, cursor? })` — filter to mention-like types for the
  **Mentions** tab (`comment`); paginate by `created_at`.
- `markRead(userId, id)` already exists (Phase 1). Add `markReadByPostForUser` if we mark
  read on target open; simplest: when rendering a post/profile that a notification points
  to, no-op — instead mark read via a small `POST /api/notifications/:id/read` already
  present (Phase 1) triggered by the notification link (anchor with a tiny beacon, or mark
  on the notifications list when its row is clicked).

**Unread badge:** `ShellContext.unreadNotifications = NotificationService.unreadCount()`
and `unreadMessages = DMService.unreadCount()`. The nav renders a badge dot/count.

**Notifications page:** All / Mentions tabs (`?tab=`), "load more", friendly empty state.

## 5. Explore → Users directory (P2.4; revised)

`/explore` is a **Users directory**: a responsive grid of all users (newest first,
capped at 100). `UserRepository.listDirectory(limit)` resolves each user's avatar and
most-recent image-MIME media in a single query (correlated subqueries, no N+1);
`DiscoveryService.userDirectory(limit)` maps the resulting public ids to
`/media/<id>/thumbnail` URLs. Each card shows the user's last image as a 4:3 cover
(placeholder when none), their avatar, display name, and `@username`, linking to
`/@username`. The nav item is labelled **"Users"** (it still points at `/explore`);
`/trends` 302-redirects to `/explore`.

> Superseded the original P2.4 design (window-scoped trending posts/tags/who-to-follow).
> The `TrendService`/`TrendRepository` machinery remains in use by the right-sidebar
> Discover widget; pagination of the directory is a future enhancement.

## 6. Bookmarks (P2.5)

`bookmarksPage(cards)` gains a client-side text filter (filter rendered cards by title/
excerpt) and an unbookmark button per card (`DELETE /api/posts/:id/bookmark`, then remove
the card from the DOM). Empty state with a CTA to `/explore`.

## 7. Home tabs (P2.6, optional)

`/` accepts `?tab=foryou|following`. "Following" uses `SocialService.timeline(viewerId)`
(already returns timeline items). Tabs render at the top of the home column.

## Error handling & security

- All new SQL parameterized and confined to repositories.
- Sidebar/badge queries are best-effort: failures degrade to an empty widget / no badge,
  never a 500 for the whole page.
- Reuse existing sanitization for any rendered user content (names, tags).

## Testing strategy

- **Unit:** who-to-follow exclusion logic, latest/tag search queries, notification
  type-filter + unread counts, window-scoped trend cutoffs, bookmark filter helper.
- **E2E:** Discover widget (tags + follow toggle), search tabs (each returns expected
  results + empty states), notifications tabs + per-item read + nav badge appears/clears,
  explore window tabs, bookmarks filter + unbookmark.
