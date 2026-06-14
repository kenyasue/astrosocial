# Contributing to AstroSocial

Thanks for your interest in improving AstroSocial! This project values clear,
reviewable code and a welcoming community.

## Getting started

```bash
npm install
npx playwright install chromium   # first time only, for E2E
npm run dev                        # http://localhost:3000
```

Optionally seed demo content: `npm run seed`.

## Development workflow

AstroSocial follows a lightweight spec-driven flow (see `docs/` and `CLAUDE.md`):

1. Read `docs/` (product, architecture, development & design guidelines).
2. Branch from `main`: `feat/...`, `fix/...`, or `refactor/...`.
3. Make focused changes that match existing patterns.
4. Add tests (see below) and keep all quality gates green.
5. Open a pull request into `main` using the PR checklist.

## Quality gates (must pass)

```bash
npm test            # unit + integration (Vitest)
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test:e2e    # Playwright E2E
```

## Coding standards (highlights)

These come from `docs/development-guidelines.md` and are enforced in review:

- **No ORM.** All SQL is parameterized and lives in `src/lib/db/repositories/`.
- **Sanitize** all rendered Markdown / imported HTML; escape user content in pages.
- **Layered architecture**: UI/API → services → repositories. No business logic in
  route handlers; no SQL outside repositories.
- **Design**: every UI follows `docs/design-guidelines.md` — dark default + light
  theme via tokens, responsive (one codebase), accessible.
- Tests: unit-test new logic; add a Playwright spec for new user-facing flows.

## Commit messages

Conventional Commits, e.g. `feat(posts): add cover images`. Keep PRs scoped.

## Reporting bugs / security

- Bugs: open a GitHub issue with steps to reproduce.
- Security vulnerabilities: please follow `SECURITY.md` (do **not** open a public issue).
