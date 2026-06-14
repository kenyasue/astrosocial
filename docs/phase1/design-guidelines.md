# Design Guidelines

These are the **mandatory** UI/UX rules for AstroSocial. Every screen and component —
in every milestone — must follow them. They complement `docs/development-guidelines.md`
(code) and `docs/functional-design.md` (behavior).

## Design principles

1. **Clean & simple** — generous whitespace, one clear primary action per screen, no
   visual clutter. Prefer removing elements over adding them.
2. **User-friendly** — obvious affordances, readable typography, helpful empty/error
   states, accessible labels. A first-time visitor should never feel lost.
3. **Modern** — soft rounded corners, subtle shadows/blur, smooth (but restrained)
   motion, a single accent color used purposefully.
4. **Consistent** — use the shared design tokens (below). Never hard-code colors,
   spacing, or radii in components; reference CSS variables.

## Theming (required)

AstroSocial ships **two themes**: a **dark theme** and a **light theme**.

- **The default theme is DARK.** When a user has no saved preference, render dark.
- Users can switch themes with a visible toggle in the site header; the choice is
  persisted (e.g. `localStorage` key `om-theme`) and applied before first paint to
  avoid a flash.
- Themes are implemented purely with CSS custom properties on
  `:root` (dark, default) and `[data-theme="light"]` (light overrides). Components
  must work in both themes automatically by using tokens — no theme-specific markup.
- Respect `color-scheme` so native controls match the theme.

### Design tokens

Defined once in the global stylesheet and consumed everywhere. Dark is the default
set on `:root`; light overrides under `[data-theme="light"]`.

| Token | Purpose |
|---|---|
| `--bg` | Page background |
| `--surface`, `--surface-2` | Card / input surfaces |
| `--text`, `--muted` | Primary and secondary text |
| `--border` | Hairline borders |
| `--accent`, `--accent-hover`, `--accent-contrast` | Primary brand/action color |
| `--danger`, `--ok` | Error and success states |
| `--radius`, `--radius-sm` | Corner radii |
| `--shadow` | Elevation |
| `--logo-fur`, `--logo-pink`, `--logo-eye`, `--logo-mouth`, `--logo-whisker` | Cat logo colors |
| `--font` | Font stack (system UI fonts) |

> Add new tokens rather than introducing raw values. If a value appears in two
> components, it should be a token.

## App shell (layout)

The app uses a **three-column shell** rendered by the shared `layout()`:

- **Left navigation rail** — brand, primary nav (Home, Explore, Search,
  Notifications, Bookmarks, Timeline), a prominent **Post** button, and the theme
  toggle. Sticky full-height on desktop.
- **Center column** — the page content, max width ~600px, with hairline borders.
- **Right sidebar** — a search box and a small discovery/about panel. Sticky.

Responsive behavior (single codebase):
- **≤ 1000px**: hide the right sidebar; collapse the rail to icon-only.
- **≤ 700px**: hide the rail; show a fixed **bottom tab bar**; column is full-width.

The shell is stateless (no per-viewer data); the Post button links to `/compose`
(which redirects to login when needed). Use the shell for all pages — never render a
page outside it.

## Responsive (required)

**One codebase serves desktop and mobile** — no separate mobile site, no UA sniffing.

- Always include `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Layout is fluid: a centered container with a max width on desktop and full-width,
  comfortably-padded content on small screens.
- Use CSS (flex/grid + media queries / fluid units) to adapt. Breakpoint guidance:
  treat ≤ 560px as the mobile layout.
- Tap targets ≥ 40px; inputs and primary buttons are full-width on mobile.
- Test both layouts (the Playwright suite should include a mobile viewport check as
  screens grow).

## Accessibility

- Sufficient contrast in **both** themes (WCAG AA for text).
- Every input has an associated `<label>`; icon-only buttons have `aria-label`.
- Visible focus states (focus ring using the accent color).
- Honor `prefers-reduced-motion` — disable non-essential animation.
- Use semantic elements and roles so assistive tech and Playwright role selectors work.

## Branding

- The brand is currently a clean **text wordmark** ("AstroSocial") in the site header —
  no icon/mascot logo. Keep it simple and confident.
- If a logo is introduced later, it must follow the theming rules (adapt to both
  themes via tokens) and the minimal, modern aesthetic.

## Motion

- Subtle and purposeful only: gentle hover transitions, a soft entrance for the hero.
- Nothing that blocks interaction or distracts from reading. Always gate decorative
  motion behind `@media (prefers-reduced-motion: no-preference)`.

## Implementation notes for this codebase

- Global styles live in `src/lib/views/theme.ts` (served at `/styles.css`).
- The cat logo lives in `src/lib/views/logo.ts`.
- The shared page shell (header with logo + theme toggle, container, theme-init
  script) lives in `src/lib/views/pages.ts`.
- When the web layer migrates to Next.js, port these tokens and the theme/logo into
  the component library unchanged — the tokens and principles are framework-agnostic.

## Checklist (apply to every UI change)

- [ ] Works in both dark (default) and light themes via tokens — no hard-coded colors
- [ ] Responsive: verified at desktop and ≤ 560px widths from a single codebase
- [ ] Clean, simple, modern; one clear primary action
- [ ] Accessible: labels, focus states, contrast, reduced-motion respected
- [ ] Uses the shared shell (header logo + theme toggle) where appropriate
