# Glossary — Phase 2 (additions)

Extends `docs/phase1/glossary.md`. Only new/clarified terms are listed here.

**Updated:** 2026-06-13

## Terms

### Sidebar destination
A primary navigation target reachable from the left rail, mobile bottom tab bar, or the
right sidebar (Home, Users, Search, Notifications, Messages, Bookmarks, Timeline,
Discover). Phase 2 brings each to a complete experience.

### Discover widget
The right-sidebar panel. In Phase 1 it was static links; in Phase 2 it becomes a live
widget with **Trends for you** (top tags) and **Who to follow** (follow suggestions).

### Who to follow
Suggested users to follow, excluding the viewer and anyone the viewer already follows,
ranked by follower count then recency.

### ShellContext
Per-request data passed into the shared `layout()` so the app shell can render
viewer-aware chrome: unread badges and the Discover widget. Built once per request in the
HTTP layer from services; page **content** builders remain independent of it.

### Unread badge
A small indicator on the Notifications and Messages nav items showing the viewer's unread
counts (from `NotificationService.unreadCount` / `DMService.unreadCount`).

### Search tab
A filter on the search results page: **Top** (relevance), **Latest** (newest matching
posts), **People** (users), **Tags** (matching tags), selected via `?tab=`.

### Notifications tab
A filter on the notifications page: **All** or **Mentions** (comment-type), via `?tab=`.

### Trend window
A time range for trending content on Explore: last **24h / 7d / 30d**, applied as a
`published_at >= cutoff` predicate over the Phase 1 engagement score.

### Explore page (Users directory)
`/explore` — a directory grid of all users, each shown with their avatar, `@username`,
and most-recent image. The "Users" nav item points here; `/trends` redirects to it.
