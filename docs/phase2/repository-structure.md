# Repository Structure — Phase 2 (delta)

The layout and conventions from `docs/phase1/repository-structure.md` are unchanged.
Phase 2 adds a few files and methods; nothing moves.

## New / changed files

```
src/lib/
  services/
    DiscoveryService.ts        # (new) trendingTags + whoToFollow for the sidebar
    SearchService.ts           # (changed) tab-aware query: top/latest/people/tags
    TrendService.ts            # (changed) window-scoped popular posts (24h/7d/30d)
  db/repositories/
    UserRepository.ts          # (changed) whoToFollow query
    SearchRepository.ts        # (changed) searchPostIdsLatest
    TagRepository.ts           # (changed) searchByName
    NotificationRepository.ts  # (changed) listByUser({type,limit,cursor})
    TrendRepository.ts         # (changed) popularPostIds(window)
  views/
    pages.ts                   # (changed) ShellContext, navRail badge, rightSidebar widget,
                               #           searchPage tabs, notificationsPage tabs,
                               #           explorePage, bookmarks filter/unbookmark
src/
  app.ts                       # (changed) wire DiscoveryService; expose shell-context builder
  server.ts                    # (changed) build ShellContext per request; /explore route;
                               #           tab query params; notification read-on-open
e2e/
  discover.spec.ts             # (new) Discover widget
  search-tabs.spec.ts          # (new) search tabs/states
  notifications.spec.ts        # (new) tabs + per-item read + nav badge
  explore.spec.ts              # (new) window tabs
  bookmarks.spec.ts            # (new) filter + unbookmark
```

## Conventions (reaffirmed)

- New SQL only in `lib/db/repositories/*`, parameterized; services orchestrate.
- View functions in `lib/views/pages.ts`; styles in `lib/views/theme.ts` using tokens.
- A Playwright spec per milestone under `e2e/`; unit/integration tests beside `lib/`.
- `ShellContext` is built in the HTTP layer (server.ts) from services and threaded into
  page rendering — keep page **content** builders independent of it where possible
  (only the shell chrome — rail, sidebar, badges — consumes it).
