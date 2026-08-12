import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { layout, isFolder, folderId } from '../core/layout.js';
import { registry } from '../core/registry.js';
import { settings } from '../core/settings.js';
import { router } from '../core/router.js';
import { bus } from '../core/bus.js';
import { contextMenu } from './jg-menu.js';
import { clamp } from '../core/util.js';
import './jg-app-tile.js';
import './jg-folder-tile.js';
import './jg-folder-view.js';
import './jg-widget-board.js';

const sheet = css`
  :host {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .stage {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 22px;
    padding: 8px 26px 0;
  }
  :host([today]) .stage { grid-template-columns: minmax(280px, 25%) 1fr; }
  @media (max-width: 1080px) {
    :host([today]) .stage { grid-template-columns: 1fr; }
    .today { display: none; }
    :host([today-open]) .today {
      display: block;
      position: absolute;
      inset: 8px auto 8px 16px;
      width: min(340px, 82vw);
      z-index: 5;
    }
  }
  .today { min-height: 0; overflow: hidden; }
  .pager {
    display: flex;
    min-height: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    scroll-behavior: smooth;
  }
  .pager::-webkit-scrollbar { display: none; }
  .page {
    flex: 0 0 100%;
    scroll-snap-align: center;
    display: grid;
    grid-template-columns: repeat(var(--cols, 6), minmax(0, 1fr));
    grid-auto-rows: min-content;
    gap: 26px 12px;
    align-content: start;
    padding: 12px 4px 20px;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .page::-webkit-scrollbar { display: none; }
  jg-app-tile, jg-folder-tile { --tile: var(--tile-size, 62px); justify-self: center; }
  .pager-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 2px;
    padding: 4px 0 12px;
    flex: none;
  }
  .pager-inner {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border-radius: 999px;
    background: var(--glass);
    border: 1px solid var(--glass-border);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: var(--shadow-sm);
  }
  .arrow {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--foreground);
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    opacity: 0.7;
    transition: background 0.15s ease, opacity 0.15s ease;
  }
  .arrow:hover:not(:disabled) { background: color-mix(in srgb, var(--foreground) 12%, transparent); opacity: 1; }
  .arrow:disabled { opacity: 0.25; cursor: default; }
  .dots { display: flex; align-items: center; gap: 2px; }
  .dot {
    position: relative;
    display: grid;
    place-items: center;
    min-width: 26px;
    height: 26px;
    padding: 0 8px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted-foreground);
    font: 600 11.5px/1 var(--font-sans);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .dot:hover { background: color-mix(in srgb, var(--foreground) 10%, transparent); color: var(--foreground); }
  .dot[aria-current="true"] {
    background: color-mix(in srgb, var(--foreground) 16%, transparent);
    color: var(--foreground);
  }
  .dot .pip { display: none; }
  @media (pointer: coarse) {
    .pager-inner { background: transparent; border-color: transparent; box-shadow: none; backdrop-filter: none; }
    .arrow { display: none; }
    .dots { gap: 8px; }
    .dot { min-width: 22px; width: 22px; padding: 0; font-size: 0; }
    .dot .pip {
      display: block;
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--foreground) 30%, transparent);
    }
    .dot[aria-current="true"] { background: transparent; }
    .dot[aria-current="true"] .pip { background: var(--foreground); transform: scale(1.15); }
  }
  .ghost {
    position: fixed;
    z-index: 300;
    pointer-events: none;
    opacity: 0.92;
    transform: translate(-50%, -50%) scale(1.08);
    filter: drop-shadow(0 18px 26px rgba(0, 0, 0, 0.55));
  }
  .editbar {
    position: absolute;
    top: 10px;
    right: 26px;
    z-index: 6;
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 8px 6px 14px;
    border-radius: 999px;
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-md);
    font-size: 12px;
    color: var(--muted-foreground);
  }
  .done {
    appearance: none;
    border: 0;
    border-radius: 999px;
    background: var(--primary);
    color: var(--primary-foreground);
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 13px;
    cursor: pointer;
  }
  .empty-page {
    grid-column: 1 / -1;
    display: grid;
    place-items: center;
    color: var(--muted-foreground);
    font-size: 13px;
    padding: 40px 0;
  }
`;

const TILE_SIZES = { small: 52, medium: 62, large: 74 };

class JGHome extends JGElement {
  static styles = [base, sheet];

  #page = 0;
  #editing = false;
  #drag = null;

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('layout:change', () => this.refresh()));
    this.keep(bus.on('settings:change', () => this.refresh()));
    this.keep(bus.on('workspace:switch', () => this.refresh()));
  }

  toggleToday() {
    this.toggleAttribute('today-open');
  }

  render() {
    const state = layout.state();
    const showWidgets = settings.get('home.widgets');
    const labels = settings.get('home.labels');
    const tile = TILE_SIZES[settings.get('home.iconSize')] ?? TILE_SIZES.medium;
    this.toggleAttribute('today', showWidgets);
    this.style.setProperty('--tile-size', `${tile}px`);
    this.#page = clamp(this.#page, 0, state.pages.length - 1);

    this.paint(html`
      ${this.#editing
        ? html`<div class="editbar"><span>Drag to rearrange</span><button class="done" type="button">Done</button></div>`
        : ''}
      <div class="stage">
        ${showWidgets ? html`<aside class="today"><jg-widget-board></jg-widget-board></aside>` : ''}
        <div class="pager">
          ${state.pages.map(
            (page, index) => html`<section class="page" data-page="${index}">
              ${page.length
                ? page.map((entry) =>
                    isFolder(entry)
                      ? html`<jg-folder-tile folder-id="${folderId(entry)}" ${labels ? '' : 'no-label'} ${this.#editing ? 'editing' : ''}></jg-folder-tile>`
                      : html`<jg-app-tile app-id="${entry}" ${labels ? '' : 'no-label'} ${this.#editing ? 'editing' : ''}></jg-app-tile>`,
                  )
                : html`<div class="empty-page">Drop apps here</div>`}
            </section>`,
          )}
        </div>
      </div>
      ${state.pages.length > 1
        ? html`<div class="pager-controls">
            <div class="pager-inner">
              <button class="arrow prev" aria-label="Previous page">‹</button>
              <div class="dots">
                ${state.pages.map(
                  (page, index) =>
                    html`<button class="dot" data-page="${index}" aria-current="${String(index === this.#page)}" aria-label="Page ${index + 1}">
                      <span class="pip"></span>${index + 1}
                    </button>`,
                )}
              </div>
              <button class="arrow next" aria-label="Next page">›</button>
            </div>
          </div>`
        : ''}
    `);

    this.#applyColumns();
    this.#wire();
    queueMicrotask(() => this.#scrollToPage(this.#page, 'auto'));
  }

  #applyColumns() {
    const setting = settings.get('home.columns');
    const width = this.clientWidth || window.innerWidth;
    const available = this.hasAttribute('today') && width > 1080 ? width * 0.72 : width;
    const tile = TILE_SIZES[settings.get('home.iconSize')] ?? TILE_SIZES.medium;
    const cols = setting === 'auto' ? clamp(Math.floor(available / (tile + 46)), 2, 9) : Number(setting);
    this.$$('.page').forEach((page) => page.style.setProperty('--cols', String(cols)));
  }

  #wire() {
    const pager = this.$('.pager');
    this.on(pager, 'scroll', () => {
      const index = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
      if (index === this.#page) return;
      this.#page = index;
      this.#syncPager();
    });

    this.bind('.dot', 'click', (event) => {
      this.#goToPage(Number(event.currentTarget.dataset.page));
    });

    const prev = this.$('.prev');
    const next = this.$('.next');
    if (prev) this.on(prev, 'click', () => this.#goToPage(this.#page - 1));
    if (next) this.on(next, 'click', () => this.#goToPage(this.#page + 1));
    this.#syncPager();

    this.on(window, 'keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.composedPath()[0];
      if (target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
      if (this.offsetParent === null) return;
      if (event.key === 'ArrowRight') this.#goToPage(this.#page + 1);
      if (event.key === 'ArrowLeft') this.#goToPage(this.#page - 1);
    });

    const done = this.$('.done');
    if (done) this.on(done, 'click', () => this.#setEditing(false));

    this.bind('jg-app-tile', 'tile:menu', (event) => {
      event.stopPropagation();
      this.#tileMenu(event.detail);
    });

    this.bind('jg-app-tile', 'tile:remove', (event) => {
      layout.hide(event.detail.appId);
    });

    this.bind('jg-app-tile', 'pointerdown', (event) => this.#beginPress(event));
    this.bind('jg-folder-tile', 'pointerdown', (event) => this.#beginPress(event));

    this.bind('jg-folder-tile', 'folder:open', (event) => this.#openFolder(event.detail.id));
    this.bind('jg-folder-tile', 'folder:menu', (event) => {
      event.stopPropagation();
      this.#folderMenu(event.detail);
    });

    this.on(window, 'resize', () => this.#applyColumns());

    this.on(this, 'contextmenu', (event) => {
      if (event.target.closest('jg-app-tile')) return;
      event.preventDefault();
      contextMenu({
        x: event.clientX,
        y: event.clientY,
        title: 'Home screen',
        items: [
          { label: this.#editing ? 'Finish editing' : 'Edit home screen', glyph: '✎', action: () => this.#setEditing(!this.#editing) },
          { label: 'Add page', glyph: '＋', action: () => layout.addPage() },
          {
            label: settings.get('home.widgets') ? 'Hide widgets' : 'Show widgets',
            glyph: '▣',
            action: () => settings.set('home.widgets', !settings.get('home.widgets')),
          },
          { separator: true },
          { label: 'Open settings', glyph: '⚙', action: () => router.app('settings') },
          { label: 'Reset layout', glyph: '↺', danger: true, action: () => layout.reset() },
        ],
      });
    });
  }

  #openFolder(id) {
    this.$('jg-folder-view')?.remove();
    const view = document.createElement('jg-folder-view');
    this.shadowRoot.append(view);
    view.folder = id;
  }

  #folderMenu({ id, x, y }) {
    const folder = layout.folder(id);
    if (!folder) return;
    contextMenu({
      x,
      y,
      title: folder.name,
      items: [
        { label: 'Open folder', glyph: '▤', action: () => this.#openFolder(id) },
        {
          label: 'Rename...',
          glyph: '✎',
          action: () => {
            const name = prompt('Folder name', folder.name);
            if (name) layout.renameFolder(id, name);
          },
        },
        { separator: true },
        { label: 'Ungroup', glyph: '↥', danger: true, action: () => layout.dissolveFolder(id) },
      ],
    });
  }

  #tileMenu({ appId, x, y }) {
    const meta = registry.find(appId);
    const inDock = layout.dock().includes(appId);
    contextMenu({
      x,
      y,
      title: meta.name,
      items: [
        { label: 'Open', glyph: '↗', action: () => router.app(appId) },
        { label: 'Copy link', glyph: '⧉', action: () => navigator.clipboard?.writeText(`${window.location.origin}${router.href(`/${appId}`)}`) },
        { separator: true },
        meta.widget && { label: 'Add widget', glyph: '▣', action: () => layout.addWidget(appId) },
        { label: inDock ? 'Remove from dock' : 'Add to dock', glyph: '⌸', action: () => layout.toggleDock(appId) },
        {
          label: 'Move to folder',
          glyph: '▤',
          action: () =>
            contextMenu({
              x,
              y,
              title: 'Move to folder',
              items: [
                ...Object.values(layout.folders()).map((folder) => ({
                  label: folder.name,
                  glyph: '▤',
                  action: () => layout.addToFolder(folder.id, appId),
                })),
                { separator: true },
                {
                  label: 'New folder...',
                  glyph: '＋',
                  action: () => {
                    const name = prompt('Folder name', meta.name);
                    if (name) layout.createFolder(name, [appId], meta.tint);
                  },
                },
              ],
            }),
        },
        { label: 'Edit home screen', glyph: '✎', action: () => this.#setEditing(true) },
        { separator: true },
        { label: 'Remove from home', glyph: '✕', danger: true, action: () => layout.hide(appId) },
      ],
    });
  }

  #setEditing(value) {
    this.#editing = value;
    this.refresh();
  }

  #goToPage(index) {
    const pages = this.$$('.page').length;
    const target = clamp(index, 0, pages - 1);
    if (target === this.#page) return;
    this.#page = target;
    this.#scrollToPage(target);
    this.#syncPager();
  }

  #syncPager() {
    this.$$('.dot').forEach((dot) => dot.setAttribute('aria-current', String(Number(dot.dataset.page) === this.#page)));
    const prev = this.$('.prev');
    const next = this.$('.next');
    if (prev) prev.disabled = this.#page === 0;
    if (next) next.disabled = this.#page >= this.$$('.page').length - 1;
  }

  #scrollToPage(index, behavior = 'smooth') {
    const pager = this.$('.pager');
    if (!pager) return;
    pager.scrollTo({ left: index * pager.clientWidth, behavior });
  }

  #beginPress(event) {
    if (event.button !== 0) return;
    const tile = event.currentTarget;
    const start = { x: event.clientX, y: event.clientY };

    const startDrag = () => {
      cleanup();
      this.#startDrag(tile, start);
    };

    const timer = setTimeout(() => {
      if (!this.#editing) this.#setEditing(true);
      else startDrag();
    }, 420);

    const move = (moveEvent) => {
      if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < 6) return;
      if (this.#editing) startDrag();
      else cleanup();
    };
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cleanup);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cleanup);
  }

  #startDrag(tile, origin) {
    const ghost = tile.cloneNode(true);
    ghost.className = 'ghost';
    ghost.removeAttribute('editing');
    ghost.style.left = `${origin.x}px`;
    ghost.style.top = `${origin.y}px`;
    ghost.style.width = `${tile.offsetWidth}px`;
    document.body.append(ghost);
    tile.setAttribute('dragging', '');
    this.#drag = { tile, ghost };

    const move = (event) => {
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
      const target = this.#tileAt(event.clientX, event.clientY);
      if (target && target !== tile) {
        const rect = target.getBoundingClientRect();
        const after = event.clientX > rect.left + rect.width / 2;
        target.parentElement.insertBefore(tile, after ? target.nextSibling : target);
      }
      this.#edgeScroll(event.clientX);
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      ghost.remove();
      tile.removeAttribute('dragging');
      this.#drag = null;
      this.#commitOrder(tile);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  #tileAt(x, y) {
    const nodes = this.shadowRoot.elementsFromPoint(x, y);
    return nodes.find((node) => node.tagName === 'JG-APP-TILE' || node.tagName === 'JG-FOLDER-TILE') ?? null;
  }

  #edgeScroll(x) {
    const pager = this.$('.pager');
    const rect = pager.getBoundingClientRect();
    const now = Date.now();
    if (this.#lastEdge && now - this.#lastEdge < 700) return;
    if (x < rect.left + 60 && this.#page > 0) {
      this.#lastEdge = now;
      this.#page -= 1;
      this.#scrollToPage(this.#page);
    } else if (x > rect.right - 60 && this.#page < this.$$('.page').length - 1) {
      this.#lastEdge = now;
      this.#page += 1;
      this.#scrollToPage(this.#page);
    }
  }

  #lastEdge = 0;

  #commitOrder(tile) {
    const page = tile.closest('.page');
    if (!page) return;
    const pageIndex = Number(page.dataset.page);
    const entries = [...page.querySelectorAll('jg-app-tile, jg-folder-tile')];
    const position = entries.indexOf(tile);
    const entry = tile.tagName === 'JG-FOLDER-TILE' ? `folder:${tile.getAttribute('folder-id')}` : tile.getAttribute('app-id');
    layout.move(entry, pageIndex, position);
  }
}

define('jg-home', JGHome);
