import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { layout, isFolder, folderId } from '../core/layout.js';
import { usage } from '../core/usage.js';
import { icon } from './icons.js';
import { registry } from '../core/registry.js';
import { settings } from '../core/settings.js';
import { router } from '../core/router.js';
import { bus } from '../core/bus.js';
import { contextMenu } from './jg-menu.js';
import { clamp } from '../core/util.js';
import { keys } from '../core/keys.js';
import { REPO_URL } from '../core/site.js';
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
    transform: translateY(calc(var(--dock-lift, 0px) * -1));
    transition: transform 0.24s cubic-bezier(0.2, 0.85, 0.3, 1);
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
    .dot { min-width: 22px; width: 22px; padding: 0; font-size: 0; overflow: hidden; }
    .dot.glyph { min-width: 26px; width: 26px; padding: 0; overflow: visible; }
    .dot.glyph .pip { display: none; }
    .dot.glyph svg { width: 12px; height: 12px; }
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
  .search-page {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 18px;
    padding: 8px 4px 20px;
    overflow-y: auto;
    scrollbar-width: none;
    transition: justify-content 0.2s ease;
  }
  .search-page[data-top="true"] { justify-content: flex-start; }
  .search-page[data-top="false"] .search-shell { padding-bottom: 6vh; }
  .search-page::-webkit-scrollbar { display: none; }
  .search-shell { display: grid; gap: 14px; width: min(760px, 100%); margin: 0 auto; }
  .site-links {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: auto;
    padding-top: 16px;
    font-size: 12px;
    color: color-mix(in srgb, var(--muted-foreground) 90%, transparent);
    text-shadow: var(--label-shadow);
  }
  .site-links a { display: inline-flex; align-items: center; gap: 5px; color: inherit; text-decoration: none; }
  .site-links svg { --icon-accent: currentColor; stroke-width: 1.6; opacity: 0.9; }
  .site-links a:hover { color: var(--foreground); text-decoration: underline; text-underline-offset: 3px; }
  .brand {
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 24px 0 20px;
    color: var(--ring);
  }
  .brand svg { width: 52px; height: 52px; stroke-width: 1.5; margin-bottom: 10px; }
  .brand h1 {
    margin: 0;
    font: 650 25px/1.2 var(--font-sans);
    letter-spacing: -0.03em;
    color: var(--foreground);
    text-shadow: var(--label-shadow);
  }
  .brand p {
    margin: 0;
    font-size: 13px;
    color: color-mix(in srgb, var(--muted-foreground) 92%, transparent);
    text-shadow: var(--label-shadow);
    text-align: center;
  }
  .search-field {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 999px;
    background: var(--glass);
    border: 1px solid var(--glass-border);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    box-shadow: var(--shadow-md);
    transition: box-shadow 0.15s ease, border-color 0.15s ease;
  }
  .search-field:focus-within {
    border-color: color-mix(in srgb, var(--ring) 65%, var(--glass-border));
    box-shadow: var(--shadow-md), var(--shadow-ring);
  }
  .search-field svg { color: var(--muted-foreground); flex: none; }
  .search-field input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 15px;
    outline: none;
  }
  .search-field input::placeholder { color: var(--muted-foreground); }
  .search-field input:focus,
  .search-field input:focus-visible { outline: none; box-shadow: none; }
  .search-field input::-webkit-search-decoration,
  .search-field input::-webkit-search-cancel-button { appearance: none; }
  .search-clear {
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    font-size: 14px;
    padding: 0 2px;
  }
  .search-results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 20px 8px;
    justify-items: center;
  }
  .search-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted-foreground);
    text-shadow: var(--label-shadow);
    margin-bottom: 10px;
  }
  .search-heading .close {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 5px;
    opacity: 0.65;
  }
  .search-heading .close:hover { opacity: 1; background: color-mix(in srgb, var(--foreground) 12%, transparent); }
  .search-none { color: var(--muted-foreground); font-size: 13px; text-shadow: var(--label-shadow); }
  .dot.glyph { display: grid; place-items: center; padding: 0 7px; }
  .dot.glyph svg { width: 13px; height: 13px; }
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

  #page = null;
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

  #descriptors() {
    const state = layout.state();
    const pages = state.pages.map((page, index) => ({ type: 'apps', index, items: page }));
    return settings.get('home.searchPage') ? [{ type: 'search' }, ...pages] : pages;
  }

  render() {
    const state = layout.state();
    const showWidgets = settings.get('home.widgets');
    const labels = settings.get('home.labels');
    const tile = TILE_SIZES[settings.get('home.iconSize')] ?? TILE_SIZES.medium;
    this.toggleAttribute('today', showWidgets);
    this.style.setProperty('--tile-size', `${tile}px`);

    const descriptors = this.#descriptors();
    if (this.#page === null) this.#page = descriptors[0]?.type === 'search' ? Math.min(1, descriptors.length - 1) : 0;
    this.#page = clamp(this.#page, 0, descriptors.length - 1);

    this.paint(html`
      ${this.#editing
        ? html`<div class="editbar"><span>Drag to rearrange</span><button class="done" type="button">Done</button></div>`
        : ''}
      <div class="stage">
        ${showWidgets ? html`<aside class="today"><jg-widget-board></jg-widget-board></aside>` : ''}
        <div class="pager">
          ${descriptors.map((descriptor) =>
            descriptor.type === 'search'
              ? html`<section class="page search-page" data-search="true" data-top="${String(layout.widgets().length > 0)}">
                  <div class="search-shell">
                    <div class="brand">
                      ${icon('knife', 52)}
                      <h1>Toolbox</h1>
                      <p>${registry.all().length} fast, private developer tools that run in your browser</p>
                    </div>
                    <label class="search-field">
                      ${icon('search', 18)}
                      <input id="home-search" type="search" placeholder="Search ${registry.all().length} tools" autocomplete="off" spellcheck="false" />
                      <button class="search-clear" id="home-search-clear" hidden aria-label="Clear">✕</button>
                    </label>
                    <div id="home-search-results"></div>
                    <jg-widget-board></jg-widget-board>
                  </div>
                  <footer class="site-links">
                    <a href="${router.href('/apps')}">${icon('launcher', 14)}All tools</a>
                    <span>·</span>
                    <a href="${router.href('/privacy')}">${icon('shieldCheck', 14)}Privacy</a>
                    <span>·</span>
                    <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${icon('github', 14)}GitHub</a>
                  </footer>
                </section>`
              : html`<section class="page" data-page="${descriptor.index}">
                  ${descriptor.items.length
                    ? descriptor.items.map((entry) =>
                        isFolder(entry)
                          ? html`<jg-folder-tile folder-id="${folderId(entry)}" ${labels ? '' : 'no-label'} ${this.#editing ? 'editing' : ''}></jg-folder-tile>`
                          : html`<jg-app-tile app-id="${entry}" ${labels ? '' : 'no-label'} ${this.#editing ? 'editing' : ''}></jg-app-tile>`,
                      )
                    : html`<div class="empty-page">Drop apps here</div>`}
                </section>`,
          )}
        </div>
      </div>
      ${descriptors.length > 1
        ? html`<div class="pager-controls">
            <div class="pager-inner">
              <button class="arrow prev" aria-label="Previous page">‹</button>
              <div class="dots">
                ${descriptors.map((descriptor, index) =>
                  descriptor.type === 'search'
                    ? html`<button class="dot glyph" data-page="${index}" aria-current="${String(index === this.#page)}" aria-label="Search">
                        <span class="pip"></span>${icon('search', 13)}
                      </button>`
                    : html`<button class="dot" data-page="${index}" aria-current="${String(index === this.#page)}" aria-label="Page ${descriptor.index + 1}">
                        <span class="pip"></span>${descriptor.index + 1}
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

  #paintSearch(query) {
    const node = this.$('#home-search-results');
    if (!node) return;
    const labels = settings.get('home.labels');

    const showMostUsed = settings.get('home.mostUsed');
    const results = query
      ? registry.search(query, 18)
      : showMostUsed
        ? usage.top(8).map((id) => registry.find(id)).filter(Boolean)
        : [];

    if (query && !results.length) {
      node.innerHTML = html`<div class="search-none">Nothing matches "${query}".</div>`;
      return;
    }

    node.innerHTML = html`
      ${query
        ? html`<div class="search-heading">${results.length} result${results.length === 1 ? '' : 's'}</div>`
        : results.length
          ? html`<div class="search-heading">
              <span>Most used</span>
              <button class="close" id="hide-most-used" title="Hide this section" aria-label="Hide most used">✕</button>
            </div>`
          : ''}
      <div class="search-results">
        ${results.map((app) => html`<jg-app-tile app-id="${app.id}" ${labels ? '' : 'no-label'}></jg-app-tile>`)}
      </div>`;

    const hide = this.$('#hide-most-used');
    if (hide) this.on(hide, 'click', () => settings.set('home.mostUsed', false));
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
    const search = this.$('#home-search');
    if (search) {
      const clear = this.$('#home-search-clear');
      const run = () => {
        const query = search.value.trim();
        clear.hidden = !query;
        this.#paintSearch(query);
        const page = this.$('.search-page');
        if (page) page.dataset.top = String(Boolean(query) || layout.widgets().length > 0);
      };
      this.on(search, 'input', run);
      this.on(search, 'keydown', (event) => {
        if (event.key === 'Escape') {
          search.value = '';
          run();
        }
        if (event.key === 'Enter') {
          const first = registry.search(search.value, 1)[0];
          if (first) router.app(first.id);
        }
      });
      this.on(clear, 'click', () => {
        search.value = '';
        run();
        search.focus();
      });
      this.#paintSearch('');
    }

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
      if (!keys.ambient(event) || this.offsetParent === null) return;
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
          { label: this.#editing ? 'Finish editing' : 'Edit home screen', icon: 'pencil', action: () => this.#setEditing(!this.#editing) },
          { label: 'Add page', icon: 'plus', action: () => layout.addPage() },
          {
            label: settings.get('home.widgets') ? 'Hide widgets' : 'Show widgets',
            icon: 'widget',
            action: () => settings.set('home.widgets', !settings.get('home.widgets')),
          },
          { separator: true },
          { label: 'Open settings', icon: 'cog', action: () => router.app('settings') },
          { label: 'Reset layout', icon: 'undo', danger: true, action: () => layout.reset() },
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
        { label: 'Open folder', icon: 'folder', action: () => this.#openFolder(id) },
        {
          label: 'Rename...',
          icon: 'pencil',
          action: () => {
            const name = prompt('Folder name', folder.name);
            if (name) layout.renameFolder(id, name);
          },
        },
        { separator: true },
        { label: 'Ungroup', icon: 'arrowUp', danger: true, action: () => layout.dissolveFolder(id) },
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
        { label: 'Open', icon: 'external', action: () => router.app(appId) },
        { label: 'Copy link', icon: 'copy', action: () => navigator.clipboard?.writeText(`${window.location.origin}${router.href(`/apps/${appId}`)}`) },
        { separator: true },
        meta.widget && { label: 'Add widget', icon: 'widget', action: () => layout.addWidget(appId) },
        { label: inDock ? 'Remove from dock' : 'Add to dock', icon: 'dock', action: () => layout.toggleDock(appId) },
        {
          label: 'Move to folder',
          icon: 'folder',
          action: () =>
            contextMenu({
              x,
              y,
              title: 'Move to folder',
              items: [
                ...Object.values(layout.folders()).map((folder) => ({
                  label: folder.name,
                  icon: 'folder',
                  action: () => layout.addToFolder(folder.id, appId),
                })),
                { separator: true },
                {
                  label: 'New folder...',
                  icon: 'plus',
                  action: () => {
                    const name = prompt('Folder name', meta.name);
                    if (name) layout.createFolder(name, [appId], meta.tint);
                  },
                },
              ],
            }),
        },
        { label: 'Edit home screen', icon: 'pencil', action: () => this.#setEditing(true) },
        { separator: true },
        { label: 'Remove from home', icon: 'close', danger: true, action: () => layout.hide(appId) },
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
