# AstroSocial

A self-hostable, open-source social publishing platform that combines a
Twitter/X-style social feed with a beautiful long-form writing experience —
designed for communities (it grew out of an astrophotography blog) that want to
own their content and run on their own hardware.

It runs from a single Docker Compose file on SQLite with **no external services
required**: passwordless email-PIN login, Markdown posts with media, a full
social graph, a moderation admin console, and a one-command importer for
migrating an existing WordPress site.

> See [`docs/phase1/`](docs/phase1/) for the full product, design, and
> architecture documents, and [`docs/phase1/implementation-plan.md`](docs/phase1/implementation-plan.md)
> for the roadmap.

## Description

AstroSocial is a single Node.js/TypeScript application (no separate backend
service). All business logic lives in a framework-agnostic service layer; data
is stored in SQLite and accessed only through repository classes that run
parameterized raw SQL (no ORM). Uploaded media lives on a mounted volume. The UI
is server-rendered HTML with small progressive-enhancement scripts — it works
without a heavy front-end framework and degrades gracefully without JavaScript.

## Features

- **Auth** — passwordless email-PIN login (6-digit, rate-limited), sessions, and
  editable public profiles (`/@username`).
- **Posts** — Markdown authoring with a toolbar + live preview, drafts, auto-save,
  cover images, tags, and stable unique URLs (`/@user/posts/slug`).
- **Media** — image/video uploads with generated thumbnails (via `sharp`), a
  media library, an in-editor picker, and a full-screen **lightbox with a
  magnifier tool** (click to zoom about the cursor, Shift+click to zoom out,
  Space+drag to pan, with a mode-aware cursor).
- **Feed & discovery** — cover-image home grid with reading time and
  **infinite scroll**, full-text search (SQLite FTS5), tags & tag pages, a
  **Users directory** (Explore), and a Discover widget.
- **Social** — comments, likes, emoji reactions, follow + following timeline,
  reposts, quote posts, bookmarks, direct messages, and notifications.
- **Admin console** (`/admin`) — a single env-configured admin account; moderate
  (edit/delete) users, posts, and comments; configure **SMTP** for real login
  email; set the **site name/description** and a **login-email template**
  (`{PIN}` / `{sitename}` tags).
- **WordPress import** — `npm run import:wordpress` migrates users, posts, media
  (copied locally), tags, and comments from a `mysqldump` export, with a
  pre-scan plan and live progress.
- **PWA & feeds** — installable (manifest, service worker, offline fallback),
  Open Graph tags, and an RSS feed at `/rss.xml`.
- **Theming** — dark theme by default + light theme (persisted toggle),
  responsive from a single codebase, accessible, reduced-motion aware.
- **Self-host** — one Docker Compose file, SQLite, raw SQL, data on volumes.

## Tech stack

- **Runtime**: Node.js v24 + TypeScript (ESM), run directly with
  [`tsx`](https://github.com/privatenumber/tsx) (no build step in dev).
- **Database**: SQLite via **better-sqlite3** (WAL mode, FTS5 full-text search),
  accessed only through repository classes — no ORM.
- **Media**: **sharp** (image processing/thumbnails), **busboy** (multipart uploads).
- **Content**: **marked** (Markdown) + **sanitize-html** (XSS-safe rendering).
- **Email**: **nodemailer** (SMTP); console fallback when unconfigured / in test mode.
- **Web layer**: Node’s built-in `http` server rendering server-side HTML +
  inline progressive-enhancement scripts.
- **Tooling**: **Vitest** (unit/integration), **Playwright** (E2E), **ESLint** +
  **Prettier**, **Husky** + **lint-staged**, **Docker Compose** for self-hosting.

## Requirements

- Node.js **v24.x** and npm
- (Optional) Docker + Docker Compose for containerized runs

## Setup

```bash
# 1. Install dependencies
npm install

# 2. (optional) copy the env template and adjust as needed
cp .env.example .env

# 3. (first run only) install the Playwright browser used by E2E tests
npx playwright install chromium
```

On startup the app creates the `data/` and `uploads/` directories and applies
database migrations automatically. The SQLite database lives at
`data/openmeow.db` by default (override with `OPENMEOW_DB_PATH`).

### Key environment variables

All are optional; sensible defaults apply (see [`.env.example`](.env.example)).

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | HTTP port | `3000` |
| `OPENMEOW_DB_PATH` | SQLite database file | `data/openmeow.db` |
| `OPENMEOW_UPLOADS_DIR` | Uploaded media directory | `uploads/` |
| `OPENMEOW_TEST_MODE` | Force login PIN to `000000`, log instead of emailing | off |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin console (`/admin`) credentials | `admin` / `admin` |

> ⚠️ Change `ADMIN_USERNAME` / `ADMIN_PASSWORD` before exposing the server, and
> never enable `OPENMEOW_TEST_MODE` in production — it disables real PIN security.
> SMTP for real login email is configured at runtime in **/admin → Settings**.

## How to start development

```bash
# Run the app with auto-reload
npm run dev
# App: http://localhost:3000  →  open /login   ·   Admin: /admin
```

For local development, enable test mode so the login PIN is always `000000`
(no email is sent — it’s logged to the console):

```bash
# bash / sh
OPENMEOW_TEST_MODE=1 npm run dev

# Windows PowerShell
$env:OPENMEOW_TEST_MODE = "1"; npm run dev
```

Run without auto-reload with `npm start`. Seed some demo content with
`npm run seed`. Migrations are applied on startup, or manually with
`npm run migrate`.

### Run with Docker

```bash
docker compose up --build
# App on http://localhost:3000
```

The entrypoint creates data directories, runs migrations, then starts the server.
The SQLite database and uploads persist to `./data` and `./uploads` via volumes.

### Import an existing WordPress site

```bash
npm run import:wordpress -- path/to/wordpress.sql
#   --no-media        skip downloading media (keep remote URLs)
#   --max-media N     cap downloads · --limit-posts N  cap posts (dry runs)
#   --db <path> --uploads <path>   target a specific DB / uploads dir
```

## How to test

```bash
# Unit & integration tests (Vitest, in-memory SQLite)
npm test                 # run once
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report

# End-to-end tests (Playwright) — auto-launches the server in test mode
npm run test:e2e         # headless
npm run test:e2e:ui      # interactive UI mode (watch live, time-travel)
npm run test:e2e:report  # open the HTML report (screenshots, traces, video)
```

Playwright launches the server in **test mode** against an isolated database
(`e2e/.tmp/`), so no manual setup is needed beyond the one-time
`npx playwright install chromium`. Step-by-step screenshots are written to
`e2e/screenshots/`.

### Quality gates (run before pushing)

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run test:e2e    # Playwright
```

CI (lint, typecheck, unit, and Playwright E2E) runs on every PR via GitHub Actions.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the server with auto-reload (development) |
| `npm start` | Start the server (no auto-reload) |
| `npm run build` | Type-check + emit JS with `tsc` |
| `npm run migrate` | Apply pending SQL migrations |
| `npm run seed` | Insert demo user + sample posts (idempotent) |
| `npm run import:wordpress -- <dump.sql>` | Import a WordPress `mysqldump` export |
| `npm test` | Run unit/integration tests once (Vitest) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with a coverage report |
| `npm run test:ui` | Vitest interactive UI |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Playwright interactive UI mode |
| `npm run test:e2e:report` | Open the Playwright HTML report |
| `npm run lint` | ESLint |
| `npm run typecheck` | Type-check only (`tsc --noEmit`) |
| `npm run format` | Format the codebase with Prettier |

## Project layout

```
src/
  lib/
    config/        env + test-mode flag
    crypto/        secret hashing (scrypt)
    db/            connection, migration runner, repositories (raw SQL)
    auth/          PIN, session, email providers (console + SMTP)
    services/      Auth, Profile, Post, Media, Social, DM, Search, Trend,
                   Discovery, Notification, Settings, Admin
    import/        WordPress dump importer (parser, media fetch, orchestrator)
    markdown/      Markdown render + HTML sanitizer
    urls/          publicId, slug, canonicalPath
    text/          reading-time helper
    feed/          RSS
    storage/       storage provider (local filesystem)
    views/         server-rendered HTML pages, admin pages, theme/CSS
  app.ts           composition root (buildApp)
  server.ts        HTTP adapter
migrations/        ordered SQL migration files (0001–0010)
e2e/               Playwright tests + config
docs/              product, design, architecture, and planning documents
```

## Contributing & security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

MIT — see [LICENSE](LICENSE).
