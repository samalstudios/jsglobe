import { JGApp, define, html, css } from '../core/app.js';
import { CANVAS_SIZES, THEMES, FRAMES, GALLERY, makeText, makeShape, newId, icsFor } from '../lib/poster.js';
import { encodeQr } from '../lib/qr.js';
import { createDesigns } from '../lib/designs.js';
import { icon } from '../ui/icons.js';
import { download, toast, pickFile } from '../core/util.js';

const sheet = css`
  .app { padding: 0; gap: 0; container-type: inline-size; overflow: hidden; }
  .head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border); flex: none; }
  .body { flex: 1; min-height: 0; display: flex; }

  .rail {
    width: 172px;
    flex: none;
    border-right: 1px solid var(--border);
    padding: 8px 10px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    --icon-accent: currentColor;
  }
  .rail .group {
    padding: 9px 6px 3px;
    font: 600 10px/1 var(--font-sans);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .tool {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 9px;
    white-space: nowrap;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted-foreground);
    font: 500 12px/1 var(--font-sans);
    text-align: left;
    cursor: pointer;
    width: 100%;
  }
  .tool:hover { background: var(--accent); color: var(--foreground); }
  .tool[aria-pressed="true"] {
    background: color-mix(in srgb, var(--ring) 16%, var(--card));
    border-color: color-mix(in srgb, var(--ring) 55%, transparent);
    color: var(--foreground);
    font-weight: 600;
  }

  jg-dialog { --dialog-width: 960px; }
  #hunt { margin-bottom: 12px; }
  .gallery {
    padding: 2px 2px 8px;
    max-height: min(60vh, 560px);
    overflow: auto;
  }
  .gallery .band { padding: 2px 2px 8px; }
  .gallery .band + .band { padding-top: 16px; }
  .gallery .band h4 {
    margin: 0 0 10px;
    font: 600 10.5px/1 var(--font-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .gallery .band .row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(146px, 1fr));
    gap: 18px 16px;
  }
  .nothing { margin: 4px 2px 8px; font: 500 12.5px/1.5 var(--font-sans); color: var(--muted-foreground); }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    color: var(--muted-foreground);
    font: 500 12px/1.2 var(--font-sans);
  }
  .card canvas {
    display: block;
    border-radius: 5px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-raise);
    transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
  }
  .card:hover canvas { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--ring); }
  .card:hover { color: var(--foreground); }
  .card:focus-visible canvas { outline: 2px solid var(--ring); outline-offset: 3px; }

  .blank {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .blank div {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 26px 30px;
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--card) 88%, transparent);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    text-align: center;
  }
  .blank p { margin: 0; font: 500 13px/1.5 var(--font-sans); color: var(--muted-foreground); max-width: 240px; }

  .stage { position: relative; flex: 1; min-width: 0; background: var(--muted); overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: default; }
  .hint-bar {
    position: absolute;
    left: 12px;
    bottom: 10px;
    right: 12px;
    font-size: 11.5px;
    color: var(--muted-foreground);
    pointer-events: none;
  }

  .side {
    width: 272px;
    flex: none;
    border-left: 1px solid var(--border);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips button {
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    border-radius: 999px;
    padding: 4px 10px;
    font: 500 11.5px/1 var(--font-sans);
    cursor: pointer;
  }
  .chips button:hover { border-color: var(--ring); }
  .chips button[aria-pressed="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 14%, var(--card)); font-weight: 600; }
  .swatches { display: flex; flex-wrap: wrap; gap: 7px; }
  .swatch {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    border: 1px solid var(--border);
    cursor: pointer;
    padding: 0;
    position: relative;
    overflow: hidden;
  }
  .swatch[aria-pressed="true"] { outline: 2px solid var(--ring); outline-offset: 2px; }
  .swatch i { position: absolute; inset: auto 0 0 0; height: 12px; display: block; }
  .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .saved { display: flex; flex-direction: column; gap: 5px; }
  .saved .row { display: flex; align-items: center; gap: 6px; }
  .saved .row button:first-child {
    flex: 1;
    text-align: left;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    border-radius: var(--radius-sm);
    padding: 5px 9px;
    font: 500 11.5px/1.3 var(--font-sans);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .saved .row .drop { flex: none; border: 0; background: transparent; color: var(--muted-foreground); cursor: pointer; padding: 4px; line-height: 0; border-radius: var(--radius-sm); }
  .saved .row .drop:hover { background: var(--accent); color: var(--foreground); }
  .save-row { display: flex; gap: 6px; align-items: center; }
  .save-row jg-input { flex: 1; }

  @container (max-width: 900px) {
    .body { flex-direction: column; }
    .rail { width: auto; flex-direction: row; flex-wrap: wrap; border-right: 0; border-bottom: 1px solid var(--border); }
    .rail .group { width: 100%; }
    .tool { width: auto; }
    .side { width: auto; border-left: 0; border-top: 1px solid var(--border); max-height: 260px; }
  }
`;

const FAMILIES = {
  sans: 'system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

const HANDLE = 9;

const gauge = document.createElement('canvas').getContext('2d');

const wordsOf = (item) => (item.caps ? String(item.value ?? '').toUpperCase() : String(item.value ?? ''));

const fittedSize = (item) => {
  const lines = wordsOf(item).split('\n');
  gauge.font = `${item.weight} ${item.size}px ${FAMILIES[item.family] ?? FAMILIES.sans}`;
  if (gauge.letterSpacing !== undefined) gauge.letterSpacing = `${item.spacing ?? 0}px`;
  const widest = Math.max(...lines.map((line) => gauge.measureText(line).width), 1);
  return widest > item.width ? item.size * (item.width / widest) : item.size;
};

class PosterStudio extends JGApp {
  static appId = 'poster-studio';
  static styles = [...JGApp.styles, sheet];
  static settings = [{ key: 'export', label: 'Export scale', type: 'number', value: 2, min: 1, max: 4 }];

  #size = 'poster';
  #theme = 'ink';
  #frame = 'hairline';
  #items = [];
  #selected = null;
  #drag = null;
  #view = { x: 0, y: 0, zoom: 1 };
  #event = { title: 'Live at the Union', start: '', place: '', notes: '' };
  #designs = null;
  #openName = null;
  #paint = null;

  connectedCallback() {
    this.#designs = createDesigns(this.store, 'poster-studio');
    const open = this.#designs.open();
    const saved = open ? this.#designs.get(open) : null;
    if (saved) {
      this.#restore(saved);
      this.#openName = open;
    } else {
      this.#template('concert');
    }
    super.connectedCallback();
  }

  get #canvasSize() {
    return CANVAS_SIZES[this.#size] ?? CANVAS_SIZES.poster;
  }

  get #palette() {
    return THEMES[this.#theme] ?? THEMES.ink;
  }

  #template(name) {
    const spec = GALLERY[name] ?? GALLERY.plain;
    this.#size = spec.size ?? 'poster';
    this.#theme = spec.theme ?? 'ink';
    this.#frame = spec.frame ?? 'none';
    const { width, height } = this.#canvasSize;
    this.#items = spec.build(width, height);
    this.#selected = null;
    this.#fit();
  }

  #restore(design) {
    this.#size = design.size ?? 'poster';
    this.#theme = design.theme ?? 'ink';
    this.#frame = design.frame ?? 'none';
    this.#items = (design.items ?? []).map((item) => ({ ...item }));
    this.#event = { ...this.#event, ...(design.event ?? {}) };
    this.#selected = null;
    this.#fit();
  }

  #design() {
    return {
      size: this.#size,
      theme: this.#theme,
      frame: this.#frame,
      items: this.#items.map((item) => ({ ...item })),
      event: { ...this.#event },
    };
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">Poster Studio</div>
        <div class="hint">Posters and social variants from a set of templates.</div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head"><jg-toolbar id="bar"></jg-toolbar></div>
      <div class="body">
        <div class="rail" id="rail"></div>
        <div class="stage">
          <canvas id="view"></canvas>
          <div class="blank" id="blank" hidden>
            <div>
              <p>An empty page. Start from one of the designs in the gallery, or add a piece from the left.</p>
              <jg-button size="sm" id="blank-open">Browse the gallery</jg-button>
            </div>
          </div>
          <div class="hint-bar" id="hint">Drag to move, drag a corner to resize, drag the round handle to turn. Double click text to edit it.</div>
        </div>
        <aside class="side" id="side"></aside>
      </div>

      <jg-dialog id="picker" title-text="Gallery" sub="Pick a design to start from. It replaces what is on the page.">
        <jg-input id="hunt" size="sm" placeholder="Search the gallery" autocomplete="off"></jg-input>
        <div class="gallery" id="gallery"></div>
        <p class="nothing" id="nothing" hidden>Nothing matches that.</p>
      </jg-dialog>
    </div>`);

    this.#toolbar();
    this.#rail();
    this.#side();

    this.bind('#blank-open', 'click', () => this.#openPicker());

    const canvas = this.$('#view');
    this.on(canvas, 'pointerdown', (event) => this.#down(event));
    this.on(canvas, 'pointermove', (event) => this.#move(event));
    this.on(canvas, 'pointerup', () => this.#up());
    this.on(canvas, 'dblclick', (event) => this.#edit(event));
    this.on(
      canvas,
      'wheel',
      (event) => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          this.#view.zoom = Math.min(3, Math.max(0.08, this.#view.zoom * Math.exp(-event.deltaY / 260)));
        } else {
          this.#view.x -= event.deltaX;
          this.#view.y -= event.deltaY;
        }
        this.#draw();
      },
      { passive: false },
    );

    this.hotkeys((event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        this.#duplicate();
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        this.#remove();
      }
    });

    const watch = new MutationObserver(() => {
      this.#paint = null;
      this.#draw();
    });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    this.track(() => watch.disconnect());

    const resize = new ResizeObserver(() => this.#fit());
    resize.observe(this.$('.stage'));
    this.track(() => resize.disconnect());

    this.#fit();
  }

  #toolbar() {
    this.$('#bar').items = [
      { id: 'gallery', label: 'Gallery', icon: 'widgets', action: () => this.#openPicker() },
      { separator: true },
      { id: 'fit', label: 'Fit', icon: 'maximize', iconOnly: true, title: 'Fit the poster in view', action: () => this.#fit() },
      { id: 'front', label: 'Bring to front', icon: 'toFront', iconOnly: true, title: 'Bring to front', action: () => this.#lift(true) },
      { id: 'back', label: 'Send to back', icon: 'toBack', iconOnly: true, title: 'Send to back', action: () => this.#lift(false) },
      { id: 'copy', label: 'Duplicate', icon: 'copy', iconOnly: true, title: 'Duplicate the selection', action: () => this.#duplicate() },
      { id: 'delete', label: 'Delete', icon: 'eraser', iconOnly: true, title: 'Delete the selection', action: () => this.#remove() },
      { spacer: true },
      { id: 'variants', label: 'Social sizes', icon: 'grid', iconOnly: true, title: 'Save the square, story and wide versions', action: () => this.#variants() },
      { id: 'svg', label: 'SVG', icon: 'vector', iconOnly: true, title: 'Export as SVG', action: () => this.#exportSvg() },
      { id: 'png', label: 'Export PNG', icon: 'download', action: () => this.#exportPng() },
    ];
  }

  #rail() {
    this.$('#rail').innerHTML = html`
      <div class="group">Add</div>
      <button class="tool" data-add="heading">${icon('type', 15)}<span>Heading</span></button>
      <button class="tool" data-add="body">${icon('alignLeft', 15)}<span>Body text</span></button>
      <button class="tool" data-add="rect">${icon('square', 15)}<span>Rectangle</span></button>
      <button class="tool" data-add="circle">${icon('circle', 15)}<span>Circle</span></button>
      <button class="tool" data-add="line">${icon('minus', 15)}<span>Rule</span></button>
      <button class="tool" data-add="image">${icon('image', 15)}<span>Picture</span></button>
      <button class="tool" data-add="qr">${icon('qr', 15)}<span>Event QR</span></button>
      <div class="group">Canvas</div>
      ${Object.entries(CANVAS_SIZES).map(
        ([key, spec]) => html`<button class="tool" data-size="${key}" aria-pressed="${String(this.#size === key)}">${icon('frame', 15)}<span>${spec.label}</span></button>`,
      )}
    `;


    this.bind('[data-add]', 'click', (event) => this.#add(event.currentTarget.dataset.add));
    this.bind('[data-size]', 'click', (event) => {
      this.#resize(event.currentTarget.dataset.size);
      this.#rail();
      this.#side();
    });
  }

  #openPicker() {
    this.#gallery();
    this.$('#picker')?.open();
  }

  #gallery() {
    const target = this.$('#gallery');
    if (!target || target.dataset.built === 'true') return;
    target.dataset.built = 'true';

    const bands = new Map();
    Object.entries(GALLERY).forEach(([key, spec]) => {
      const group = spec.group ?? 'Other';
      if (!bands.has(group)) bands.set(group, []);
      bands.get(group).push([key, spec]);
    });

    target.innerHTML = [...bands.entries()]
      .map(
        ([group, entries]) => html`<div class="band" data-band="${group}">
          <h4>${group}</h4>
          <div class="row">
            ${entries.map(
              ([key, spec]) => html`<button class="card" data-template="${key}" data-hunt="${this.#hay(key, spec)}" title="${spec.label}">
                <canvas data-thumb="${key}"></canvas><span>${spec.label}</span>
              </button>`,
            )}
          </div>
        </div>`,
      )
      .join('');

    Object.entries(GALLERY).forEach(([key, spec]) => {
      const canvas = target.querySelector(`[data-thumb="${key}"]`);
      if (!canvas) return;
      const paper = CANVAS_SIZES[spec.size] ?? CANVAS_SIZES.poster;
      const wide = 146;
      const scale = wide / paper.width;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${wide}px`;
      canvas.style.height = `${Math.round(paper.height * scale)}px`;
      canvas.width = Math.round(wide * ratio);
      canvas.height = Math.round(paper.height * scale * ratio);
      const context = canvas.getContext('2d');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.#drawPoster(context, scale, {
        size: spec.size,
        theme: spec.theme,
        frame: spec.frame,
        items: spec.build(paper.width, paper.height),
      });
    });

    this.bind('[data-template]', 'click', (event) => {
      this.#template(event.currentTarget.dataset.template);
      this.#openName = null;
      this.$('#picker')?.close();
      this.#rail();
      this.#side();
      this.#draw();
    });

    const hunt = this.$('#hunt');
    if (hunt) this.on(hunt, 'input', () => this.#sift(hunt.value));
  }

  #hay(key, spec) {
    const paper = CANVAS_SIZES[spec.size] ?? CANVAS_SIZES.poster;
    const words = spec
      .build(paper.width, paper.height)
      .filter((item) => item.kind === 'text')
      .map((item) => item.value)
      .join(' ');
    return `${key} ${spec.label} ${spec.group ?? ''} ${spec.keywords ?? ''} ${spec.theme} ${spec.size} ${words}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/"/g, '');
  }

  #sift(term) {
    const target = this.$('#gallery');
    if (!target) return;
    const needle = String(term ?? '').trim().toLowerCase();
    let shown = 0;

    target.querySelectorAll('.band').forEach((band) => {
      let live = 0;
      band.querySelectorAll('[data-template]').forEach((card) => {
        const hit = !needle || card.dataset.hunt.includes(needle);
        card.hidden = !hit;
        if (hit) live += 1;
      });
      band.hidden = live === 0;
      shown += live;
    });

    const nothing = this.$('#nothing');
    if (nothing) nothing.hidden = shown > 0;
  }

  #resize(key) {
    const before = this.#canvasSize;
    this.#size = key;
    const after = this.#canvasSize;
    const scale = Math.min(after.width / before.width, after.height / before.height);
    this.#items.forEach((item) => {
      item.x = after.width / 2 + (item.x - before.width / 2) * scale;
      item.y = after.height / 2 + (item.y - before.height / 2) * scale;
      item.width *= scale;
      if (item.height) item.height *= scale;
      if (item.size) item.size *= scale;
    });
    this.#fit();
  }

  #side() {
    const target = this.$('#side');
    if (!target) return;
    const item = this.#items.find((entry) => entry.id === this.#selected);

    target.innerHTML = html`
      <div class="label">Theme</div>
      <div class="swatches">
        ${Object.entries(THEMES).map(
          ([key, theme]) => html`<button class="swatch" data-theme="${key}" title="${theme.label}" aria-pressed="${String(this.#theme === key)}"
            style="background:${theme.paper}"><i style="background:${theme.accent}"></i></button>`,
        )}
      </div>

      <div class="label">Frame</div>
      <div class="chips">
        ${Object.entries(FRAMES).map(
          ([key, spec]) => html`<button data-frame="${key}" aria-pressed="${String(this.#frame === key)}">${spec.label}</button>`,
        )}
      </div>

      <div class="sep"></div>
      ${item ? this.#itemPanel(item) : html`<div class="hint">Pick something on the poster to change it, or add a piece from the left.</div>`}

      <div class="sep"></div>
      <div class="label">Event</div>
      <jg-field label="Title"><jg-input id="evTitle" size="sm" value="${this.#event.title ?? ''}"></jg-input></jg-field>
      <jg-field label="Starts"><jg-input id="evStart" size="sm" type="datetime-local" value="${this.#event.start ?? ''}"></jg-input></jg-field>
      <jg-field label="Place"><jg-input id="evPlace" size="sm" value="${this.#event.place ?? ''}"></jg-input></jg-field>
      <div class="hint">The event QR carries these so a phone can add it to a calendar.</div>

      <div class="sep"></div>
      <div class="label">Saved</div>
      <div class="save-row">
        <jg-input id="save-name" size="sm" placeholder="Name this poster"></jg-input>
        <jg-button size="sm" variant="outline" id="save">Save</jg-button>
      </div>
      <div class="saved" id="saved"></div>
    `;

    this.bind('[data-theme]', 'click', (event) => {
      this.#theme = event.currentTarget.dataset.theme;
      this.#side();
      this.#draw();
    });
    this.bind('[data-frame]', 'click', (event) => {
      this.#frame = event.currentTarget.dataset.frame;
      this.#side();
      this.#draw();
    });

    ['Title', 'Start', 'Place'].forEach((field) => {
      const input = this.$(`#ev${field}`);
      if (!input) return;
      this.on(input, 'change', () => {
        this.#event[field.toLowerCase()] = input.value;
        this.#refreshQr();
        this.#draw();
      });
    });

    this.bind('#save', 'click', () => this.#saveNamed());
    this.on(this.$('#save-name'), 'keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.#saveNamed();
    });
    this.#nameField();
    this.#savedList();
    this.#wireItemPanel(item);
  }

  #itemPanel(item) {
    if (item.kind === 'text') {
      return html`
        <div class="label">Text</div>
        <jg-field label="Words"><jg-textarea id="itText" rows="3" value="${item.value}"></jg-textarea></jg-field>
        <div class="row2">
          <jg-field label="Size"><jg-input id="itSize" size="sm" type="number" step="2" min="4" value="${Math.round(item.size)}"></jg-input></jg-field>
          <jg-field label="Weight">
            <jg-select id="itWeight" size="sm" value="${String(item.weight)}">
              <option value="400">Regular</option>
              <option value="600">Medium</option>
              <option value="800">Bold</option>
            </jg-select>
          </jg-field>
        </div>
        <div class="row2">
          <jg-field label="Typeface">
            <jg-select id="itFamily" size="sm" value="${item.family}">
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
              <option value="mono">Mono</option>
            </jg-select>
          </jg-field>
          <jg-field label="Align">
            <jg-select id="itAlign" size="sm" value="${item.align}">
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </jg-select>
          </jg-field>
        </div>
        <jg-field label="Colour">
          <jg-select id="itTone" size="sm" value="${item.tone}">
            <option value="ink">Ink</option>
            <option value="accent">Accent</option>
            <option value="muted">Muted</option>
            <option value="paper">Paper</option>
          </jg-select>
        </jg-field>
        <label class="row tight" style="gap:6px">
          <input type="checkbox" id="itCaps" ${item.caps ? 'checked' : ''} /><span class="hint">Capitals</span>
        </label>
      `;
    }

    if (item.kind === 'qr') {
      return html`
        <div class="label">Event QR</div>
        <div class="hint">Built from the event details below. It carries a calendar entry.</div>
        <jg-field label="Size"><jg-input id="itWidth" size="sm" type="number" step="10" min="60" value="${Math.round(item.width)}"></jg-input></jg-field>
      `;
    }

    if (item.kind === 'image') {
      return html`
        <div class="label">Picture</div>
        <jg-field label="Width"><jg-input id="itWidth" size="sm" type="number" step="10" min="20" value="${Math.round(item.width)}"></jg-input></jg-field>
        <jg-button size="sm" variant="outline" id="itReplace">Replace picture</jg-button>
      `;
    }

    return html`
      <div class="label">Shape</div>
      <jg-field label="Colour">
        <jg-select id="itTone" size="sm" value="${item.tone}">
          <option value="accent">Accent</option>
          <option value="ink">Ink</option>
          <option value="muted">Muted</option>
          <option value="paper">Paper</option>
        </jg-select>
      </jg-field>
      <jg-field label="Fade"><jg-slider id="itOpacity" min="5" max="100" step="5" value="${Math.round((item.opacity ?? 1) * 100)}"></jg-slider></jg-field>
      <jg-field label="Corner radius"><jg-input id="itRadius" size="sm" type="number" step="2" min="0" value="${Math.round(item.radius ?? 0)}"></jg-input></jg-field>
    `;
  }

  #wireItemPanel(item) {
    if (!item) return;
    const bind = (id, key, cast = (value) => value) => {
      const field = this.$(`#${id}`);
      if (!field) return;
      const apply = () => {
        item[key] = cast(field.value);
        if (item.kind === 'qr') this.#refreshQr();
        this.#draw();
      };
      this.on(field, 'change', apply);
      if (field.tagName === 'JG-TEXTAREA' || field.tagName === 'JG-SLIDER') this.on(field, 'input', apply);
    };

    bind('itText', 'value');
    bind('itSize', 'size', Number);
    bind('itWeight', 'weight', Number);
    bind('itFamily', 'family');
    bind('itAlign', 'align');
    bind('itTone', 'tone');
    bind('itWidth', 'width', Number);
    bind('itRadius', 'radius', Number);
    const opacity = this.$('#itOpacity');
    if (opacity) {
      this.on(opacity, 'input', () => {
        item.opacity = Number(opacity.value) / 100;
        this.#draw();
      });
    }
    const caps = this.$('#itCaps');
    if (caps) {
      this.on(caps, 'change', () => {
        item.caps = caps.checked;
        this.#draw();
      });
    }
    const replace = this.$('#itReplace');
    if (replace) this.on(replace, 'click', () => this.#pickImage(item));
  }

  async #pickImage(existing) {
    const picked = await pickFile('image/*', false);
    if (!picked) return;
    const bitmap = await createImageBitmap(new Blob([picked.data]));
    const cap = 1400;
    const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const src = canvas.toDataURL('image/jpeg', 0.85);
    bitmap.close?.();

    const { width } = this.#canvasSize;
    const target = existing ?? {
      id: newId(),
      kind: 'image',
      x: this.#canvasSize.width / 2,
      y: this.#canvasSize.height / 2,
      width: width * 0.5,
      height: 0,
      angle: 0,
    };
    target.src = src;
    target.ratio = canvas.height / canvas.width;
    target.height = target.width * target.ratio;
    target.image = null;
    if (!existing) {
      this.#items.push(target);
      this.#selected = target.id;
    }
    this.#side();
    this.#draw();
  }

  #add(kind) {
    const { width, height } = this.#canvasSize;
    if (kind === 'image') return this.#pickImage(null);

    let item = null;
    if (kind === 'heading') {
      item = makeText({ value: 'Headline', x: width / 2, y: height * 0.3, width: width * 0.8, size: height * 0.06, align: 'center', weight: 700 });
    } else if (kind === 'body') {
      item = makeText({ value: 'Some words about the event', x: width / 2, y: height * 0.6, width: width * 0.7, size: height * 0.024, align: 'center', tone: 'muted' });
    } else if (kind === 'rect') {
      item = makeShape({ form: 'rect', x: width / 2, y: height / 2, width: width * 0.5, height: height * 0.12 });
    } else if (kind === 'circle') {
      item = makeShape({ form: 'circle', x: width / 2, y: height / 2, width: width * 0.3, height: width * 0.3 });
    } else if (kind === 'line') {
      item = makeShape({ form: 'rect', x: width / 2, y: height / 2, width: width * 0.5, height: Math.max(3, height * 0.004), tone: 'ink' });
    } else if (kind === 'qr') {
      item = { id: newId(), kind: 'qr', x: width * 0.78, y: height * 0.84, width: width * 0.22, height: width * 0.22, angle: 0 };
    }
    if (!item) return;

    this.#items.push(item);
    this.#selected = item.id;
    if (item.kind === 'qr') this.#refreshQr();
    this.#side();
    this.#draw();
  }

  #refreshQr() {
    const payload = icsFor(this.#event);
    this.#items
      .filter((item) => item.kind === 'qr')
      .forEach((item) => {
        item.payload = payload ?? `${this.#event.title ?? 'Event'}${this.#event.place ? ` at ${this.#event.place}` : ''}`;
        item.grid = null;
      });
  }

  #qrGrid(item) {
    if (item.grid) return item.grid;
    const payload = item.payload ?? icsFor(this.#event) ?? 'Event';
    try {
      item.grid = encodeQr(payload, 'L');
    } catch {
      item.grid = encodeQr('Event', 'L');
    }
    return item.grid;
  }

  #lift(front) {
    const at = this.#items.findIndex((item) => item.id === this.#selected);
    if (at < 0) return;
    const [item] = this.#items.splice(at, 1);
    if (front) this.#items.push(item);
    else this.#items.unshift(item);
    this.#draw();
  }

  #duplicate() {
    const item = this.#items.find((entry) => entry.id === this.#selected);
    if (!item) return;
    const copy = { ...item, id: newId(), x: item.x + 24, y: item.y + 24, grid: null };
    this.#items.push(copy);
    this.#selected = copy.id;
    this.#side();
    this.#draw();
  }

  #remove() {
    if (!this.#selected) return;
    this.#items = this.#items.filter((item) => item.id !== this.#selected);
    this.#selected = null;
    this.#side();
    this.#draw();
  }

  #fit() {
    const stage = this.$('.stage');
    const { width, height } = this.#canvasSize;
    if (!stage || !stage.clientWidth) return;
    const pad = 48;
    this.#view.zoom = Math.min((stage.clientWidth - pad) / width, (stage.clientHeight - pad) / height);
    this.#view.x = (stage.clientWidth - width * this.#view.zoom) / 2;
    this.#view.y = (stage.clientHeight - height * this.#view.zoom) / 2;
    this.#draw();
  }

  #point(event) {
    const rect = this.$('#view').getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - this.#view.x) / this.#view.zoom,
      y: (event.clientY - rect.top - this.#view.y) / this.#view.zoom,
    };
  }

  #boxOf(item) {
    const height = item.kind === 'text' ? this.#textHeight(item) : item.height;
    return { left: item.x - item.width / 2, top: item.y - height / 2, width: item.width, height };
  }

  #textHeight(item) {
    const lines = wordsOf(item).split('\n').length;
    return lines * fittedSize(item) * (item.leading ?? 1.14);
  }

  #localOf(item, point) {
    const cos = Math.cos(-item.angle);
    const sin = Math.sin(-item.angle);
    const dx = point.x - item.x;
    const dy = point.y - item.y;
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  #hit(point) {
    for (let index = this.#items.length - 1; index >= 0; index -= 1) {
      const item = this.#items[index];
      const local = this.#localOf(item, point);
      const height = item.kind === 'text' ? this.#textHeight(item) : item.height;
      if (Math.abs(local.x) <= item.width / 2 && Math.abs(local.y) <= height / 2) return item;
    }
    return null;
  }

  #handleAt(point) {
    const item = this.#items.find((entry) => entry.id === this.#selected);
    if (!item) return null;
    const local = this.#localOf(item, point);
    const height = item.kind === 'text' ? this.#textHeight(item) : item.height;
    const reach = HANDLE / this.#view.zoom;
    if (Math.hypot(local.x, local.y + height / 2 + reach * 3) < reach * 1.6) return { item, kind: 'turn' };
    const corners = [
      { x: -item.width / 2, y: -height / 2 },
      { x: item.width / 2, y: -height / 2 },
      { x: item.width / 2, y: height / 2 },
      { x: -item.width / 2, y: height / 2 },
    ];
    const near = corners.findIndex((corner) => Math.hypot(local.x - corner.x, local.y - corner.y) < reach * 1.4);
    if (near >= 0) return { item, kind: 'size' };
    return null;
  }

  #down(event) {
    const point = this.#point(event);
    this.$('#view').setPointerCapture(event.pointerId);

    const handle = this.#handleAt(point);
    if (handle) {
      this.#drag = {
        kind: handle.kind,
        item: handle.item,
        from: point,
        width: handle.item.width,
        size: handle.item.size,
        angle: handle.item.angle,
        start: Math.atan2(point.y - handle.item.y, point.x - handle.item.x),
      };
      return;
    }

    const item = this.#hit(point);
    if (item) {
      this.#selected = item.id;
      this.#drag = { kind: 'move', item, from: point, origin: { x: item.x, y: item.y } };
      this.#side();
      this.#draw();
      return;
    }

    this.#selected = null;
    this.#drag = { kind: 'pan', from: { x: event.clientX, y: event.clientY }, origin: { ...this.#view } };
    this.#side();
    this.#draw();
  }

  #move(event) {
    if (!this.#drag) return;
    const drag = this.#drag;

    if (drag.kind === 'pan') {
      this.#view.x = drag.origin.x + (event.clientX - drag.from.x);
      this.#view.y = drag.origin.y + (event.clientY - drag.from.y);
      this.#draw();
      return;
    }

    const point = this.#point(event);
    if (drag.kind === 'move') {
      drag.item.x = drag.origin.x + (point.x - drag.from.x);
      drag.item.y = drag.origin.y + (point.y - drag.from.y);
    } else if (drag.kind === 'turn') {
      const now = Math.atan2(point.y - drag.item.y, point.x - drag.item.x);
      drag.item.angle = drag.angle + (now - drag.start);
    } else if (drag.kind === 'size') {
      const local = this.#localOf(drag.item, point);
      const width = Math.max(24, Math.abs(local.x) * 2);
      const ratio = width / drag.width;
      drag.item.width = width;
      if (drag.item.kind === 'text') drag.item.size = Math.max(6, drag.size * ratio);
      else if (drag.item.ratio) drag.item.height = width * drag.item.ratio;
      else drag.item.height = Math.max(3, drag.item.height * ratio);
    }
    this.#draw();
  }

  #up() {
    if (this.#drag && this.#drag.kind !== 'pan') this.#side();
    this.#drag = null;
  }

  #edit(event) {
    const item = this.#hit(this.#point(event));
    if (!item || item.kind !== 'text') return;
    const next = window.prompt('Text', item.value);
    if (next === null) return;
    item.value = next;
    this.#side();
    this.#draw();
  }

  #tone(name, theme = this.#palette) {
    return { ink: theme.ink, accent: theme.accent, muted: theme.muted, paper: theme.paper }[name] ?? theme.ink;
  }

  #scene() {
    return { size: this.#size, theme: this.#theme, frame: this.#frame, items: this.#items };
  }

  #drawPoster(context, scale, scene = this.#scene()) {
    const { width, height } = CANVAS_SIZES[scene.size] ?? CANVAS_SIZES.poster;
    const theme = THEMES[scene.theme] ?? THEMES.ink;

    context.save();
    context.scale(scale, scale);
    context.fillStyle = theme.paper;
    context.fillRect(0, 0, width, height);

    scene.items.forEach((item) => this.#drawItem(context, item, theme));
    this.#drawFrame(context, scene, theme);
    context.restore();
  }

  #drawFrame(context, scene = this.#scene(), theme = this.#palette) {
    const spec = FRAMES[scene.frame];
    if (!spec || scene.frame === 'none') return;
    const { width, height } = CANVAS_SIZES[scene.size] ?? CANVAS_SIZES.poster;
    const inset = spec.inset ?? 30;

    context.save();
    context.strokeStyle = theme.ink;
    context.fillStyle = theme.accent;
    context.lineWidth = spec.width ?? 2;

    if (spec.solid) {
      context.strokeStyle = theme.accent;
      context.lineWidth = spec.width;
      context.strokeRect(spec.width / 2, spec.width / 2, width - spec.width, height - spec.width);
      context.restore();
      return;
    }

    if (spec.corners) {
      const arm = Math.min(width, height) * 0.08;
      const marks = [
        [inset, inset, 1, 1],
        [width - inset, inset, -1, 1],
        [width - inset, height - inset, -1, -1],
        [inset, height - inset, 1, -1],
      ];
      context.beginPath();
      marks.forEach(([x, y, dx, dy]) => {
        context.moveTo(x, y + dy * arm);
        context.lineTo(x, y);
        context.lineTo(x + dx * arm, y);
      });
      context.stroke();
      context.restore();
      return;
    }

    context.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    if (spec.second) {
      const gap = inset + spec.second;
      context.lineWidth = 1;
      context.strokeRect(gap, gap, width - gap * 2, height - gap * 2);
    }
    context.restore();
  }

  #drawItem(context, item, theme = this.#palette) {
    const height = item.kind === 'text' ? this.#textHeight(item) : item.height;
    context.save();
    context.translate(item.x, item.y);
    context.rotate(item.angle ?? 0);
    context.globalAlpha = item.opacity ?? 1;

    if (item.kind === 'text') {
      const words = wordsOf(item);
      const size = fittedSize(item);
      context.fillStyle = this.#tone(item.tone, theme);
      context.font = `${item.weight} ${size}px ${FAMILIES[item.family] ?? FAMILIES.sans}`;
      context.textAlign = item.align === 'left' ? 'left' : item.align === 'right' ? 'right' : 'center';
      context.textBaseline = 'middle';
      if (context.letterSpacing !== undefined) context.letterSpacing = `${item.spacing ?? 0}px`;
      const lines = words.split('\n');
      const step = size * (item.leading ?? 1.14);
      const anchor = item.align === 'left' ? -item.width / 2 : item.align === 'right' ? item.width / 2 : 0;
      lines.forEach((line, index) => {
        context.fillText(line, anchor, (index - (lines.length - 1) / 2) * step);
      });
    } else if (item.kind === 'shape') {
      context.fillStyle = this.#tone(item.tone, theme);
      if (item.form === 'circle') {
        context.beginPath();
        context.ellipse(0, 0, item.width / 2, item.height / 2, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        context.beginPath();
        context.roundRect(-item.width / 2, -item.height / 2, item.width, item.height, item.radius ?? 0);
        context.fill();
      }
    } else if (item.kind === 'image') {
      if (!item.image && item.src) {
        const image = new Image();
        image.onload = () => {
          item.image = image;
          this.#draw();
        };
        image.src = item.src;
        item.image = null;
      }
      if (item.image) context.drawImage(item.image, -item.width / 2, -height / 2, item.width, height);
      else {
        context.strokeStyle = this.#tone('muted', theme);
        context.strokeRect(-item.width / 2, -height / 2, item.width, height);
      }
    } else if (item.kind === 'qr') {
      const grid = this.#qrGrid(item);
      const cells = grid.size;
      const quiet = 2;
      const unit = item.width / (cells + quiet * 2);
      context.fillStyle = theme.paper;
      context.fillRect(-item.width / 2, -item.width / 2, item.width, item.width);
      context.fillStyle = theme.ink;
      for (let y = 0; y < cells; y += 1) {
        for (let x = 0; x < cells; x += 1) {
          if (!grid.modules[y][x]) continue;
          context.fillRect(
            -item.width / 2 + (x + quiet) * unit,
            -item.width / 2 + (y + quiet) * unit,
            unit + 0.5,
            unit + 0.5,
          );
        }
      }
    }
    context.restore();
  }

  #draw() {
    const canvas = this.$('#view');
    if (!canvas) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    if (canvas.width !== width * ratio) canvas.width = width * ratio;
    if (canvas.height !== height * ratio) canvas.height = height * ratio;

    const blank = this.$('#blank');
    if (blank) blank.hidden = this.#items.length > 0;

    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    context.save();
    context.translate(this.#view.x, this.#view.y);
    const { width: pw, height: ph } = this.#canvasSize;
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.22)';
    context.shadowBlur = 24;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, pw * this.#view.zoom, ph * this.#view.zoom);
    context.restore();

    this.#drawPoster(context, this.#view.zoom);

    const item = this.#items.find((entry) => entry.id === this.#selected);
    if (item) {
      const box = this.#boxOf(item);
      context.save();
      context.scale(this.#view.zoom, this.#view.zoom);
      context.translate(item.x, item.y);
      context.rotate(item.angle ?? 0);
      context.strokeStyle = '#8a1c3b';
      context.lineWidth = 1.6 / this.#view.zoom;
      context.setLineDash([6 / this.#view.zoom, 4 / this.#view.zoom]);
      context.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
      context.setLineDash([]);
      const reach = HANDLE / this.#view.zoom;
      [
        [-box.width / 2, -box.height / 2],
        [box.width / 2, -box.height / 2],
        [box.width / 2, box.height / 2],
        [-box.width / 2, box.height / 2],
      ].forEach(([x, y]) => {
        context.fillStyle = '#fff';
        context.fillRect(x - reach / 2, y - reach / 2, reach, reach);
        context.strokeRect(x - reach / 2, y - reach / 2, reach, reach);
      });
      context.beginPath();
      context.arc(0, -box.height / 2 - reach * 3, reach * 0.8, 0, Math.PI * 2);
      context.fillStyle = '#8a1c3b';
      context.fill();
      context.restore();
    }
    context.restore();
  }

  #render(scale, scene = this.#scene()) {
    const { width, height } = CANVAS_SIZES[scene.size] ?? CANVAS_SIZES.poster;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    this.#drawPoster(context, scale, scene);
    return canvas;
  }

  #exportPng() {
    const scale = Math.max(1, Number(this.config.get('export', 2)));
    const canvas = this.#render(scale);
    canvas.toBlob((blob) => {
      if (!blob) return;
      download(`${this.#openName || 'poster'}.png`, blob, 'image/png');
    }, 'image/png');
  }

  #exportSvg() {
    const { width, height } = this.#canvasSize;
    const theme = this.#palette;
    const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts = [`<rect width="${width}" height="${height}" fill="${theme.paper}"/>`];

    this.#items.forEach((item) => {
      const turn = `rotate(${((item.angle ?? 0) * 180) / Math.PI} ${item.x} ${item.y})`;
      if (item.kind === 'text') {
        const words = wordsOf(item);
        const size = fittedSize(item);
        const lines = words.split('\n');
        const step = size * (item.leading ?? 1.14);
        const anchor = item.align === 'left' ? 'start' : item.align === 'right' ? 'end' : 'middle';
        const at = item.align === 'left' ? item.x - item.width / 2 : item.align === 'right' ? item.x + item.width / 2 : item.x;
        const spans = lines
          .map((line, index) => `<tspan x="${at}" y="${item.y + (index - (lines.length - 1) / 2) * step + size * 0.34}">${escape(line)}</tspan>`)
          .join('');
        parts.push(
          `<text transform="${turn}" font-family="${item.family === 'serif' ? 'Georgia, serif' : item.family === 'mono' ? 'monospace' : 'system-ui, sans-serif'}" font-size="${size}" font-weight="${item.weight}" fill="${this.#tone(item.tone)}" text-anchor="${anchor}">${spans}</text>`,
        );
      } else if (item.kind === 'shape') {
        if (item.form === 'circle') {
          parts.push(`<ellipse transform="${turn}" cx="${item.x}" cy="${item.y}" rx="${item.width / 2}" ry="${item.height / 2}" fill="${this.#tone(item.tone)}" opacity="${item.opacity ?? 1}"/>`);
        } else {
          parts.push(`<rect transform="${turn}" x="${item.x - item.width / 2}" y="${item.y - item.height / 2}" width="${item.width}" height="${item.height}" rx="${item.radius ?? 0}" fill="${this.#tone(item.tone)}" opacity="${item.opacity ?? 1}"/>`);
        }
      } else if (item.kind === 'image' && item.src) {
        parts.push(`<image transform="${turn}" x="${item.x - item.width / 2}" y="${item.y - item.height / 2}" width="${item.width}" height="${item.height}" href="${item.src}"/>`);
      } else if (item.kind === 'qr') {
        const grid = this.#qrGrid(item);
        const quiet = 2;
        const unit = item.width / (grid.size + quiet * 2);
        const cells = [];
        for (let y = 0; y < grid.size; y += 1) {
          for (let x = 0; x < grid.size; x += 1) {
            if (!grid.modules[y][x]) continue;
            cells.push(`M${(x + quiet) * unit} ${(y + quiet) * unit}h${unit}v${unit}h${-unit}z`);
          }
        }
        parts.push(
          `<g transform="${turn} translate(${item.x - item.width / 2} ${item.y - item.width / 2})"><rect width="${item.width}" height="${item.width}" fill="${theme.paper}"/><path d="${cells.join('')}" fill="${theme.ink}"/></g>`,
        );
      }
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
    download(`${this.#openName || 'poster'}.svg`, svg, 'image/svg+xml;charset=utf-8');
  }

  #variants() {
    const keep = { size: this.#size, items: this.#items.map((item) => ({ ...item })) };
    const wanted = ['square', 'story', 'wide'];
    const scale = Math.max(1, Number(this.config.get('export', 2)));
    let made = 0;

    wanted.forEach((key) => {
      this.#size = keep.size;
      this.#items = keep.items.map((item) => ({ ...item }));
      this.#resize(key);
      const canvas = this.#render(scale);
      canvas.toBlob((blob) => {
        if (!blob) return;
        download(`${this.#openName || 'poster'}-${key}.png`, blob, 'image/png');
      }, 'image/png');
      made += 1;
    });

    this.#size = keep.size;
    this.#items = keep.items;
    this.#fit();
    this.#rail();
    toast(`Saved ${made} social sizes.`);
  }

  #savedList() {
    const target = this.$('#saved');
    if (!target) return;
    const rows = this.#designs.list();
    if (!rows.length) {
      target.innerHTML = html`<span class="hint">Nothing saved yet.</span>`;
      return;
    }
    target.innerHTML = rows
      .map(
        (row) => html`<div class="row">
          <button data-load="${row.name}" title="${row.name}">${row.name}</button>
          <button class="drop" data-drop="${row.name}" title="Delete ${row.name}">${icon('eraser', 14)}</button>
        </div>`,
      )
      .join('');
    target.querySelectorAll('[data-load]').forEach((node) =>
      node.addEventListener('click', () => {
        const design = this.#designs.get(node.dataset.load);
        if (!design) return;
        this.#restore(design);
        this.#openName = node.dataset.load;
        this.#designs.setOpen(this.#openName);
        this.#rail();
        this.#side();
        this.#draw();
      }),
    );
    target.querySelectorAll('[data-drop]').forEach((node) =>
      node.addEventListener('click', () => {
        this.#designs.remove(node.dataset.drop);
        if (this.#openName === node.dataset.drop) this.#openName = null;
        this.#savedList();
      }),
    );
  }

  #nameField() {
    const field = this.$('#save-name');
    if (field) field.value = this.#openName ?? '';
  }

  #saveNamed() {
    const field = this.$('#save-name');
    const name = (field?.value ?? '').trim();
    if (!name) {
      field?.focus();
      return;
    }
    this.#openName = this.#designs.save(name, this.#design());
    this.#savedList();
  }
}

define('jg-app-poster-studio', PosterStudio);
