# Phase 2 Implementation Plan — Sidebar destinations build-out

Goal: bring every sidebar/nav destination to a complete, polished experience. Each
milestone is an independently shippable `/add-feature` unit (steering docs →
implementation → validation → E2E + unit tests → branch → merge), following the shared
guidelines in `docs/phase1/`.

## Task list (the sidebar items needing work)

> "Exists in the UI but not fully implemented." All routes render today; the work is to
> deepen them (and replace the Discover placeholder).

- [ ] **T1 — Discover sidebar widget** (placeholder → real). Replace the static
      "Discover" links in the right sidebar with:
  - [ ] "Trends for you" — top tags (name + count) from `TrendService.popularTags`.
  - [ ] "Who to follow" — suggested users (exclude self + already-followed) with inline
        Follow toggle.
  - [ ] Per-request data plumbed into the shell; graceful empty/no-viewer fallback.
- [ ] **T2 — Search result tabs & states.** Top / Latest / People / Tags tabs (`?tab=`),
      query echoed in the box, per-tab empty states, and a no-query suggestions view.
- [ ] **T3 — Notifications tabs, per-item read, nav unread badge.**
  - [ ] All / Mentions tabs (`?tab=`).
  - [ ] Mark a single notification read when its target is opened.
  - [ ] Unread **badge** on the Notifications (and Messages) nav items, rail + bottom tab.
  - [ ] Pagination + friendly empty state.
- [ ] **T4 — Explore page.** `/explore` with window tabs (24h/7d/30d) for trending posts,
      trending tags, and who-to-follow; point the "Explore" nav item at it (`/trends`
      redirects to `/explore`).
- [ ] **T5 — Bookmarks filter & empty state.** In-page filter, unbookmark control on each
      item, empty-state CTA.
- [ ] **T6 — (optional) Home "For you / Following" tabs.** Toggle the home column between
      the global latest feed and the following timeline.

## Milestones

### P2.1 — Discover sidebar widget (P0)
**Deliverables:** `DiscoveryService.suggestions(viewerId)` (top tags + who-to-follow);
extend the shell so `layout()`/page renderers receive `sidebar` data; render the widget
with an inline follow toggle (reuse `/api/users/:username/follow`).
**Exit:** sidebar shows live tags + follow suggestions; following toggles in place;
no static links remain; unit tests for suggestion queries; E2E for the widget.

### P2.2 — Search tabs & states (P0)
**Deliverables:** extend `SearchService` with `latest` (newest matching posts) and tag
search; `searchPage(query, results, tab)` with tabs + states.
**Exit:** each tab returns the right set; empty/suggestion states render; E2E across tabs.

### P2.3 — Notifications tabs, per-item read, nav badge (P0)
**Deliverables:** `NotificationRepository.markReadByTarget`/single-read + `listByType`;
unread counts (notifications + DMs) plumbed into the shell for badges; notifications page
tabs + pagination.
**Exit:** opening a notification marks it read; nav badge reflects unread; tabs filter;
unit + E2E.

### P2.4 — Explore page (P1)
**Deliverables:** `/explore` page + `TrendService` window-scoped popular posts (24h/7d/30d
via `published_at` cutoffs); trending tags + who-to-follow; redirect `/trends` → `/explore`.
**Exit:** window tabs change results; nav "Explore" → `/explore`; unit + E2E.

### P2.5 — Bookmarks filter & empty state (P1)
**Deliverables:** client-side filter over the bookmarks list; unbookmark button reusing
`/api/posts/:id/bookmark`; empty-state CTA.
**Exit:** filter narrows the list; unbookmark removes an item; E2E.

### P2.6 — Home tabs (P2, optional)
**Deliverables:** "For you / Following" tabs on `/` (Following = `SocialService.timeline`).
**Exit:** tab switch changes the feed for logged-in users; E2E.

## Cross-cutting

- **Unread badges** (P2.3) are shared infrastructure: the shell needs the viewer's unread
  notification + DM counts. Compute once per request and pass into `layout()`.
- Maintain ≥ 80% unit coverage on new `lib/` logic; add a Playwright spec per milestone.
- Reuse existing repositories/services; only add new query methods (parameterized).

## Sequencing

P2.1 → P2.2 → P2.3 (the three P0s, in that order) deliver the biggest UX wins and the
shared badge infrastructure. P2.4 and P2.5 (P1) follow; P2.6 is optional polish.
