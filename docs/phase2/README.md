# Phase 2 — Sidebar destinations build-out

This folder specifies the next phase: bringing every sidebar/nav destination to a
complete, polished experience (the items exist in the UI but are shallow or, for
**Discover**, a placeholder).

- `product-requirements.md` — Phase 2 PRD (includes the sidebar audit table)
- `implementation-plan.md` — milestones P2.1–P2.6 **and the task list**
- `functional-design.md` — deltas (ShellContext, search tabs, notifications, explore, …)
- `architecture.md` — delta (no new deps, no migrations; new service/repo methods)
- `repository-structure.md` — new/changed files
- `glossary.md` — new terms

Shared **development-guidelines.md** and **design-guidelines.md** live in `../phase1/`
and remain in force for all Phase 2 work.

## Sidebar tasks at a glance

1. **Discover widget** — replace static links with live trending tags + who-to-follow.
2. **Search** — Top/Latest/People/Tags tabs + empty/suggestion states.
3. **Notifications** — All/Mentions tabs, per-item read, unread badge in the nav.
4. **Explore** — `/explore` with 24h/7d/30d trend windows + tags + who-to-follow.
5. **Bookmarks** — in-page filter + unbookmark + empty-state CTA.
6. **Home tabs** (optional) — For you / Following.
