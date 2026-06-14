# Product Requirements — Phase 2 (Sidebar destinations build-out)

## Context

Phase 1 (see `docs/phase1/`) shipped the AstroSocial MVP: auth, posts, media, the home
grid, the editor, social (likes/reactions/comments/follow/reposts/quotes/bookmarks/
notifications), DMs, search/tags/trends, PWA, and the three-column app-shell redesign.

The redesign added a left navigation rail, a mobile bottom tab bar, and a right
"Discover" sidebar. Every nav destination **routes to a real page**, but several are
**shallow or placeholder** relative to their labels and the layout's intent. Phase 2
brings these sidebar destinations up to a complete, polished experience.

This doc complements the shared **`docs/phase1/development-guidelines.md`** and
**`docs/phase1/design-guidelines.md`**, which remain in force for all Phase 2 work
(no-ORM/parameterized SQL, sanitization, dark-default + light themes, responsive
single-codebase app shell, accessibility).

## Sidebar audit — current state vs. gap

| Sidebar item | Route | Current state | Gap to close in Phase 2 |
|---|---|---|---|
| **Home** | `/` | Latest published feed (cards, cursor "Load more") | Optional: "For you / Following" tabs; in-feed composer |
| **Explore** | `/trends` | Basic trends list (popular posts/tags/users) | A real Explore page: window tabs (24h/7d/30d), trending tags with post counts, trending posts, who-to-follow — distinct from a raw list |
| **Search** | `/search` | FTS over posts + user substring search, single flat result list | Result tabs (Top / Latest / People / Tags), an empty/suggestions state, query echoed in the box, "no results" per tab |
| **Notifications** | `/notifications` | Flat list + "mark all read" | Tabs (All / Mentions), per-notification mark-read on click-through, an unread **badge in the nav**, pagination, grouped empty state |
| **Bookmarks** | `/bookmarks` | Flat list of saved posts | In-page search/filter, a remove-from-bookmarks affordance, a friendly empty state with CTA |
| **Discover** (right sidebar) | panel | **Placeholder static links only** | A real widget: "Trends for you" preview (top tags), "Who to follow" suggestions (with follow buttons), and an about/footer block |

> Of these, **Discover** is the only true placeholder (static links). The others are
> functional but minimal; Phase 2 elevates each to a full-featured destination.

## Goals

- Turn the **Discover** sidebar from static links into a live widget.
- Give **Search**, **Notifications**, and **Explore** the tabbed, filterable UX their
  labels imply.
- Add an **unread notifications badge** to the nav rail + bottom tab bar.
- Improve **Bookmarks** with in-page filtering and a clear empty state.
- Keep everything within the existing app shell, themes, and architecture; reuse
  existing services/repositories where possible (TrendService, SearchService,
  NotificationService, SocialService).

## Target users

Same personas as Phase 1 (`docs/phase1/product-requirements.md`): indie devs, creators,
small-team self-hosters. Phase 2 specifically serves the **active reader/discoverer** who
relies on the sidebar to find content and people and to keep up with activity.

## Success metrics

- Every sidebar destination presents a complete, non-placeholder experience (no static
  "links-only" panels).
- Search returns results grouped under Top / Latest / People / Tags tabs.
- The nav shows an accurate unread-notifications count; opening a notification marks it read.
- The Discover widget surfaces real trending tags and follow suggestions.
- Full unit + Playwright E2E coverage for each; all quality gates green.

## Functional requirements

### P2-A — Discover sidebar widget (P0)
**User story:** As a visitor, I want the right sidebar to show real trends and people to
follow so I can discover content from anywhere in the app.
**Acceptance:**
- [ ] Replace the static "Discover" links with a **"Trends for you"** block listing the
      top N tags (name + post count, linking to `/tags/:slug`).
- [ ] A **"Who to follow"** block listing suggested users (not the viewer, not already
      followed) with an inline Follow button that toggles without a full reload.
- [ ] Falls back gracefully (hidden/empty-state) when there is no data or no viewer.
- [ ] Sidebar data is provided per-request to `layout()`/the shell (see functional design).

### P2-B — Search result tabs & states (P0)
**User story:** As a user, I want to filter search results by Top/Latest/People/Tags.
**Acceptance:**
- [ ] Tabs: **Top** (relevance), **Latest** (newest posts), **People** (users), **Tags**
      (matching tags). Active tab via `?tab=`.
- [ ] The query stays in the search box; each tab shows its own empty state.
- [ ] A no-query state suggests trending tags / popular people.

### P2-C — Notifications tabs, per-item read & nav badge (P0)
**User story:** As a user, I want to filter notifications, mark them read by visiting,
and see an unread count in the nav.
**Acceptance:**
- [ ] Tabs: **All** and **Mentions** (comment/reply-type). Active via `?tab=`.
- [ ] Visiting a notification's target marks **that** notification read.
- [ ] The nav rail + bottom tab show an **unread badge** when count > 0 (notifications and
      DMs).
- [ ] Pagination (cursor or "load more"); grouped/friendly empty state.

### P2-D — Explore page (P1)
**User story:** As a visitor, I want an Explore page that organizes discovery by time
window and category.
**Acceptance:**
- [ ] Window tabs (24h / 7d / 30d) for trending posts.
- [ ] Trending tags (with counts) and who-to-follow sections.
- [ ] `/trends` becomes (or redirects to) the richer `/explore` experience; the
      "Explore" nav item points to it.

### P2-E — Bookmarks filter & empty state (P1)
**User story:** As a user, I want to filter my bookmarks and easily unbookmark.
**Acceptance:**
- [ ] In-page text filter over the user's bookmarks.
- [ ] A remove/unbookmark control on each item that updates the list.
- [ ] A friendly empty state with a CTA to explore.

### P2-F — Home tabs (P2, optional)
**User story:** As a logged-in user, I want "For you" and "Following" tabs on Home.
**Acceptance:**
- [ ] Tabs switch between the global latest feed and the following timeline.

## Non-functional requirements

- Reuse Phase 1 NFRs (`docs/phase1/`). New list/widget queries must be cursor- or
  limit-bounded and must not load full post bodies. Sidebar widget queries must be cheap
  (small LIMITs) since they run on every page.
- All themes, responsiveness, and accessibility rules from `design-guidelines.md` apply.

## Out of scope

- Real-time push (WebSockets) for notifications/DMs; algorithmic ranking beyond the
  Phase 1 engagement score; saved-search history persistence; notification email digests.
