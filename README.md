# JS Globe

A home screen for small developer tools. Pure JavaScript, custom elements, no framework, no build step.
Every tool is a lazily loaded ES module with its own URL: `jsglobe.com/json-formatter`.

<img width="1624" height="1005" alt="demo" src="https://github.com/user-attachments/assets/c88bf003-c513-48a1-8341-cb93cfaebf34" />


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
 cp -r . /srv/jsglobe
 caddy run --config /srv/jsglobe/Caddyfile
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

## Local AI

Four tools (AI Chat, AI Code, AI Writer, AI Regex) run against a model you control. Settings > Local AI
offers two backends:

- **WebLLM in browser** downloads a quantised model once and runs it on the GPU through WebGPU. Needs
  Chrome or Edge 121+. The runtime URL is configurable, so you can self-host WebLLM instead of using a CDN.
- **Local server** speaks the OpenAI chat completions API, which covers Ollama (`http://localhost:11434/v1`)
  and LM Studio (`http://localhost:1234/v1`).

Prompts never leave the machine in either mode. AI is off by default, so nothing is downloaded until you
turn it on.

## Media conversion

- **Image Converter** uses canvas only. Convert between PNG, JPEG and WebP, resize, compress and batch
  process with no download at all.
- **Video & Audio** transcodes through an FFmpeg WebAssembly build: MP4, WebM, animated GIF, MP3, WAV,
  OGG, Opus and FLAC, plus trimming, scaling and audio extraction.

The FFmpeg module and core URLs are set in Settings > Media engine. For a deployment with a strict CSP,
copy `ffmpeg-core.js` and `ffmpeg-core.wasm` into `assets/ffmpeg/` and point both fields there; the
supplied `Caddyfile` already allows same-origin WebAssembly, blob workers and the default CDNs.

## Keyboard

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Search every tool |
| `⌘/` / `Ctrl+/` | Open the app library |
| `←` `→` | Move between home screen pages |
| `Esc` | Back to the home screen |

## Search and analytics

`scripts/build-seo.mjs` reads the catalogue and writes a prerendered `index.html` for every tool, plus
`apps/index.html`, `sitemap.xml` and `robots.txt`:

```bash
node scripts/build-seo.mjs
```

Each generated page carries its own title, description, canonical URL, Open Graph and Twitter tags,
`SoftwareApplication` structured data, and a `<noscript>` block with a heading, summary and links to
related tools so crawlers see real content without executing the app. Re-running the script is safe: the
generated head is fenced with `seo:start` markers and replaced in place. Set `SITE_URL` to build for a
different domain.

Google Analytics (`G-J7L8GPFG3Z`) is loaded from `js/core/analytics.js` rather than an inline snippet, so
the strict CSP holds. Automatic page views are turned off and one `page_view` is sent per route change,
which is what an SPA needs.

## Privacy

Tool data stays in the tab. There is no backend and no account; hashing, encryption, QR generation,
parsing and the local AI all happen on the device, and state lives in `localStorage` under the
`jsglobe/v1/` prefix.

Three things do reach the network, all of them visible and switchable:

- **Analytics** records which tool pages are opened, never their contents. It honours Do Not Track and
  can be turned off in Settings > Data.
- **Opt-in tools** call the endpoint you choose: DNS Lookup, Speed Test, the portfolio price providers,
  and the first download of a WebLLM, Whisper or FFmpeg runtime.
- Everything else stays local.
