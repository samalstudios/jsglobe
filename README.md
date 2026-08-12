# JS Globe

A home screen for small developer tools. Pure JavaScript, custom elements, no framework, no build step.
Every tool is a lazily loaded ES module with its own URL: `jsglobe.com/json-formatter`.

## Running locally

```bash
node scripts/serve.mjs .
```

The dev server serves static files and falls back to `index.html` for unknown paths, which is what the
history-based router needs.

## Deploying with Caddy

`Caddyfile` in the repo root covers the whole setup: HTTPS, compression, cache headers, a content
security policy and the SPA fallback.

```bash
sudo cp -r . /srv/jsglobe
sudo caddy run --config /srv/jsglobe/Caddyfile
```

`_redirects` and `vercel.json` are included for Netlify, Cloudflare Pages and Vercel.

If you deploy under a subdirectory, change `<base href="/">` in `index.html` to that path. The router
reads it and prefixes every link.

## Layout

```
index.html            shell document, sets <base> and loads the module graph
css/theme.css         design tokens (light and dark), toast styles
js/main.js            entry point: theme, router
js/core/              runtime: dom, router, storage, settings, layout, registry, usage, workspaces
js/ui/                shell elements: shell, home, dock, windows, spotlight, library, menus, icons, kit
js/apps/catalog.js    the app store manifest
js/apps/*.js          one file per tool
js/lib/               dependency-free algorithms (md5, qr, holidays)
scripts/serve.mjs     static dev server with SPA fallback
```

### Core concepts

- **Registry** reads `js/apps/catalog.js` and lazily imports a tool the first time it is opened.
- **Router** maps `/:app-id` to a tool, `/apps` to the library, `/search?q=` to spotlight.
- **Workspaces** namespace everything in `localStorage`, so a person or a team can keep separate
  layouts, widgets and per-tool settings. They can be exported and imported as JSON.
- **Layout** owns home screen pages, folders, the dock and widgets.
- **Usage** records how often each tool is opened, which is what fills the dock automatically.

## Adding a tool

Two steps. First write the element in `js/apps/your-tool.js`:

```js
import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .out { font-family: var(--font-mono); }
`;

class WordCount extends JGApp {
  static appId = 'word-count';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Text">
        <jg-textarea id="input" rows="6" placeholder="Paste text"></jg-textarea>
      </jg-field>
      <jg-output id="out"></jg-output>
    </div>`);

    this.on(this.$('#input'), 'input', () => {
      this.$('#out').value = `${this.$('#input').value.trim().split(/\s+/).filter(Boolean).length} words`;
    });
  }

  renderWidget() {
    this.paint(html`<div class="app">…compact view…</div>`);
  }
}

define('jg-app-word-count', WordCount);
```

Then register it in `js/apps/catalog.js`:

```js
{
  id: 'word-count',
  name: 'Word Count',
  tagline: 'Count words, characters and lines',
  category: 'text',
  icon: 'chart',
  glyph: '#',
  tint: '#ec4899',
  keywords: ['words', 'count', 'length'],
  tag: 'jg-app-word-count',
  widget: true,
  load: () => import('./word-count.js'),
  settings: [
    { key: 'live', label: 'Live counting', type: 'switch', default: true },
  ],
}
```

That is all. The tool now appears on the home screen and in the library, is searchable, has the URL
`/word-count`, can be pinned or added as a widget, and its `settings` schema is rendered automatically
in the Settings app.

### What a tool gets

- `this.mode` is `window`, `fullscreen` or `widget`. Implement `renderApp()` and optionally `renderWidget()`.
- `this.config` reads and writes the tool's settings for the active workspace.
- `this.store` persists arbitrary tool state (Notes, Tasks and Calendar use it).
- `this.$`, `this.$$`, `this.on`, `this.bind`, `this.paint`, `this.refresh` for DOM work.
- `this.track(fn)` for cleanup that runs on every re-render, `this.keep(fn)` for cleanup that runs on disconnect.

### UI kit

Compose interfaces from the custom elements in `js/ui/kit.js` rather than raw HTML controls:
`jg-button`, `jg-input`, `jg-textarea`, `jg-select`, `jg-switch`, `jg-slider`, `jg-field`, `jg-card`,
`jg-badge`, `jg-tabs`, `jg-segment`, `jg-output`, `jg-copy`, `jg-empty`.

Layout helpers from `js/ui/styles.js` are already adopted by every tool: `.app`, `.row`, `.stack`,
`.cols`, `.spread`, `.grow`, `.panel`, `.kv`, `.code`, `.label`, `.hint`, `.mono`.

Colours come from tokens only (`--background`, `--foreground`, `--card`, `--border`, `--muted-foreground`,
`--ring`, `--destructive`, `--success`), so tools follow the theme and accent automatically.

### Icons

`js/ui/icons.js` holds a duotone line set drawn on a 24x24 grid. Add a path there and reference it by
name from the catalog. An optional entry in `ACCENTS` is drawn in the secondary colour.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Search every tool |
| `⌘/` / `Ctrl+/` | Open the app library |
| `←` `→` | Move between home screen pages |
| `Esc` | Back to the home screen |

## Privacy

Everything runs in the tab. There is no backend, no analytics and no network calls at runtime; hashing,
encryption, QR generation and parsing all happen locally, and state lives in `localStorage` under the
`jsglobe/v1/` prefix.
