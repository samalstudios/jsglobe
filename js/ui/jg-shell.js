import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { router } from '../core/router.js';
import { bus } from '../core/bus.js';
import { settings } from '../core/settings.js';
import { commands } from '../core/commands.js';
import { layout } from '../core/layout.js';
import { wallpapers } from '../core/wallpapers.js';
import './jg-statusbar.js';
import './jg-home.js';
import './jg-dock.js';
import './jg-window-layer.js';
import './jg-spotlight.js';
import './jg-commands.js';
import './jg-library.js';
import './jg-privacy.js';
import './jg-consent.js';

const SITE_TITLE = 'Toolbox';

const sheet = css`
  :host {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .wallpaper {
    position: absolute;
    inset: 0;
    background: var(--wallpaper);
    background-attachment: fixed;
    z-index: 0;
  }
  .wallpaper::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(120% 90% at 50% 120%, rgba(0, 0, 0, 0.4), transparent 60%);
  }
  .desktop {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  jg-statusbar { position: relative; z-index: 60; }
  .surface { position: relative; flex: 1; min-height: 0; }
  .surface[data-dock="bottom"] jg-home { bottom: 82px; }
  .surface[data-dock="left"] jg-home { left: 82px; }
  .surface[data-dock="right"] jg-home { right: 82px; }
  .surface[data-autohide="true"] jg-home { inset: 0; }
  @media (max-width: 700px) {
    .surface[data-dock] jg-home { inset: 0; }
    .surface[data-dock-peek="true"] jg-home { --dock-lift: 0px; }
  }
  .surface[data-dock="bottom"][data-dock-peek="true"] jg-home { --dock-lift: 76px; }
  .missing {
    position: absolute;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 24px;
    background: color-mix(in srgb, var(--background) 65%, transparent);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }
  .missing-card {
    width: min(440px, 100%);
    padding: 26px;
    border-radius: var(--radius-xl);
    background: var(--glass-strong);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    text-align: center;
    display: grid;
    gap: 12px;
  }
  .missing-card h2 { font-size: 17px; margin: 0; }
  .missing-card p { color: var(--muted-foreground); font-size: 13px; margin: 0; }
  .missing-card code {
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--muted);
    padding: 2px 6px;
    border-radius: 6px;
  }
  .missing-actions { display: flex; gap: 8px; justify-content: center; margin-top: 4px; }
  .btn {
    appearance: none;
    border: 1px solid var(--border-strong);
    background: transparent;
    color: var(--foreground);
    font: 500 13px/1 var(--font-sans);
    padding: 9px 14px;
    border-radius: var(--radius-md);
    cursor: pointer;
    text-decoration: none;
  }
  .btn.primary { background: var(--primary); color: var(--primary-foreground); border-color: transparent; }
  .btn:hover { text-decoration: none; }
`;

class JGShell extends JGElement {
  static styles = [base, sheet];

  #route = null;
  #onSearch = true;

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('route:change', (route) => this.#applyRoute(route)));
    this.keep(bus.on('spotlight:open', () => this.$('jg-spotlight').open()));
    this.keep(bus.on('home:toggle-widgets', () => this.$('jg-home').toggleToday()));
    this.keep(bus.on('windows:change', (detail) => this.#syncRoute(detail)));
    this.keep(bus.on('settings:change', () => this.#applyChrome()));
    this.keep(
      bus.on('home:page', ({ search }) => {
        if (this.#onSearch === search) return;
        this.#onSearch = search;
        this.#applyChrome();
      }),
    );
    this.keep(
      bus.on('dock:peek', ({ visible }) => {
        const surface = this.$('.surface');
        if (surface) surface.dataset.dockPeek = String(visible);
      }),
    );
    this.listen(window, 'keydown', (event) => this.#hotkeys(event));
    this.keep(commands.provide(() => this.#commands()));
    this.keep(commands.provide(() => this.#appCommands()));
  }

  #commands() {
    const theme = settings.get('appearance.theme');
    const cycle = (key, values) => {
      const list = values.map((entry) => entry.value ?? entry);
      const next = list[(list.indexOf(settings.get(key)) + 1) % list.length];
      settings.set(key, next);
    };
    const toggle = (key) => settings.set(key, !settings.get(key));

    return [
      { id: 'home', group: 'Navigate', label: 'Go to home screen', icon: 'grid', shortcut: 'esc', action: () => router.home() },
      { id: 'library', group: 'Navigate', label: 'Open app library', icon: 'launcher', shortcut: '⌘/', action: () => router.go('/apps') },
      { id: 'search', group: 'Navigate', label: 'Search tools', icon: 'search', shortcut: '⌘K', action: () => this.$('jg-spotlight').open() },
      { id: 'settings', group: 'Navigate', label: 'Open settings', icon: 'cog', action: () => router.app('settings') },
      { id: 'privacy', group: 'Navigate', label: 'Open privacy policy', icon: 'shield', action: () => router.go('/privacy') },

      { id: 'theme-light', group: 'Appearance', label: 'Use light theme', icon: 'sun', value: theme === 'light' ? 'active' : '', action: () => settings.set('appearance.theme', 'light') },
      { id: 'theme-dark', group: 'Appearance', label: 'Use dark theme', icon: 'moon', value: theme === 'dark' ? 'active' : '', action: () => settings.set('appearance.theme', 'dark') },
      { id: 'theme-auto', group: 'Appearance', label: 'Match system theme', icon: 'monitor', value: theme === 'auto' ? 'active' : '', action: () => settings.set('appearance.theme', 'auto') },
      { id: 'wallpaper', group: 'Appearance', label: 'Next wallpaper', icon: 'image', keywords: ['background'], action: () => cycle('appearance.wallpaper', wallpapers.map((paper) => paper.id)) },
      { id: 'icons', group: 'Appearance', label: 'Switch icon style', icon: 'swatches', keywords: ['skeuomorphic', 'flat'], value: settings.get('appearance.icons'), action: () => cycle('appearance.icons', ['flat', 'skeuomorphic']) },
      { id: 'density', group: 'Appearance', label: 'Switch density', icon: 'ruler', value: settings.get('appearance.density'), action: () => cycle('appearance.density', ['compact', 'cozy', 'roomy']) },
      { id: 'motion', group: 'Appearance', label: settings.get('appearance.motion') ? 'Turn off animation' : 'Turn on animation', icon: 'motion', action: () => toggle('appearance.motion') },

      { id: 'dock', group: 'Desktop', label: settings.get('home.dock') ? 'Hide the dock' : 'Show the dock', icon: 'blocks', action: () => toggle('home.dock') },
      { id: 'dock-position', group: 'Desktop', label: 'Move the dock', icon: 'transform', value: settings.get('dock.position'), action: () => cycle('dock.position', ['left', 'bottom', 'right']) },
      { id: 'labels', group: 'Desktop', label: settings.get('home.labels') ? 'Hide app labels' : 'Show app labels', icon: 'type', action: () => toggle('home.labels') },
      { id: 'widgets', group: 'Desktop', label: settings.get('home.widgets') ? 'Hide widgets' : 'Show widgets', icon: 'widgets', action: () => toggle('home.widgets') },
      { id: 'icon-size', group: 'Desktop', label: 'Change icon size', icon: 'scale', value: settings.get('home.iconSize'), action: () => cycle('home.iconSize', ['small', 'medium', 'large']) },
      { id: 'shuffle', group: 'Desktop', label: 'Reset home layout', icon: 'repeat', keywords: ['arrange'], action: () => layout.reset() },
    ];
  }

  #appCommands() {
    const id = this.#layer?.focusedId;
    if (!id) return [];
    const meta = registry.find(id);
    const window = this.#layer.windowFor(id);
    const actions = (window?.actions ?? [])
      .filter((item) => item.action && item.label)
      .map((item) => ({
        id: `app:${id}:${item.id ?? item.label}`,
        group: meta?.name ?? 'App',
        label: item.label,
        icon: item.icon ?? 'sparkles',
        action: () => item.action(),
      }));
    return [
      ...actions,
      { id: `close:${id}`, group: meta?.name ?? 'App', label: `Close ${meta?.name ?? id}`, icon: 'close', action: () => router.home() },
    ];
  }

  render() {
    this.paint(html`
      <div class="wallpaper"></div>
      <div class="desktop">
        <jg-statusbar></jg-statusbar>
        <div class="surface">
          <jg-home></jg-home>
          <jg-window-layer></jg-window-layer>
          <jg-dock data-inline></jg-dock>
        </div>
      </div>
      <jg-spotlight></jg-spotlight>
      <jg-commands></jg-commands>
      <jg-consent></jg-consent>
    `);
    this.#applyChrome();
    if (this.#route) this.#applyRoute(this.#route);
  }

  #applyChrome() {
    const scope = settings.get('dock.scope');
    const wanted = settings.get('home.dock') && (scope !== 'search' || this.#onSearch);
    const dock = this.$('jg-dock');
    if (dock) dock.hidden = !wanted;
    const surface = this.$('.surface');
    const position = settings.get('dock.position');
    if (surface) {
      surface.dataset.dock = wanted ? position : 'hidden';
      surface.dataset.autohide = String(Boolean(settings.get('dock.autoHide')));
    }
  }

  get #layer() {
    return this.$('jg-window-layer');
  }

  #applyRoute(route) {
    this.#route = route;
    if (!this.shadowRoot.childElementCount) return;

    if (route.name !== 'directory') this.$('jg-library')?.remove();
    if (route.name !== 'privacy') this.$('jg-privacy')?.remove();
    this.$('.missing')?.remove();

    if (route.name === 'privacy') {
      if (!this.$('jg-privacy')) this.$('.surface').append(document.createElement('jg-privacy'));
      document.title = `Privacy policy | ${SITE_TITLE}`;
      return;
    }

    if (route.name === 'home') {
      this.#layer.minimizeAll();
      document.title = SITE_TITLE;
      return;
    }

    if (route.name === 'search') {
      this.$('jg-spotlight').open(route.query);
      document.title = SITE_TITLE;
      return;
    }

    if (route.name === 'directory') {
      let library = this.$('jg-library');
      if (!library) {
        library = document.createElement('jg-library');
        this.$('.surface').append(library);
      }
      library.category = route.category;
      document.title = SITE_TITLE;
      return;
    }

    if (route.name === 'app') {
      const meta = registry.find(route.appId);
      if (!meta) return this.#renderMissing(route.appId);
      this.#layer.open(route.appId);
      document.title = `${meta.name} | Toolbox`;
    }
  }

  #renderMissing(appId) {
    document.title = SITE_TITLE;
    const node = document.createElement('div');
    node.className = 'missing';
    node.innerHTML = html`
      <div class="missing-card">
        <h2>No tool at that address</h2>
        <p><code>/apps/${appId}</code> isn't installed in this build.</p>
        <div class="missing-actions">
          <a class="btn primary" href="${router.href('/apps')}">Browse the library</a>
          <button class="btn find">Search tools</button>
        </div>
      </div>
    `;
    this.$('.surface').append(node);
    node.querySelector('.find').addEventListener('click', () => this.$('jg-spotlight').open(appId.replace(/-/g, ' ')));
  }

  #syncRoute({ focused }) {
    const route = router.current;
    if (focused) {
      if (route.name !== 'app' || route.appId !== focused) router.app(focused);
      return;
    }
    if (route.name === 'app') router.go('/');
  }

  #hotkeys(event) {
    const spotlight = this.$('jg-spotlight');
    const palette = this.$('jg-commands');
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'p') {
      event.preventDefault();
      spotlight.close();
      palette.isOpen ? palette.close() : palette.open();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault();
      spotlight.isOpen ? spotlight.close() : spotlight.open();
      return;
    }
    if (event.key === 'Escape' && !spotlight.isOpen && !palette.isOpen) {
      const focused = this.#layer?.focusedId;
      if (focused && router.current.name === 'app') router.go('/');
      return;
    }
    if ((event.metaKey || event.ctrlKey) && key === '/') {
      event.preventDefault();
      router.go('/apps');
    }
  }
}

define('jg-shell', JGShell);
