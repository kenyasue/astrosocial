/**
 * Global theme: design tokens, base styles, and theme-switching scripts.
 *
 * Implements the dark (default) and light themes from docs/phase1/design-guidelines.md
 * using CSS custom properties: `:root` is dark; `[data-theme="light"]` overrides.
 * The stylesheet is served at `/styles.css`.
 */

export const STYLESHEET = `
:root {
  color-scheme: dark;
  --bg: #0f1115;
  --surface: #161922;
  --surface-2: #1e222c;
  --text: #e8eaed;
  --muted: #9aa0aa;
  --border: #2a2f3a;
  --accent: #8b7cff;
  --accent-hover: #a89bff;
  --accent-contrast: #ffffff;
  --danger: #ff6b6b;
  --ok: #46d39a;
  --radius: 16px;
  --radius-sm: 10px;
  --shadow: 0 14px 40px rgba(0, 0, 0, 0.38);
  --font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica,
    Arial, "Apple Color Emoji", "Segoe UI Emoji", sans-serif;
}

[data-theme="light"] {
  color-scheme: light;
  --bg: #f6f7fb;
  --surface: #ffffff;
  --surface-2: #eef0f5;
  --text: #1a1d23;
  --muted: #5c636e;
  --border: #e3e6ee;
  --accent: #6a4cff;
  --accent-hover: #5a3cf0;
  --accent-contrast: #ffffff;
  --shadow: 0 14px 40px rgba(20, 20, 60, 0.10);
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

/* ---- Three-column app shell --------------------------------------------- */
.app {
  display: grid;
  grid-template-columns: 275px minmax(0, 1000px);
  gap: 28px;
  max-width: 1300px;
  margin: 0 auto;
  align-items: start;
  padding: 0 12px;
}

.rail {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 6px;
}
.rail-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 800;
  font-size: 1.2rem;
  letter-spacing: -0.01em;
  color: var(--text);
  padding: 8px 14px;
}
.rail-brand:hover { text-decoration: none; }
.rail-brand .ic { font-size: 1.4rem; }
.rail-nav { list-style: none; margin: 6px 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.rail-nav a {
  display: flex; align-items: center; gap: 16px;
  padding: 11px 16px; border-radius: 999px;
  color: var(--text); font-size: 1.1rem; font-weight: 600;
}
.rail-nav a:hover { background: var(--surface-2); text-decoration: none; }
.rail-nav .ic { font-size: 1.3rem; width: 1.4em; text-align: center; }
.rail-nav a { position: relative; }
.nav-badge {
  display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 999px; background: var(--accent); color: var(--accent-contrast);
  font-size: 0.7rem; font-weight: 800; margin-left: 4px;
}
.bottom-nav a { position: relative; }
.bottom-nav .nav-badge { position: absolute; top: 0; left: 55%; }
.notif-link { color: var(--text); display: block; }
.notif-link:hover { text-decoration: none; }
.post-btn {
  display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: var(--accent-contrast);
  font-weight: 800; padding: 13px; border-radius: 999px; margin: 12px 8px;
}
.post-btn:hover { background: var(--accent-hover); text-decoration: none; }
.post-btn .pi { display: none; font-size: 1.2rem; }
.theme-toggle-rail { margin: 8px 0 0 12px; }
.rail-logout {
  margin-top: auto; display: flex; align-items: center; gap: 16px;
  padding: 11px 16px; border-radius: 999px; width: 100%;
  background: none; border: 0; cursor: pointer; text-align: left;
  color: var(--text); font-size: 1.1rem; font-weight: 600;
}
.rail-logout:hover { background: var(--surface-2); }
.rail-logout .ic { font-size: 1.3rem; width: 1.4em; text-align: center; }

.column {
  min-height: 100vh;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

.sidebar { position: sticky; top: 0; padding: 12px 0; display: flex; flex-direction: column; gap: 16px; }
.sidebar-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px; }
.sidebar-panel h2 { font-size: 1.15rem; margin: 0 0 10px; }
.sidebar-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.wtf-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.wtf-row { display: flex; align-items: center; gap: 10px; }
.wtf-user { flex: 1; display: flex; flex-direction: column; line-height: 1.2; color: var(--text); }
.wtf-user:hover { text-decoration: none; }
.wtf-name { font-weight: 700; }
.wtf-follow { padding: 6px 14px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; }

.icon-btn {
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.icon-btn:hover { background: var(--border); transform: translateY(-1px); }

.bottom-nav { display: none; }

.container { max-width: 100%; margin: 0 auto; padding: 18px 16px 80px; }

@media (max-width: 1000px) {
  .app { grid-template-columns: 88px minmax(0, 1fr); gap: 0; max-width: 800px; }
  .sidebar { display: none; }
  .rail { align-items: stretch; }
  .rail-brand .label, .rail-nav .label, .rail-logout .label { display: none; }
  .rail-brand, .rail-nav a, .rail-logout { justify-content: center; gap: 0; }
  .post-btn .label { display: none; }
  .post-btn .pi { display: inline; }
}

@media (max-width: 700px) {
  .app { display: block; max-width: 640px; }
  .rail { display: none; }
  .column { border: 0; min-height: auto; }
  .bottom-nav {
    display: flex; position: fixed; left: 0; right: 0; bottom: 0;
    justify-content: space-around; align-items: center;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--border); padding: 8px 0; z-index: 30;
  }
  .bottom-nav a { color: var(--text); font-size: 1.4rem; padding: 6px 14px; }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 26px;
  box-shadow: var(--shadow);
}

h1 { font-size: 1.6rem; margin: 0 0 6px; letter-spacing: -0.02em; }
h2 { font-size: 1.1rem; margin: 0 0 8px; }
p { margin: 8px 0; }

label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  margin: 16px 0 6px;
}

input, textarea {
  width: 100%;
  padding: 12px 14px;
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
input::placeholder, textarea::placeholder { color: var(--muted); }
input:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 32%, transparent);
}
textarea { min-height: 96px; resize: vertical; }

button {
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 12px 20px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: var(--accent);
  color: var(--accent-contrast);
  transition: background 0.15s ease, transform 0.05s ease;
}
button:hover { background: var(--accent-hover); }
button:active { transform: translateY(1px); }
button.ghost { background: transparent; border-color: var(--border); color: var(--text); }
button.ghost:hover { background: var(--surface-2); }
.btn-full { width: 100%; margin-top: 18px; }

.muted { color: var(--muted); }
.error { color: var(--danger); min-height: 1.2em; margin: 6px 0; font-size: 0.9rem; }
.ok { color: var(--ok); min-height: 1.2em; margin: 6px 0; font-size: 0.9rem; }

.stats { color: var(--muted); }
.stats strong { color: var(--text); }

.hero { text-align: center; padding: 8px 0 18px; }
.hero h1 { margin-top: 6px; }
.subtitle { color: var(--muted); margin-top: 2px; }

.profile-meta { margin: 14px 0; }
.profile-meta .at { color: var(--muted); }
.divider { height: 1px; background: var(--border); border: 0; margin: 20px 0; }

/* badges */
.badge {
  display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 2px 9px;
  border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border);
  color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em;
}

/* long-form post content */
.post-byline { color: var(--muted); font-size: 0.9rem; margin: 0 0 14px; }
.post-content { line-height: 1.75; font-size: 1.05rem; }
.post-content > :first-child { margin-top: 0; }
.post-content h1, .post-content h2, .post-content h3,
.post-content h4 { line-height: 1.25; margin: 1.5em 0 0.5em; letter-spacing: -0.01em; }
.post-content p { margin: 1em 0; }
.post-content a { text-decoration: underline; }
.post-content img { max-width: 100%; height: auto; border-radius: 10px; }
.post-content pre {
  background: var(--surface-2); padding: 14px 16px; border-radius: var(--radius-sm);
  overflow: auto; border: 1px solid var(--border);
}
.post-content code {
  background: var(--surface-2); padding: 0.15em 0.4em; border-radius: 6px; font-size: 0.92em;
}
.post-content pre code { background: none; padding: 0; }
.post-content blockquote {
  margin: 1em 0; padding: 0.4em 1em; border-left: 3px solid var(--accent); color: var(--muted);
}
.post-content table { border-collapse: collapse; width: 100%; margin: 1em 0; }
.post-content th, .post-content td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; }
.post-content ul, .post-content ol { padding-left: 1.4em; }

/* card grid (home + profile) */
.card-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px; margin-top: 4px;
}
.post-card {
  display: flex; flex-direction: column; height: 100%; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.post-card:hover { transform: translateY(-2px); border-color: var(--accent); text-decoration: none; }
/* Fixed 4:3 cover, cropped — keeps the image region identical for every card
   regardless of the source photo's orientation. The image is absolutely
   positioned to fill the box so object-fit: cover reliably crops portrait
   photos (a percentage height on the img would not resolve against an
   aspect-ratio-derived box). */
.post-card .cover, .post-card .no-cover {
  aspect-ratio: 4 / 3; flex: 0 0 auto; display: block; position: relative;
  overflow: hidden; background: var(--surface-2);
}
.post-card .cover img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block;
}
.post-card .no-cover { background: linear-gradient(135deg, var(--surface-2), var(--border)); }
.post-card .body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px;
  flex: 1 1 auto; min-height: 0; }
/* Clamp + reserve a fixed line count so every card body is the same height
   (no stretching to the tallest outlier). */
.post-card .card-title { font-weight: 700; font-size: 1.05rem; color: var(--text); line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: calc(1.05rem * 1.3 * 2); }
.post-card .card-meta { color: var(--muted); font-size: 0.82rem; }
.post-card .card-excerpt { color: var(--muted); font-size: 0.92rem; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  min-height: calc(0.92rem * 1.4 * 2); }
/* User directory card: avatar + names row beneath the last-image cover. */
.user-card .user-card-body { flex-direction: row; align-items: center; gap: 10px; }
.user-card .avatar, .user-card .avatar-placeholder {
  width: 40px; height: 40px; flex: 0 0 auto; border-radius: 50%;
  font-size: 1rem; line-height: 40px;
}
.user-card .user-card-names { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
.user-card .card-title { min-height: 0; -webkit-line-clamp: 1; }
.user-card .card-meta { color: var(--accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.feed-empty { text-align: center; color: var(--muted); padding: 40px 0; }
.load-more-row { text-align: center; margin-top: 24px; }
.feed-loading {
  display: inline-flex; align-items: center; gap: 8px;
  color: var(--muted); font-size: 0.9rem;
}
.spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--accent);
  display: inline-block;
}
@media (prefers-reduced-motion: no-preference) {
  .spinner { animation: spin 0.7s linear infinite; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 560px) { .card-grid { grid-template-columns: 1fr; } }

/* social bar + comments */
.social-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 18px;
  padding-top: 16px; border-top: 1px solid var(--border); }
.like-btn { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); }
.like-btn[aria-pressed="true"] { background: var(--accent); color: var(--accent-contrast); border-color: transparent; }
.reactions { display: flex; gap: 6px; flex-wrap: wrap; }
.reaction { background: var(--surface-2); border: 1px solid var(--border); color: var(--text);
  border-radius: 999px; padding: 4px 10px; font-size: 0.9rem; }
.reaction[data-reacted="true"] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, transparent); }
.reaction .rc { color: var(--muted); font-size: 0.8rem; }
.comments { margin-top: 18px; }
.comment-list { list-style: none; padding: 0; margin: 14px 0 0; display: flex; flex-direction: column; gap: 14px; }
.comment { display: flex; gap: 10px; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
.comment .avatar { width: 36px; height: 36px; flex: 0 0 36px; }
.comment-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.comment-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.comment-author { font-weight: 700; font-size: 0.9rem; }
.comment-username { font-size: 0.82rem; }
.comment-body { color: var(--text); }
.comment .comment-del { padding: 3px 8px; font-size: 0.78rem; margin-left: auto; }

/* search + tags */
.search-form { display: flex; gap: 8px; margin-bottom: 18px; }
.search-form input { flex: 1; }
.search-mini input { padding: 10px 14px; width: 100%; border-radius: 999px; }
.search-tabs { border-bottom: 1px solid var(--border); margin-bottom: 16px; gap: 4px; }
.search-tabs a { padding: 10px 14px; color: var(--muted); font-weight: 600; border-bottom: 2px solid transparent; }
.search-tabs a:hover { text-decoration: none; color: var(--text); }
.search-tabs a[aria-selected="true"] { color: var(--text); border-bottom-color: var(--accent); }
.chips { display: flex; gap: 8px; flex-wrap: wrap; }
.bm-filter { width: 100%; margin-bottom: 14px; border-radius: 999px; padding: 10px 14px; }
.bookmark-item { display: flex; flex-direction: column; }
.bookmark-item .unbookmark { align-self: flex-start; margin-top: 8px; padding: 6px 14px; border-radius: 999px; font-size: 0.85rem; }
.post-tags { margin-top: 14px; display: flex; gap: 6px; flex-wrap: wrap; }
.post-tags .badge:hover, .badge:hover { border-color: var(--accent); text-decoration: none; }

/* quoted embed + timeline repost label + notifications */
.quoted-embed { display: block; border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 12px 14px; margin: 14px 0; background: var(--surface-2); color: var(--text); }
.quoted-embed:hover { text-decoration: none; border-color: var(--accent); }
.quoted-embed strong { display: block; }
.quoted-embed.deleted { color: var(--muted); font-style: italic; }
.quote-link { font-weight: 600; color: var(--accent); }
.timeline-item { display: flex; flex-direction: column; height: 100%; }
.repost-label { color: var(--muted); font-size: 0.82rem; margin: 0 0 6px; }
.post-list li.unread { font-weight: 600; }
.post-list li.unread::before { content: "● "; color: var(--accent); }

/* direct messages */
.dm-list { list-style: none; padding: 0; margin: 8px 0 0; }
.dm-list li { border-bottom: 1px solid var(--border); }
.dm-list a { display: block; padding: 14px 4px; color: var(--text); }
.dm-list a:hover { background: var(--surface-2); text-decoration: none; }
.dm-row { display: flex; align-items: center; gap: 8px; }
.dm-name { font-weight: 700; flex: 1; }
.dm-last { display: block; margin-top: 2px; }
.dm-thread { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; min-height: 200px; }
.dm-msg { display: flex; align-items: center; gap: 6px; }
.dm-msg.mine { flex-direction: row-reverse; }
.dm-bubble {
  max-width: 75%; padding: 9px 13px; border-radius: 16px;
  background: var(--surface-2); border: 1px solid var(--border);
}
.dm-msg.mine .dm-bubble { background: var(--accent); color: var(--accent-contrast); border-color: transparent; }
.dm-del { background: none; border: 0; color: var(--muted); cursor: pointer; font-size: 1.1rem; padding: 0 4px; }
.dm-compose { display: flex; gap: 8px; margin-top: 10px; position: sticky; bottom: 0;
  background: var(--bg); padding: 8px 0; }
.dm-compose input { flex: 1; border-radius: 999px; }
select { width: 100%; padding: 12px 14px; background: var(--surface-2); color: var(--text);
  border: 1px solid var(--border); border-radius: var(--radius-sm); font: inherit; }

/* post lists */
.post-list { list-style: none; padding: 0; margin: 8px 0 0; }
.post-list li { padding: 14px 0; border-bottom: 1px solid var(--border); }
.post-list li:last-child { border-bottom: 0; }
.post-list a.title { font-weight: 700; font-size: 1.05rem; }
.post-list .meta { color: var(--muted); font-size: 0.85rem; margin-top: 2px; }

/* cover image + media grid */
.cover-image { width: 100%; max-height: 380px; object-fit: cover; border-radius: var(--radius);
  border: 1px solid var(--border); margin-bottom: 16px; display: block; }
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px; margin-top: 12px; }
.media-grid a { display: block; position: relative; aspect-ratio: 1 / 1; border-radius: var(--radius-sm);
  overflow: hidden; border: 1px solid var(--border); background: var(--surface-2); }
.media-grid img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-field { margin-top: 16px; }
.cover-preview { max-width: 220px; border-radius: var(--radius-sm); border: 1px solid var(--border);
  margin-top: 10px; display: block; }
.media-detail img { max-width: 100%; border-radius: var(--radius); border: 1px solid var(--border); }
.media-meta { color: var(--muted); font-size: 0.9rem; margin-top: 12px; }

/* editor + toolbars */
.editor textarea {
  min-height: 320px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  line-height: 1.5;
}
.toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; align-items: center; }
.toolbar .spacer { flex: 1; }

/* markdown editor toolbar + tabs + media picker */
.md-toolbar { display: flex; gap: 6px; flex-wrap: wrap; margin: 12px 0 6px; }
.md-toolbar button {
  background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 10px; font-size: 0.85rem; font-weight: 600;
}
.md-toolbar button:hover { background: var(--border); }
.tabs { display: flex; gap: 6px; margin-top: 10px; }
.tabs button[aria-selected="true"] { background: var(--accent); color: var(--accent-contrast); border-color: transparent; }
.autosave { color: var(--muted); font-size: 0.8rem; margin-left: 8px; }
.media-picker {
  border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px;
  margin-top: 10px; background: var(--surface-2);
}
.media-picker .media-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); }
#preview { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px 16px;
  margin-top: 6px; min-height: 120px; }

/* compose session-media strip */
.session-media { margin-top: 12px; padding: 12px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); background: var(--surface-2); }
.session-hint { display: block; font-size: 0.8rem; margin-bottom: 8px; }
.session-thumbs { display: flex; gap: 8px; flex-wrap: wrap; }
.session-thumb { padding: 0; border: 1px solid var(--border); border-radius: var(--radius-sm);
  overflow: hidden; width: 72px; height: 72px; background: var(--surface); cursor: pointer; }
.session-thumb:hover { border-color: var(--accent); }
.session-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* avatars */
.avatar { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; display: block;
  border: 1px solid var(--border); background: var(--surface-2); flex: 0 0 auto; }
.avatar-placeholder { display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700; color: var(--accent-contrast); background: var(--accent); border-color: transparent; }

/* public profile header */
.profile-header { margin-bottom: 20px; }
.profile-cover { height: 200px; border-radius: var(--radius); border: 1px solid var(--border);
  background: var(--surface-2) center / cover no-repeat; }
.profile-id { display: flex; align-items: flex-end; gap: 14px; margin: -44px 4px 0; }
.profile-id .avatar { width: 96px; height: 96px; border: 4px solid var(--bg); font-size: 2rem; }
.profile-id-text { padding-bottom: 6px; }
.profile-id-text h1 { margin: 0; line-height: 1.1; }
.profile-id .spacer { flex: 1; }
.at { color: var(--muted); }
.profile-header .stats { margin-top: 12px; color: var(--muted); }
.profile-header .stats strong { color: var(--text); }

/* settings avatar + cover */
.settings-cover { height: 160px; border-radius: var(--radius); border: 1px solid var(--border);
  background: var(--surface-2) center / cover no-repeat; margin-bottom: 8px; }
.settings-avatar-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; }
.settings-avatar-row .avatar { width: 80px; height: 80px; font-size: 1.8rem; }

/* post author card + latest strip */
.author-card { margin-top: 18px; }
.author-card-id { display: flex; align-items: center; gap: 12px; color: var(--text); }
.author-card-id:hover { text-decoration: none; }
.author-card-text { display: flex; flex-direction: column; }
.author-card-bio { color: var(--muted); margin: 10px 0 0; }
.author-card-actions { display: flex; gap: 10px; margin-top: 14px; align-items: center; }
.latest-posts { margin-top: 22px; }
.latest-posts h2 { margin-bottom: 12px; }
.latest-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(200px, 1fr);
  gap: 14px; overflow-x: auto; padding-bottom: 6px; }
@media (max-width: 560px) { .latest-row { grid-auto-columns: minmax(160px, 80%); } }

/* lightbox — immersive full-screen viewer with auto-fading overlay chrome.
   The viewer is an always-dark stage regardless of the page theme, so its
   palette is scoped to .lightbox rather than the global :root tokens. */
.lightbox { position: fixed; inset: 0; z-index: 50; display: flex; align-items: center;
  justify-content: center; overflow: hidden;
  --lbx-stage: #000;
  --lbx-fg: #fff;
  --lbx-fg-dim: rgba(255, 255, 255, 0.7);
  --lbx-fg-soft: rgba(255, 255, 255, 0.85);
  --lbx-chip: rgba(255, 255, 255, 0.15);
  --lbx-chip-border: rgba(255, 255, 255, 0.18);
  --lbx-overlay: rgba(0, 0, 0, 0.45);
  --lbx-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  background: var(--lbx-stage); }
.lightbox[hidden] { display: none; }
.lightbox-img { max-width: 100vw; max-height: 100vh; max-height: 100dvh; object-fit: contain;
  transition: transform 0.15s ease; transform-origin: center; cursor: zoom-in;
  will-change: transform; touch-action: none;
  user-select: none; -webkit-user-select: none; -webkit-user-drag: none; }

/* Single overlay layer holding all controls + caption; fades as one unit.
   It does not capture clicks itself, so image-zoom and backdrop-close keep
   working; interactive descendants re-enable pointer events. */
.lightbox-chrome { position: absolute; inset: 0; pointer-events: none;
  opacity: 1; transition: opacity 0.35s ease; }
.lightbox.is-idle .lightbox-chrome { opacity: 0; }
.lightbox.is-idle { cursor: none; }
.lightbox-chrome a, .lightbox-chrome button, .lightbox-chrome input { pointer-events: auto; }

.lightbox-scrim { position: absolute; top: 0; left: 0; right: 0; height: 140px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0)); pointer-events: none; }

.lightbox-topbar { position: absolute; top: 0; left: 0; right: 0; display: flex;
  align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 18px; }

.lightbox-meta { display: flex; align-items: center; gap: 12px; min-width: 0; max-width: 60%;
  color: var(--lbx-fg); text-decoration: none; }
.lightbox-meta:hover .lightbox-author { text-decoration: underline; }
.lightbox-meta .avatar, .lightbox-meta .avatar-placeholder {
  width: 44px; height: 44px; flex: 0 0 44px; font-size: 1.1rem;
  border: 2px solid var(--lbx-fg-dim); }
.lightbox-meta-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.lightbox-author { color: var(--lbx-fg); font-size: 0.95rem; font-weight: 700;
  text-shadow: var(--lbx-shadow); }
.lightbox-caption { color: var(--lbx-fg-soft); font-size: 0.85rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-shadow: var(--lbx-shadow); }

.lightbox-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.lightbox-close { font-size: 1.8rem; line-height: 1; width: 40px; height: 40px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--lbx-overlay); border: 0; color: var(--lbx-fg); cursor: pointer; border-radius: 50%; }
.lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); font-size: 2.4rem;
  background: none; border: 0; color: var(--lbx-fg); cursor: pointer; padding: 0 16px;
  text-shadow: var(--lbx-shadow); }
.lightbox-prev { left: 8px; }
.lightbox-next { right: 8px; }
.lightbox-zoom { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 10px; }
.lightbox-zoom .ghost { background: var(--lbx-chip); color: var(--lbx-fg); border-color: transparent;
  width: 40px; height: 40px; border-radius: 50%; font-size: 1.2rem; }
.lightbox-hint { position: absolute; bottom: 18px; right: 18px; max-width: 60vw; margin: 0;
  color: var(--lbx-fg-dim); font-size: 0.8rem; text-align: right; pointer-events: none; }
.lightbox-share { display: flex; gap: 8px; align-items: center; max-width: min(50vw, 460px);
  background: var(--lbx-overlay); padding: 6px 8px; border-radius: 999px; }
.lightbox-url { flex: 1; min-width: 0; background: rgba(255, 255, 255, 0.12); color: var(--lbx-fg);
  border: 1px solid var(--lbx-chip-border); border-radius: 999px; padding: 7px 12px;
  font-size: 0.82rem; text-overflow: ellipsis; }
.lightbox-share .ghost { background: var(--lbx-chip); color: var(--lbx-fg); border-color: transparent;
  border-radius: 999px; padding: 7px 14px; font-size: 0.82rem; white-space: nowrap; }
@media (max-width: 560px) {
  .lightbox-hint { display: none; }
  .lightbox-topbar { flex-wrap: wrap; padding: 12px; }
  .lightbox-meta { max-width: calc(100% - 56px); }
  .lightbox-meta .avatar, .lightbox-meta .avatar-placeholder { width: 38px; height: 38px; flex-basis: 38px; }
  .lightbox-share { order: 3; flex-basis: 100%; max-width: none; margin-top: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .lightbox-img { transition: none; }
  .lightbox-chrome { transition: none; }
}

@media (max-width: 560px) {
  .container { padding: 18px 14px 56px; }
  .card { padding: 18px; border-radius: 14px; }
  h1 { font-size: 1.4rem; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}

/* ---- Admin console ---- */
.admin-body { background: var(--bg); }
.admin-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.admin-brand { font-weight: 700; color: var(--text); text-decoration: none; font-size: 1.05rem; }
.admin-nav {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 10px 20px; border-bottom: 1px solid var(--border); background: var(--surface);
}
.admin-nav a {
  padding: 6px 12px; border-radius: 8px; color: var(--muted); text-decoration: none; font-weight: 600;
}
.admin-nav a:hover { background: var(--surface-2); color: var(--text); }
.admin-nav a[aria-current="page"] { background: var(--surface-2); color: var(--accent); }
.admin-logout { margin-left: auto; }
.admin-main { padding: 24px 0 48px; }
.admin-card { max-width: 420px; margin: 0 auto; }
.admin-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
.admin-stat { text-align: center; text-decoration: none; color: var(--text); padding: 22px 16px; }
.admin-stat strong { display: block; font-size: 2rem; color: var(--accent); }
.admin-stat span { color: var(--muted); }
.admin-stat:hover { border-color: var(--accent); }
.admin-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
.admin-table th, .admin-table td {
  text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle;
}
.admin-table th { color: var(--muted); font-weight: 600; background: var(--surface); }
.admin-table tr:last-child td { border-bottom: none; }
.admin-table td a { color: var(--accent); }
.admin-actions { display: flex; gap: 8px; align-items: center; white-space: nowrap; }
.admin-inline { display: inline; }
.admin-form-actions { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
.admin-check { display: flex; align-items: center; gap: 8px; flex-direction: row; }
.admin-check input { width: auto; }
.btn.danger, button.danger { color: var(--danger, #e5484d); border-color: var(--danger, #e5484d); }
button.danger:hover { background: var(--danger, #e5484d); color: #fff; }
.success { color: var(--accent); margin-bottom: 12px; }
@media (max-width: 560px) {
  .admin-nav { padding: 10px 14px; }
  .admin-main .container { padding-bottom: 48px; }
}
`;

/**
 * Applied in <head> before paint to set the saved theme (default dark) so there
 * is no flash of the wrong theme.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('om-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

/** Wires up the header theme-toggle button (icon + persistence). */
export const THEME_TOGGLE_SCRIPT = `
(function () {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  function render() {
    var t = document.documentElement.getAttribute('data-theme');
    btn.textContent = t === 'dark' ? '\\u2600' : '\\u263E';
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  render();
  btn.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('om-theme', next); } catch (e) {}
    render();
  });
})();
`;
