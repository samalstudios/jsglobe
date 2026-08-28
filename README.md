# JS Globe

A home screen for small developer tools. Pure JavaScript, custom elements, no framework, no build step.
Every tool is a lazily loaded ES module with its own URL: `jsglobe.com/apps/json-formatter`, in English,
German, Spanish and Chinese.

<img width="1624" height="1005" alt="demo" src="https://github.com/user-attachments/assets/c88bf003-c513-48a1-8341-cb93cfaebf34" />


## Running locally

```bash
node scripts/serve.mjs .
```

The dev server serves static files and falls back to `index.html` for unknown paths, which is what the
history-based router needs.

## Deploying

Everything is static, so copying the tree onto any web server is the whole job.

```bash
 cp -r . /srv/jsglobe
```

The server needs two things: unknown paths fall back to `index.html`, which the history based router
depends on, and the language prefixes `/de`, `/es` and `/zh` fall back to their own directories.
`vercel.json` is included for Vercel.

If you deploy under a subdirectory, change `<base href="/">` in `index.html` to that path. The router
reads it and prefixes every link.

## Layout

```
index.html            shell document, sets <base> and loads the module graph
css/theme.css         design tokens (light and dark), toast styles
js/main.js            entry point: theme, router
js/core/              runtime: dom, router, storage, settings, layout, registry, usage, workspaces, i18n
js/ui/                shell elements: shell, home, dock, windows, spotlight, library, menus, icons, kit
js/platform.js        the platform library, grouped by domain
js/lib/               the libraries themselves, app agnostic
js/i18n/              interface translations per language
js/apps/<id>/         one folder per tool: index.js, meta.js, styles.css, i18n.js
js/apps/catalog.js    generated from the meta files, do not edit by hand
js/apps/order.json    home screen order
scripts/serve.mjs     static dev server with SPA fallback
scripts/build-catalog.mjs   rebuild the catalog after adding a tool
scripts/build-seo.mjs       prerender every page in every language
scripts/check-seo.mjs       verify the prerendered pages and the sitemap
scripts/check-platform.mjs  verify the library layering
scripts/i18n-build.mjs      rebuild the per app dictionaries
```

### Core concepts

- **Registry** reads `js/apps/catalog.js` and lazily imports a tool the first time it is opened.
- **Router** maps `/:app-id` to a tool, `/apps` to the library, `/search?q=` to spotlight.
- **Workspaces** namespace everything in `localStorage`, so a person or a team can keep separate
  layouts, widgets and per-tool settings. They can be exported and imported as JSON.
- **Layout** owns home screen pages, folders, the dock and widgets.
- **Usage** records how often each tool is opened, which is what fills the dock automatically.

## Adding a tool

A tool is a folder. Nothing outside it needs editing by hand.

```
js/apps/word-count/
  index.js     the element
  meta.js      the catalog entry
  styles.css   the tool's own styles
  i18n.js      its translations
```

`index.js` holds the element:

```js
import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';

const t = appText(strings);
const sheet = await styleSheet(import.meta.url);

class WordCount extends JGApp {
  static appId = 'word-count';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="${t('word-count.text', 'Text')}">
        <jg-textarea id="input" rows="6" placeholder="${t('word-count.paste', 'Paste text')}"></jg-textarea>
      </jg-field>
      <jg-output id="out"></jg-output>
    </div>`);

    this.on(this.$('#input'), 'input', () => {
      const words = this.$('#input').value.trim().split(/\s+/).filter(Boolean).length;
      this.$('#out').value = t('word-count.count', '{n} words', { n: words });
    });
  }

  renderWidget() {
    this.paint(html`<div class="app">…compact view…</div>`);
  }
}

define('jg-app-word-count', WordCount);
```

`meta.js` is the catalog entry, including the translated name and tagline:

```js
export default {
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
  i18n: {
    de: { name: 'Wortzähler', tagline: 'Wörter, Zeichen und Zeilen zählen' },
    es: { name: 'Contador de palabras', tagline: 'Cuenta palabras, caracteres y líneas' },
    zh: { name: '字数统计', tagline: '统计词数、字符数和行数' },
  },
  load: () => import('./index.js'),
};
```

`i18n.js` maps the keys used in `index.js`, one block per language:

```js
export default {
  de: { 'word-count.text': 'Text', 'word-count.paste': 'Text einfügen', 'word-count.count': '{n} Wörter' },
  es: { 'word-count.text': 'Texto', 'word-count.paste': 'Pega el texto', 'word-count.count': '{n} palabras' },
  zh: { 'word-count.text': '文本', 'word-count.paste': '粘贴文本', 'word-count.count': '{n} 个词' },
};
```

Then rebuild the generated files:

```sh
node scripts/build-catalog.mjs
node scripts/build-seo.mjs
```

The tool now appears on the home screen and in the library, is searchable in every language, has the
URL `/apps/word-count` with a prerendered page per language, can be pinned or added as a widget, and
its `settings` schema is rendered automatically in the Settings app.

Keys always carry an English fallback as the second argument to `t()`, so a tool reads correctly before
any translation exists. Use a literal key: `t('word-count.text', 'Text')`, never a template literal,
or `scripts/i18n-build.mjs` cannot see it and will report the key as dropped.

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

`js/lib/glyphs.js` holds a duotone line set drawn on a 24x24 grid as plain data. Add a path there and
reference it by name from `meta.js`. An optional entry in `ACCENTS` is drawn in the secondary colour.
`js/ui/icons.js` wraps the data in the `icon()` renderer for the interface.

## Platform library

`js/lib` holds the algorithms, and `js/platform.js` publishes them grouped by domain. Nothing in
`js/lib` imports from `js/apps` or `js/ui`, so any tool can use any of it:

```js
import { physics, qr, chess } from '../../platform.js';

const world = physics.createWorld();
```

Import a single domain directly when that is all a tool needs, which keeps the download smaller:

```js
import { createWorld } from '../../lib/physics.js';
```

| Domain | What it offers |
| --- | --- |
| `physics` | Rigid bodies, pins, rods, springs, jacks, motors, gears, collisions |
| `logic` | Gates, flip flops, counters, decoders, multiplexers over a net list |
| `circuit` | Modified nodal analysis with diodes, transistors and time stepping |
| `clip` | Polygon union, subtract and intersect |
| `svgShapes` | Read an SVG into simplified outlines |
| `glyphs` | The drawn icon outlines as data |
| `iconParts` | Thousands of generated icon parts, searchable and grouped |
| `iconCompose` | Turn words into a stack of icon parts |
| `poster` | Poster canvases, themes, frames, gallery |
| `palette` | Colour scales, harmonies and contrast |
| `molecule3d` | Draw molecules in 3D on a canvas |
| `qr` | QR codes and barcodes as matrices |
| `md5`, `sshKeys` | Digests and OpenSSH keys |
| `chess`, `chessAi`, `chessOpenings` | Rules, search and opening theory |
| `elements`, `molecules`, `holidays` | Reference data |
| `composeK8s` | Compose files to Kubernetes manifests |
| `designs` | Named document storage per tool, with import and export |

`node scripts/check-platform.mjs` verifies the layering: no library reaching upwards, every library
published, every domain described.

## Languages

The site runs in English, German, Spanish and Chinese. The language is part of the path: English stays
at `/`, the others take a prefix.

```
/apps/json-formatter        English
/de/apps/json-formatter     German
/es/apps/json-formatter     Spanish
/zh/apps/json-formatter     Chinese
```

The router reads the prefix, strips it from the route and puts it back on every link it builds, so
navigation stays inside the language. The picker in the title bar switches without a reload.

- `js/core/languages.js` lists the languages. Adding one means a line here, a dictionary in `js/i18n`,
  a fallback rule on the server for the new prefix, and a rerun of `build-seo.mjs`.
- `js/i18n/<lang>.js` translates the shell, the categories and the prerendered page copy.
- `js/apps/<id>/i18n.js` translates that tool, loaded with the tool rather than up front.
- `js/apps/<id>/meta.js` carries the translated name and tagline, which is what the home screen,
  library, spotlight, window titles and search all read.

`scripts/build-seo.mjs` prerenders every page in every language with translated titles, descriptions
and crawlable body, reciprocal `hreflang` alternates plus `x-default`, per language `og:locale` and
`html lang`, and one sitemap carrying every alternate. `scripts/check-seo.mjs` verifies all of it.

`scripts/i18n-build.mjs` rebuilds the per tool dictionaries from `js/i18n/glossary.json`, keeping any
translation already written. It reports keys it cannot see as literal `t()` calls, which are about to
be dropped.

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
copy `ffmpeg-core.js` and `ffmpeg-core.wasm` into `assets/ffmpeg/` and point both fields there, and
allow same-origin WebAssembly and blob workers in the policy the server sends.

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
