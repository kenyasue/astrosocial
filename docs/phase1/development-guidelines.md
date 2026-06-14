# Development Guidelines

These guidelines define the coding conventions and development process for AstroSocial. They build on the technology stack in `docs/architecture.md` and the layout in `docs/repository-structure.md`. The non-negotiable rules — no ORM, parameterized SQL only, sanitize all rendered/imported content — come straight from the security requirements and must be followed exactly.

## Coding Conventions

### Naming Conventions

#### Variables and Functions

```typescript
// ✅ Good
const publishedPosts = await postRepository.listPublished(cursor);
function generateCanonicalPath(username: string, slug: string): string { }

// ❌ Bad
const data = get();
function gen(a: string, b: string): string { }
```

**Principles**:
- Variables: camelCase, noun phrase.
- Functions: camelCase, start with a verb (`create`, `verify`, `generate`, `sanitize`).
- Constants: UPPER_SNAKE_CASE (`PIN_TTL_MINUTES`, `MAX_UPLOAD_BYTES`).
- Booleans: start with `is`/`has`/`should`/`can` (`isPublished`, `hasCoverImage`).

#### Classes, Interfaces, Types

```typescript
class PostService { }            // service: PascalCase + "Service"
class PostRepository { }          // repository: PascalCase + "Repository"
interface Post { }                // entity interfaces: PascalCase, no "I" prefix
type PostStatus = 'draft' | 'published' | 'archived';
type DmPolicy = 'everyone' | 'following' | 'mutual' | 'nobody';
```

### Code Formatting

- **Indentation**: 2 spaces.
- **Line length**: 100 characters max.
- **Formatter/linter**: Prettier + ESLint; run before every commit. No warnings on `main`.
- **Strict TypeScript**: `strict` mode on; avoid `any` (use `unknown` + narrowing). No non-null `!` without justification.

```typescript
const post = await postService.getByCanonicalPath(path);
if (!post) {
  return notFound();
}
```

### Comment Conventions

```typescript
/**
 * Generate a unique, URL-safe slug for a post within a user's namespace.
 *
 * @param title - The post title, or null for untitled posts
 * @param publicId - The post public id, used as a fallback/suffix
 * @param exists - Predicate returning true if a candidate slug already exists for the user
 * @returns A slug guaranteed unique per user
 */
function generateSlug(title: string | null, publicId: string, exists: (s: string) => boolean): string { }
```

```typescript
// ✅ explain WHY
// FTS5 needs the body re-indexed only when markdown_body changes, not on every metadata update.
if (bodyChanged) reindex(post);

// ❌ restating the code
// reindex the post
reindex(post);
```

### Error Handling

**Principles**:
- Define typed error classes for expected failures; let unexpected errors propagate.
- Never swallow errors silently. API handlers map errors to the standard envelope.

```typescript
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
class NotFoundError extends Error { name = 'NotFoundError'; }
class PermissionError extends Error { name = 'PermissionError'; }
class RateLimitError extends Error { name = 'RateLimitError'; }
```

API route handlers translate these to HTTP: `ValidationError`→400, auth missing→401, `PermissionError`→403, `NotFoundError`→404, `RateLimitError`→429, otherwise 500. Never leak stack traces or SQL to clients.

### Security Rules (mandatory)

These are enforced in code review and must never be bypassed:

1. **No ORM.** Every table is accessed through its repository class in `lib/db/repositories/`. No SQL anywhere else.
2. **Parameterized SQL only.** Never interpolate user input into SQL strings.
   ```typescript
   // ❌ FORBIDDEN
   db.prepare(`SELECT * FROM users WHERE email = '${email}'`);
   // ✅ Required
   db.prepare('SELECT * FROM users WHERE email = ?').get(email);
   db.prepare('SELECT * FROM users WHERE email = @email').get({ email });
   ```
   Dynamic sort/order fields must use an allowlist, never raw input.
3. **Sanitize all rendered Markdown and imported WordPress HTML** (strip `script`, event-handler attributes, `javascript:` URLs, unsafe iframes/styles). External links get `rel="noopener noreferrer"`.
4. **Auth**: hash PINs and session tokens; HttpOnly + Secure + SameSite cookies; rate-limit PIN request/verify; cap failed attempts.
5. **Uploads**: validate MIME + extension + size; randomize stored file names; never execute from the upload dir; prevent path traversal; re-encode images.
6. **WordPress import**: disable XML external entities (XXE); validate/allowlist download URLs; block localhost/private IPs (SSRF); limit redirects/size; use timeouts.

### UI & Design Rules (mandatory)

All user-facing UI must follow `docs/design-guidelines.md`. In short:

- **Dark theme is the default**; a light theme is also provided, switchable via a
  persisted header toggle. Implement themes with CSS variables (`:root` = dark,
  `[data-theme="light"]` overrides) — never hard-code colors.
- **Responsive single codebase**: one implementation serves desktop and mobile
  (fluid container + media queries; mobile ≤ 560px). Always include the viewport meta.
- **Clean, simple, modern, user-friendly**, and accessible (labels, focus states,
  contrast in both themes, `prefers-reduced-motion`).
- Use the shared design tokens and the shared page shell (header logo + theme toggle).

### Performance Rules

- List/feed queries select card columns only — never `markdown_body` in lists.
- Use cursor-based pagination; serve thumbnails in cards.
- Rely on the indexes defined in `docs/architecture.md`; add an index (via a migration) when introducing a new hot query.
- SQLite connection uses WAL mode and `busy_timeout`.

## Git Workflow Rules

### Branching Strategy

- `main`: always releasable.
- `develop`: latest integrated development state.
- `feature/[name]`: new features (e.g. `feature/wordpress-import`).
- `fix/[desc]`: bug fixes.
- `refactor/[target]`: refactoring.

```
main
  └─ develop
      ├─ feature/post-editor
      ├─ feature/wordpress-import
      └─ fix/slug-collision
```

Never commit directly to `main`. Branch first, PR into `develop`, release `develop`→`main`.

### Commit Message Conventions (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

**Example**:
```
feat(import): add WordPress XML preview endpoint

Parse the export XML with external entities disabled and return counts
of users, posts, media, and comments plus estimated download size.
- Add parseXml with XXE protection
- Add ImportRepository.createJob
- Add /api/import/wordpress/xml/preview handler

Closes #42
```

### Pull Request Process

**Before opening**:
- [ ] `npm test` passes
- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] Relevant E2E specs added/updated and passing (`npx playwright test`)
- [ ] Conflicts resolved

**PR template**:
```markdown
## Overview
[Brief description]

## Reason for Change
[Why]

## Changes
- [change 1]

## Testing
- [ ] Unit tests added
- [ ] E2E tests added/updated
- [ ] Manual check performed

## Security checklist
- [ ] All new SQL is parameterized and lives in a repository
- [ ] Any rendered/imported content is sanitized
- [ ] Permission/ownership checks in place

## Related Issue
Closes #[n]
```

**Review flow**: self-review → automated tests → assign reviewer → address feedback → merge after approval.

## Test Strategy

Follow the test pyramid: many unit tests, focused integration tests, a critical-path E2E suite.

### Unit Tests

**Target**: repositories, services, URL/slug generation, markdown render/sanitize, auth/PIN/session, WordPress conversion, trend score, validation.

**Coverage target**: ≥ 80% on `lib/`; 100% on security-sensitive utilities (sanitize, SQL builders/allowlists, PIN/session).

```typescript
describe('generateSlug', () => {
  it('generateSlug_titleWithSpaces_returnsKebabCase', () => {
    expect(generateSlug('AstroSocial Design Notes', 'p_8f3a', () => false))
      .toBe('openmeow-design-notes');
  });

  it('generateSlug_collision_appendsSuffix', () => {
    const taken = new Set(['openmeow-design']);
    expect(generateSlug('AstroSocial Design', 'p_8f3a', s => taken.has(s)))
      .toBe('openmeow-design-2');
  });

  it('generateSlug_noTitle_usesPublicId', () => {
    expect(generateSlug(null, 'p_8f3a', () => false)).toBe('p_8f3a');
  });
});
```

### Integration Tests

**Target**: service + repository against a temporary SQLite DB (migrations applied to a temp file or in-memory).

```typescript
describe('Post lifecycle', () => {
  it('createDraft_thenPublish_setsCanonicalPathAndPublishedAt', async () => {
    const post = await postService.create(userId, { title: 'Hi', markdownBody: '...' });
    expect(post.status).toBe('draft');
    const published = await postService.publish(userId, post.id);
    expect(published.status).toBe('published');
    expect(published.canonicalPath).toMatch(/^\/@/);
    expect(published.publishedAt).not.toBeNull();
  });
});
```

### E2E Tests (Playwright)

**Target**: full user scenarios in the Dockerized E2E environment (app + test DB + migrations + mock email server).

```typescript
test('user logs in via email PIN and publishes a post', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('ken@example.com');
  await page.getByRole('button', { name: 'Send PIN' }).click();
  const pin = await mockEmail.lastPin('ken@example.com');
  await page.getByLabel('PIN').fill(pin);
  await page.getByRole('button', { name: 'Verify' }).click();
  // create + publish ...
  await expect(page).toHaveURL(/\/@ken\/posts\//);
});
```

Required E2E coverage: auth, post creation (+ media + unique URL), social interactions, DM, WordPress import (including idempotent re-import), responsive + PWA.

### Test Naming Conventions

Pattern: `[target]_[condition]_[expectedResult]`.

```typescript
it('verifyPin_expiredPin_throwsValidationError', () => {});
it('upload_oversizedFile_rejectsWith400', () => {});
it('reactToPost_sameEmojiTwice_isNoOp', () => {});
```

### Mocks and Stubs

- Mock external dependencies: email provider, filesystem/storage where appropriate, network downloads in import tests.
- Use real repositories against a temp SQLite DB for integration coverage (don't mock SQL).

```typescript
const mockEmail: EmailProvider = { send: vi.fn() };
const auth = new AuthService(loginPinRepo, sessionRepo, userRepo, mockEmail);
```

## Code Review Criteria

**Functionality**: meets requirements; edge cases covered; error handling correct.
**Readability**: clear naming; comments explain *why*; complex logic documented.
**Maintainability**: no duplication; single responsibility; change scope limited; file ≤ ~300 lines.
**Performance**: no N+1 queries; list queries avoid full bodies; indexes used.
**Security (blocking)**: SQL parameterized and inside repositories; content sanitized; permission/ownership checks; no secrets hardcoded; upload/import hardening present.

### Review Comment Style

```markdown
✅ "This list query selects markdown_body, which we avoid in feeds for performance.
   Could we select only card columns and load the body on the detail route?"
❌ "This is wrong."
```

Priority tags: `[required]`, `[recommended]`, `[suggestion]`, `[question]`.

## Development Environment Setup

### Required Tools

| Tool | Version | Installation |
|--------|-----------|-----------------|
| Node.js | v24.11.0 | via devcontainer / nvm |
| npm | 11.x | bundled with Node |
| Docker + Compose | latest | Docker Desktop / engine |
| Playwright browsers | latest | `npx playwright install --with-deps` |

### Setup Procedure

```bash
# 1. Clone
git clone <URL>
cd openmeow

# 2. Install dependencies
npm install

# 3. Environment
cp .env.example .env   # set SMTP creds, app secret, etc.

# 4. Run (dev)
npm run dev            # migrations run on startup

# Or full self-host
docker compose up      # builds, migrates, serves on :3000
```

### Quality Gates (must pass before merge)

```bash
npm test               # unit + integration
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npx playwright test    # E2E (CI runs in docker-compose.e2e.yml)
```

### Recommended Tools
- VS Code with ESLint + Prettier extensions.
- A SQLite viewer for inspecting `data/openmeow.db` during development.
