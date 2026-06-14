# Repository Structure Document

This document defines the concrete directory layout for AstroSocial, reflecting the layered architecture (UI → API → Service → Data) and the no-ORM, raw-SQL-via-repositories policy from `docs/architecture.md`. It builds on the recommended structure in `docs/ideas/initial-requirements.md`.

## Project Structure

```
openmeow/
├── app/                      # Next.js App Router: pages, layouts, route handlers
│   ├── (public)/             # Public screens (home, post detail, profile, media, search, trends, tags)
│   ├── (auth)/               # Login, PIN verification
│   ├── (app)/                # Authenticated screens (create/edit post, drafts, library, dm, settings, import)
│   └── api/                  # Route handlers (HTTP layer) grouped by resource
├── components/               # React components (UI layer), grouped by domain
│   ├── editor/  media/  post/  user/  timeline/  dm/  import/  layout/
├── lib/                      # Server-side logic (service + data + utilities)
│   ├── db/                   # Connection, migration runner, repositories
│   ├── services/             # Service layer (business logic)
│   ├── auth/                 # PIN + session logic
│   ├── markdown/             # render / sanitize / htmlToMarkdown
│   ├── wordpress/            # parse / convert / import helpers
│   ├── storage/              # storage provider (local FS, pluggable)
│   ├── urls/                 # publicId / slug / canonicalPath
│   ├── validation/           # input validators, allowlists
│   └── config/               # env loading, constants
├── migrations/               # Ordered SQL migration files
├── public/                   # Static assets, PWA manifest, icons, service worker
├── tests/                    # unit / integration / e2e / fixtures
├── docker/                   # Dockerfiles and compose helpers
├── docs/                     # Persistent documents
├── .steering/                # Per-task working documents (git-ignored)
├── uploads/                  # Uploaded media (volume; git-ignored)
├── data/                     # SQLite database (volume; git-ignored)
├── Dockerfile
├── docker-compose.yml
├── docker-compose.e2e.yml
├── playwright.config.ts
└── package.json
```

## Directory Details

### app/ (UI + API)

**Role**: Next.js App Router. Server components and pages render UI; `app/api/**` route handlers form the HTTP/API layer.

**Files placed here**:
- `app/**/page.tsx`, `layout.tsx`: screens and layouts (one folder per route segment).
- `app/api/<resource>/route.ts`: route handlers (e.g. `app/api/posts/route.ts`, `app/api/auth/request-pin/route.ts`).
- Direct media serving routes: `app/media/[publicId]/original/route.ts`, `.../thumbnail/route.ts`.

**Naming conventions**:
- Route segment folders: kebab-case; dynamic segments `[id]`, `[publicId]`, `[username]`.
- Special files use Next.js conventions (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`).

**Dependencies**:
- May depend on: `components/`, `lib/services/` (and `lib/auth` for session checks).
- Must not depend on: `lib/db/repositories` directly (go through services).

**Example**:
```
app/
├── (public)/@[username]/posts/[slug]/page.tsx
├── (auth)/login/page.tsx
└── api/posts/[id]/publish/route.ts
```

### components/ (UI components)

**Role**: Reusable React components grouped by domain.

**Files placed here**:
- `editor/` (Tiptap/Milkdown editor, toolbar, media picker), `post/` (PostCard, PostBody, QuoteCard), `media/`, `timeline/`, `user/`, `dm/`, `import/`, `layout/` (nav, sidebar, grid).

**Naming conventions**:
- Component files: PascalCase (`PostCard.tsx`, `MediaPicker.tsx`).

**Dependencies**:
- May depend on: other components, client-safe utilities, API calls.
- Must not depend on: `lib/db/`, `lib/services/` server-only modules from client components.

### lib/ (service + data + utilities)

**Role**: All server-side logic. Split into the service layer, the data layer, and supporting utilities.

#### lib/db/

**Role**: Database access. Holds the shared connection, the migration runner, and one repository per table.

**Files placed here**:
- `connection.ts` (configures WAL, `busy_timeout`, FTS5).
- `migrate.ts` (MigrationRunner: applies `migrations/*.sql` in order, records in `migrations` table, fails startup on error).
- `repositories/UserRepository.ts`, `PostRepository.ts`, `MediaRepository.ts`, `CommentRepository.ts`, `LikeRepository.ts`, `ReactionRepository.ts`, `FollowRepository.ts`, `RepostRepository.ts`, `BookmarkRepository.ts`, `NotificationRepository.ts`, `DMRepository.ts`, `ImportRepository.ts`, `TagRepository.ts`, `TrendRepository.ts`, `SessionRepository.ts`, `LoginPinRepository.ts`.

**Naming conventions**:
- Repository files: PascalCase ending in `Repository.ts`.

**Dependencies**:
- May depend on: `connection.ts`, types.
- Must not depend on: `lib/services/`, `app/`, `components/`. Repositories own all SQL; no business logic.

#### lib/services/

**Role**: Business logic orchestrating repositories, storage, markdown, and notifications.

**Files placed here**:
- `AuthService.ts`, `PostService.ts`, `MediaService.ts`, `SocialService.ts` (or split: `CommentService.ts`, `ReactionService.ts`, `FollowService.ts`, `BookmarkService.ts`), `TimelineService.ts`, `NotificationService.ts`, `DMService.ts`, `TrendService.ts`, `WordPressImportService.ts`.

**Naming conventions**: PascalCase ending in `Service.ts`.

**Dependencies**:
- May depend on: `lib/db/repositories`, `lib/auth`, `lib/markdown`, `lib/storage`, `lib/wordpress`, `lib/urls`, `lib/validation`.
- Must not depend on: `app/`, `components/`.

#### lib/auth, lib/markdown, lib/wordpress, lib/storage, lib/urls, lib/validation, lib/config

**Role**: Focused utility modules.
- `auth/pin.ts`, `auth/session.ts`.
- `markdown/render.ts`, `markdown/sanitize.ts`, `markdown/htmlToMarkdown.ts`.
- `wordpress/parseXml.ts`, `convertPost.ts`, `importMedia.ts`, `importUsers.ts`, `importComments.ts`.
- `storage/localStorageProvider.ts` (implements a `StorageProvider` interface).
- `urls/publicId.ts`, `slug.ts`, `canonicalPath.ts`.
- `validation/` validators and allowlists; `config/` env + constants.

**Naming conventions**: camelCase for function-module files; PascalCase for classes/providers.

### migrations/

**Role**: Ordered SQL migrations applied on startup.

**Naming convention**: `NNNN_description.sql` (zero-padded), e.g.:
```
migrations/
├── 0001_create_users.sql
├── 0002_create_sessions.sql
├── 0003_create_media.sql
├── 0004_create_posts.sql
├── 0005_create_social_tables.sql
├── 0006_create_dm_tables.sql
└── 0007_create_import_tables.sql
```

### tests/ (Test Directory)

#### unit/

**Role**: Unit tests mirroring the `lib/` structure.

**Structure**:
```
tests/unit/
└── lib/
    ├── db/repositories/PostRepository.test.ts
    ├── services/PostService.test.ts
    ├── urls/slug.test.ts
    └── wordpress/htmlToMarkdown.test.ts
```

**Naming conventions**: `[target].test.ts` (e.g. `PostService.ts` → `PostService.test.ts`).

#### integration/

**Role**: Service + repository tests against a temporary SQLite DB.

**Structure**:
```
tests/integration/
├── posts/post-create.test.ts
└── import/import-lifecycle.test.ts
```

#### e2e/

**Role**: Playwright specs by user scenario.

**Structure**:
```
tests/e2e/
├── auth/login.spec.ts
├── posts/create-publish.spec.ts
├── social/interactions.spec.ts
├── dm/conversation.spec.ts
└── import/wordpress-import.spec.ts
```

#### fixtures/

**Role**: Test data, including WordPress export samples.

**Structure**:
```
tests/fixtures/
└── wordpress/
    ├── basic-export.xml
    ├── gutenberg-export.xml
    ├── media-export.xml
    ├── comments-export.xml
    └── edge-cases-export.xml
```

### docs/ (Documentation Directory)

**Documents placed here**:
- `product-requirements.md`, `functional-design.md`, `architecture.md`, `repository-structure.md` (this document), `development-guidelines.md`, `glossary.md`.
- `ideas/`: drafts and brainstorming inputs.

### docker/ (Container assets)

**Files placed here**: Dockerfiles, entrypoint scripts (env validation → create dirs → run migrations → start server), and compose helpers. Top-level `docker-compose.yml` and `docker-compose.e2e.yml` orchestrate app, volumes, and (for E2E) test DB + mock email server.

## File Placement Rules

### Source Files

| File type | Location | Naming convention | Example |
|------------|--------|---------|-----|
| Page/route | `app/.../page.tsx`, `route.ts` | Next.js conventions | `app/api/posts/route.ts` |
| Component | `components/<domain>/` | PascalCase | `components/post/PostCard.tsx` |
| Service | `lib/services/` | `*Service.ts` | `lib/services/PostService.ts` |
| Repository | `lib/db/repositories/` | `*Repository.ts` | `lib/db/repositories/PostRepository.ts` |
| Utility (function) | `lib/<area>/` | camelCase | `lib/urls/slug.ts` |
| Migration | `migrations/` | `NNNN_desc.sql` | `migrations/0004_create_posts.sql` |

### Test Files

| Test type | Location | Naming convention | Example |
|-----------|--------|---------|-----|
| Unit test | tests/unit/ | `[target].test.ts` | `PostService.test.ts` |
| Integration test | tests/integration/ | `[feature].test.ts` | `post-create.test.ts` |
| E2E test | tests/e2e/ | `[scenario].spec.ts` | `create-publish.spec.ts` |

### Configuration Files

| File type | Location | Naming convention |
|------------|--------|---------|
| Env/constants | `lib/config/` | `constants.ts`, `env.ts` |
| Tool config | Project root | `[tool].config.{ts,js}` (e.g. `playwright.config.ts`) |
| Type definitions | `lib/types/` or co-located | `[target].ts` / `*.d.ts` |

## Naming Conventions

### Directory Names
- Layer/group directories: plural, kebab-case (`services/`, `repositories/`, `components/`).
- Feature/route directories: kebab-case; dynamic Next.js segments use brackets (`[id]`, `[username]`).

### File Names
- Classes (services, repositories, providers): PascalCase (`PostService.ts`, `UserRepository.ts`).
- Function modules: camelCase (`slug.ts`, `htmlToMarkdown.ts`).
- Constants: UPPER_SNAKE_CASE within files; constant modules camelCase (`constants.ts`).
- React components: PascalCase (`PostCard.tsx`).

### Test File Names
- Unit/integration: `[target].test.ts`. E2E: `[scenario].spec.ts`.

## Dependency Rules

### Dependencies Between Layers

```
UI (app pages, components)
    ↓ (OK)
API (app/api route handlers)
    ↓ (OK)
Service (lib/services)
    ↓ (OK)
Data (lib/db/repositories)
    ↓ (OK)
Infrastructure (connection, storage, email)
```

**Forbidden dependencies**:
- Data layer → Service/UI (❌)
- Service layer → UI/API HTTP types (❌)
- Client components → `lib/db/` or server-only services (❌)
- Any inline SQL outside `lib/db/repositories` (❌)

### Dependencies Between Modules
- No circular dependencies; extract shared types into `lib/types/` when two modules would otherwise import each other.

## Scaling Strategy

### Adding Features
1. **Small**: add to an existing service/repository/component.
2. **Medium**: create a subdirectory within a layer (e.g. split `SocialService` into `social/` with `CommentService.ts`, `ReactionService.ts`).
3. **Large**: introduce a new domain folder across `components/`, `lib/services/`, and `lib/db/repositories/`, plus migrations.

### Managing File Size
- Target ≤ 300 lines per file; 300–500 consider refactoring; ≥ 500 split by responsibility (e.g. CRUD vs. validation vs. notifications).

## Special Directories

### .steering/
Per-task working documents:
```
.steering/
└── [YYYYMMDD]-[task-name]/
    ├── requirements.md
    ├── design.md
    └── tasklist.md
```
Naming: `20250115-add-user-profile`.

### .claude/
```
.claude/
├── commands/   # Slash commands (e.g. add-feature, setup-project)
├── skills/     # Task-mode skills (prd-writing, architecture-design, ...)
└── agents/     # Subagent definitions
```

## Exclusion Settings

### .gitignore
- `node_modules/`, `.next/`, `dist/`
- `.env`, `.env.*` (except `.env.example`)
- `.steering/`
- `uploads/`, `data/` (runtime volumes)
- `coverage/`, `playwright-report/`, `test-results/`
- `*.log`, `.DS_Store`

### .prettierignore / .eslintignore
- `.next/`, `dist/`, `node_modules/`, `coverage/`, `.steering/`, `migrations/` (SQL), `playwright-report/`
