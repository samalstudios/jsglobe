import { JGElement, define, css, html, raw } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { bus } from '../core/bus.js';
import { clamp } from '../core/util.js';
import { icon, drawnIcon } from './icons.js';
import './jg-toolbar.js';

const sheet = css`
  :host {
    position: absolute;
    display: flex;
    flex-direction: column;
    min-width: 320px;
    min-height: 220px;
    border-radius: var(--radius-window, 14px);
    background: var(--background);
    box-shadow: var(--window-shadow);
    overflow: hidden;
    isolation: isolate;
    animation: window-in 0.34s cubic-bezier(0.2, 0.9, 0.25, 1);
    transition: box-shadow 0.25s ease;
    contain: layout paint;
  }
  /* a hairline edge and a sliver of light along the top, drawn over everything */
  :host::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 20;
    border-radius: inherit;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px var(--window-edge), inset 0 1px 0 var(--window-highlight);
  }
  @keyframes window-in {
    from { opacity: 0; transform: scale(0.965) translateY(10px); }
    to { opacity: 1; transform: none; }
  }
  :host([state="minimized"]) { display: none; }
  :host([state="maximized"]),
  :host([fullscreen]) {
    inset: 0 !important;
    width: auto !important;
    height: auto !important;
    border-radius: 0;
    box-shadow: none;
  }
  :host([state="maximized"])::after,
  :host([fullscreen])::after { box-shadow: none; }
  :host([state="maximized"]) {
    position: fixed !important;
    z-index: 90;
  }
  :host(:not([focused])) { box-shadow: var(--window-shadow-rest); }

  .chrome {
    position: relative;
    z-index: 5;
    display: flex;
    flex-direction: column;
    background: var(--titlebar);
    backdrop-filter: saturate(180%) blur(24px);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
    box-shadow: 0 1px 0 var(--titlebar-rule);
    cursor: default;
    user-select: none;
    flex: none;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 52px;
    padding: 0 16px 0 10px;
  }
  :host([fullscreen]) .chrome { cursor: default; }

  .lights { display: flex; gap: 8px; align-items: center; flex: none; }
  .light {
    position: relative;
    width: 12px;
    height: 12px;
    border-radius: 999px;
    border: 0;
    padding: 0;
    cursor: default;
    display: grid;
    place-items: center;
    color: rgba(0, 0, 0, 0.55);
    background: var(--light-color);
    box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.18);
    transition: background 0.15s ease;
  }
  .light::before {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 999px;
  }
  .light svg { width: 8px; height: 8px; opacity: 0; transition: opacity 0.12s ease; }
  .lights:hover .light svg { opacity: 1; }
  .light:active { filter: brightness(0.85); }
  .close { --light-color: #ff5f57; }
  .min { --light-color: #febc2e; }
  .max { --light-color: #28c840; }
  :host(:not([focused])) .lights:not(:hover) .light {
    background: var(--light-idle);
    box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.1);
  }

  .identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .spring { flex: 1; min-width: 8px; }
  .badge {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    flex: none;
    background: linear-gradient(165deg,
      color-mix(in srgb, var(--tint, var(--muted)) 92%, #fff 14%),
      var(--tint, var(--muted)));
    color: #fff;
    box-shadow: var(--shadow-sm);
  }
  .badge svg { width: 17px; height: 17px; --icon-accent: rgba(255, 255, 255, 0.72); }
  .badge[data-drawn] { display: block; width: 26px; height: 26px; border-radius: 22.5%; background: none; box-shadow: none; }
  .badge[data-drawn] svg { display: block; width: 100%; height: 100%; filter: drop-shadow(0 0.5px 1px rgba(0, 0, 0, 0.22)); }
  .names { display: grid; gap: 0; min-width: 0; }
  .title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.005em;
    line-height: 1.3;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 11px;
    line-height: 1.3;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host(:not([focused])) .identity { opacity: 0.6; }
  :host(:not([focused])) .badge svg { filter: grayscale(0.35); }

  .tools {
    display: flex;
    min-width: 0;
    padding: 0 12px 10px;
    overflow: hidden;
  }
  .tools[hidden] { display: none; }
  .tools jg-toolbar { width: 100%; min-width: 0; }

  .action {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex: none;
    border-radius: 8px;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: default;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .action svg { --icon-accent: currentColor; }
  .action:hover { background: var(--accent); color: var(--foreground); }
  .action:focus-visible { box-shadow: var(--shadow-ring); }
  @media (max-width: 720px) {
    .bar { gap: 10px; padding-right: 14px; }
    .sub { display: none; }
  }
  .body {
    flex: 1;
    min-height: 0;
    background: var(--background);
    position: relative;
    overflow: hidden;
  }
  ::slotted(*) { display: block; height: 100%; }
  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--muted-foreground);
    font-size: 12.5px;
    gap: 10px;
  }
  .spinner {
    position: relative;
    width: 22px;
    height: 22px;
    animation: spin 0.9s steps(8) infinite;
  }
  .spinner i {
    position: absolute;
    left: 10px;
    top: 1px;
    width: 2.2px;
    height: 6px;
    border-radius: 2px;
    background: var(--muted-foreground);
    transform-origin: 1.1px 10px;
  }
  @keyframes spin { to { transform: rotate(1turn); } }
  .grip { position: absolute; z-index: 4; }
  .grip.e { top: 0; right: 0; width: 6px; height: 100%; cursor: ew-resize; }
  .grip.s { bottom: 0; left: 0; height: 6px; width: 100%; cursor: ns-resize; }
  .grip.se { bottom: 0; right: 0; width: 16px; height: 16px; cursor: nwse-resize; }
  .grip.w { top: 0; left: 0; width: 6px; height: 100%; cursor: ew-resize; }
  .grip.n { top: 0; left: 0; height: 6px; width: 100%; cursor: ns-resize; }
  :host([state="maximized"]) .grip, :host([fullscreen]) .grip { display: none; }
  @media (max-width: 860px) {
    :host {
      inset: 0 !important;
      width: auto !important;
      height: auto !important;
      border-radius: 0;
      border: 0;
    }
    .grip { display: none; }
  }
`;

// the marks that appear inside the window buttons on hover
const GLYPHS = {
  close: '<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1.6 1.6l4.8 4.8M6.4 1.6 1.6 6.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  min: '<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1.3 4h5.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  max: '<svg viewBox="0 0 8 8" aria-hidden="true"><path d="M1.5 3.9V1.5h2.4ZM6.5 4.1v2.4H4.1Z" fill="currentColor"/></svg>',
};

class JGWindow extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['title-text'];

  #actions = [];

  #restore = null;

  #badge(app) {
    if (!app) return html`<span class="badge"></span>`;
    const drawn = drawnIcon(app, 26);
    return drawn ? html`<span class="badge" data-drawn>${drawn}</span>` : html`<span class="badge">${icon(app.icon, 17)}</span>`;
  }

  get appId() {
    return this.getAttribute('app-id');
  }

  render() {
    const app = registry.find(this.appId);
    this.style.setProperty('--tint', app ? registry.tint(app) : 'var(--muted)');
    this.paint(html`
      <header class="chrome">
        <div class="bar">
          <button class="action menu" title="${t('action.appOptions', 'App options')}" aria-label="${t('action.appOptions', 'App options')}">${icon('more', 16)}</button>
          <div class="identity">
            ${this.#badge(app)}
            <span class="names">
              <span class="title">${this.getAttribute('title-text') ?? app?.name ?? 'App'}</span>
              ${app?.tagline ? html`<span class="sub">${app.tagline}</span>` : ''}
            </span>
          </div>
          <span class="spring"></span>
          <div class="lights">
            <button class="light min" title="${t('action.minimise', 'Minimize')}" aria-label="${t('action.minimise', 'Minimize')}">${raw(GLYPHS.min)}</button>
            <button class="light max" title="${t('action.maximize', 'Maximize')}" aria-label="${t('action.maximize', 'Maximize')}">${raw(GLYPHS.max)}</button>
            <button class="light close" title="${t('action.close', 'Close')}" aria-label="${t('action.close', 'Close')}">${raw(GLYPHS.close)}</button>
          </div>
        </div>
        <div class="tools" id="tools" hidden><jg-toolbar id="app-toolbar" variant="plain"></jg-toolbar></div>
      </header>
      <div class="body">
        <slot></slot>
        <div class="loading"><span class="spinner">${raw(Array.from({ length: 8 }, (unused, index) => `<i style="transform:rotate(${index * 45}deg);opacity:${(0.2 + index * 0.1).toFixed(2)}"></i>`).join(''))}</span><span>Loading ${app?.name ?? 'app'}...</span></div>
      </div>
      <span class="grip n"></span>
      <span class="grip e"></span>
      <span class="grip s"></span>
      <span class="grip w"></span>
      <span class="grip se"></span>
    `);

    this.on(this.$('.close'), 'click', () => this.emit('window:close', { appId: this.appId }));
    this.on(this.$('.min'), 'click', () => this.emit('window:minimize', { appId: this.appId }));
    this.on(this.$('.max'), 'click', () => this.toggleMaximize());
    this.on(this.$('.menu'), 'click', (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      this.emit('window:menu', { appId: this.appId, x: rect.left, y: rect.bottom + 6 });
    });
    this.on(this.$('.chrome'), 'dblclick', (event) => {
      if (event.target.closest('.light')) return;
      this.toggleMaximize();
    });
    this.on(this.$('.chrome'), 'pointerdown', (event) => this.#startDrag(event));
    this.$$('.grip').forEach((grip) => {
      const edges = grip.className.split(' ')[1];
      this.on(grip, 'pointerdown', (event) => this.#startResize(event, edges));
    });
    this.on(this, 'pointerdown', () => this.emit('window:focus', { appId: this.appId }), true);
    // the icon follows the icon style and the theme
    this.track(
      bus.on('settings:change', () => {
        const badge = this.$('.badge');
        if (badge && app) badge.outerHTML = String(this.#badge(app));
      }),
    );
    this.on(this, 'app:actions', (event) => {
      event.stopPropagation();
      this.setActions(event.detail.items);
    });
  }

  get actions() {
    return this.#actions;
  }

  setActions(items) {
    this.#actions = Array.isArray(items) ? items : [];
    const tools = this.$('#tools');
    const toolbar = this.$('#app-toolbar');
    if (!tools || !toolbar) return;
    const list = Array.isArray(items) ? items : [];
    tools.hidden = !list.length;
    toolbar.items = list;
  }

  setActive(id) {
    this.$('#app-toolbar')?.setAttribute('data-value', id ?? '');
    const toolbar = this.$('#app-toolbar');
    if (toolbar) toolbar.value = id ?? null;
  }

  setLoaded() {
    this.$('.loading')?.remove();
  }

  setTitle(text) {
    this.setAttribute('title-text', text);
    const node = this.$('.title');
    if (node) node.textContent = text;
  }

  place({ left, top, width, height }) {
    Object.assign(this.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  }

  toggleMaximize() {
    if (this.getAttribute('state') === 'maximized') {
      this.setAttribute('state', 'normal');
      if (this.#restore) this.place(this.#restore);
      this.emit('window:state', { appId: this.appId, state: 'normal' });
      return;
    }
    this.#restore = {
      left: this.offsetLeft,
      top: this.offsetTop,
      width: this.offsetWidth,
      height: this.offsetHeight,
    };
    this.setAttribute('state', 'maximized');
    this.emit('window:state', { appId: this.appId, state: 'maximized' });
  }

  #bounds() {
    return this.parentElement?.getBoundingClientRect() ?? { width: window.innerWidth, height: window.innerHeight };
  }

  #startDrag(event) {
    if (event.target.closest('.light, .action, .tools') || this.getAttribute('state') === 'maximized') return;
    if (window.matchMedia('(max-width: 860px)').matches) return;
    event.preventDefault();
    this.emit('window:focus', { appId: this.appId });
    const startX = event.clientX;
    const startY = event.clientY;
    const originLeft = this.offsetLeft;
    const originTop = this.offsetTop;
    const bounds = this.#bounds();

    const move = (moveEvent) => {
      const left = clamp(originLeft + moveEvent.clientX - startX, -this.offsetWidth + 90, bounds.width - 90);
      const top = clamp(originTop + moveEvent.clientY - startY, 0, bounds.height - 44);
      this.style.left = `${left}px`;
      this.style.top = `${top}px`;
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      this.emit('window:moved', { appId: this.appId });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  #startResize(event, edge) {
    event.preventDefault();
    event.stopPropagation();
    this.emit('window:focus', { appId: this.appId });
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: this.offsetLeft,
      top: this.offsetTop,
      width: this.offsetWidth,
      height: this.offsetHeight,
    };
    const bounds = this.#bounds();

    const move = (moveEvent) => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      let { left, top, width, height } = start;
      if (edge.includes('e')) width = clamp(start.width + dx, 320, bounds.width - left);
      if (edge.includes('s')) height = clamp(start.height + dy, 220, bounds.height - top);
      if (edge.includes('w')) {
        width = clamp(start.width - dx, 320, start.left + start.width);
        left = start.left + start.width - width;
      }
      if (edge.includes('n')) {
        height = clamp(start.height - dy, 220, start.top + start.height);
        top = start.top + start.height - height;
      }
      this.place({ left, top, width, height });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      this.emit('window:resized', { appId: this.appId });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }
}

define('jg-window', JGWindow);
