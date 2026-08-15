import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { clamp } from '../core/util.js';
import { icon } from './icons.js';
import './jg-toolbar.js';

const sheet = css`
  :host {
    position: absolute;
    display: flex;
    flex-direction: column;
    min-width: 320px;
    min-height: 220px;
    border-radius: var(--radius-xl);
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    animation: window-in 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.1);
    contain: layout paint;
  }
  @keyframes window-in {
    from { opacity: 0; transform: scale(0.97) translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  :host([state="minimized"]) { display: none; }
  :host([state="maximized"]),
  :host([fullscreen]) {
    inset: 0 !important;
    width: auto !important;
    height: auto !important;
    border-radius: 0;
    border: 0;
  }
  :host([focused]) { box-shadow: var(--shadow-lg), 0 0 0 1px color-mix(in srgb, var(--ring) 30%, transparent); }
  :host(:not([focused])) .chrome { opacity: 0.72; }

  .chrome {
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--card) 62%, transparent);
    cursor: grab;
    user-select: none;
    flex: none;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 12px 0 14px;
  }
  .chrome:active { cursor: grabbing; }
  :host([fullscreen]) .chrome { cursor: default; }
  .lights { display: flex; gap: 9px; align-items: center; flex: none; }
  .light {
    width: 15px;
    height: 15px;
    border-radius: 999px;
    border: 0;
    padding: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    color: rgba(0, 0, 0, 0.6);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
    transition: filter 0.12s ease;
  }
  .light:hover { filter: brightness(1.08); }
  .light span { opacity: 0; transition: opacity 0.12s ease; }
  .lights:hover .light span { opacity: 1; }
  .close { background: #ff5f57; }
  .min { background: #febc2e; }
  .max { background: #28c840; }

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
  .names { display: grid; gap: 1px; min-width: 0; }
  .title {
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 11px;
    color: var(--muted-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tools {
    display: flex;
    min-width: 0;
    padding: 5px 14px 10px;
    overflow: hidden;
  }
  .tools[hidden] { display: none; }
  .tools jg-toolbar { width: 100%; min-width: 0; }

  .action {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    margin-left: -4px;
    border-radius: var(--radius-sm);
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
  }
  .action svg { --icon-accent: currentColor; }
  .action:hover { background: var(--accent); color: var(--foreground); }
  @media (max-width: 720px) {
    .bar { gap: 10px; padding-left: 12px; }
    .sub { display: none; }
    .identity { max-width: 40%; }
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
    width: 20px;
    height: 20px;
    border-radius: 999px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--ring);
    animation: spin 0.7s linear infinite;
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

class JGWindow extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['title-text'];

  #actions = [];

  #restore = null;

  get appId() {
    return this.getAttribute('app-id');
  }

  render() {
    const app = registry.find(this.appId);
    this.style.setProperty('--tint', app ? registry.tint(app) : 'var(--muted)');
    this.paint(html`
      <header class="chrome">
        <div class="bar">
          <button class="action menu" title="App options" aria-label="App options">${icon('more', 16)}</button>
          <div class="identity">
            <span class="badge">${app ? icon(app.icon, 17) : ''}</span>
            <span class="names">
              <span class="title">${this.getAttribute('title-text') ?? app?.name ?? 'App'}</span>
              ${app?.tagline ? html`<span class="sub">${app.tagline}</span>` : ''}
            </span>
          </div>
          <span class="spring"></span>
          <div class="lights">
            <button class="light min" title="Minimize"><span>-</span></button>
            <button class="light max" title="Maximize"><span>+</span></button>
            <button class="light close" title="Close"><span>✕</span></button>
          </div>
        </div>
        <div class="tools" id="tools" hidden><jg-toolbar id="app-toolbar" variant="plain"></jg-toolbar></div>
      </header>
      <div class="body">
        <slot></slot>
        <div class="loading"><span class="spinner"></span><span>Loading ${app?.name ?? 'app'}...</span></div>
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
      return;
    }
    this.#restore = {
      left: this.offsetLeft,
      top: this.offsetTop,
      width: this.offsetWidth,
      height: this.offsetHeight,
    };
    this.setAttribute('state', 'maximized');
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
