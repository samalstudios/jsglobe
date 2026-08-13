import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { router } from '../core/router.js';
import { bus } from '../core/bus.js';
import { settings } from '../core/settings.js';
import './jg-statusbar.js';
import './jg-home.js';
import './jg-dock.js';
import './jg-window-layer.js';
import './jg-spotlight.js';
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

  connectedCallback() {
    super.connectedCallback();
    this.keep(bus.on('route:change', (route) => this.#applyRoute(route)));
    this.keep(bus.on('spotlight:open', () => this.$('jg-spotlight').open()));
    this.keep(bus.on('home:toggle-widgets', () => this.$('jg-home').toggleToday()));
    this.keep(bus.on('windows:change', (detail) => this.#syncRoute(detail)));
    this.keep(bus.on('settings:change', () => this.#applyChrome()));
    this.keep(
      bus.on('dock:peek', ({ visible }) => {
        const surface = this.$('.surface');
        if (surface) surface.dataset.dockPeek = String(visible);
      }),
    );
    this.listen(window, 'keydown', (event) => this.#hotkeys(event));
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
      <jg-consent></jg-consent>
    `);
    this.#applyChrome();
    if (this.#route) this.#applyRoute(this.#route);
  }

  #applyChrome() {
    const dock = this.$('jg-dock');
    if (dock) dock.hidden = !settings.get('home.dock');
    const surface = this.$('.surface');
    const position = settings.get('dock.position');
    if (surface) {
      surface.dataset.dock = settings.get('home.dock') ? position : 'hidden';
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
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault();
      spotlight.isOpen ? spotlight.close() : spotlight.open();
      return;
    }
    if (event.key === 'Escape' && !spotlight.isOpen) {
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
