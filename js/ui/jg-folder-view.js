import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { layout } from '../core/layout.js';
import { registry } from '../core/registry.js';
import { bus } from '../core/bus.js';
import { contextMenu } from './jg-menu.js';
import { keys } from '../core/keys.js';
import './jg-app-tile.js';

const sheet = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 45;
    display: grid;
    place-items: center;
    padding: 24px;
    background: color-mix(in srgb, var(--background) 45%, transparent);
    backdrop-filter: blur(26px) saturate(140%);
    -webkit-backdrop-filter: blur(26px) saturate(140%);
    animation: fade 0.16s ease;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .panel {
    width: min(720px, 100%);
    max-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 22px;
    border-radius: var(--radius-xl);
    background: var(--glass);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    animation: rise 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.1);
  }
  @keyframes rise {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: none; }
  }
  header { display: flex; align-items: center; gap: 12px; }
  .name {
    flex: 1;
    min-width: 0;
    appearance: none;
    border: 1px solid transparent;
    background: transparent;
    color: var(--foreground);
    font: 600 17px/1.3 var(--font-sans);
    letter-spacing: -0.02em;
    padding: 5px 8px;
    border-radius: var(--radius-sm);
    outline: none;
  }
  .name:hover { border-color: var(--border); }
  .name:focus { border-color: var(--ring); background: var(--card); }
  .count { font-size: 12px; color: var(--muted-foreground); white-space: nowrap; }
  .close {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
    flex: none;
  }
  .close:hover { background: var(--accent); }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 22px 10px;
    overflow: auto;
    padding: 4px 2px 6px;
    scrollbar-width: thin;
  }
  jg-app-tile { --tile: 58px; justify-self: center; }
`;

class JGFolderView extends JGElement {
  static styles = [base, sheet];

  #id = null;
  #release = null;

  set folder(id) {
    this.#id = id;
    this.refresh();
  }

  connectedCallback() {
    super.connectedCallback();
    this.#release = keys.overlay();
    this.keep(bus.on('layout:change', () => this.refresh()));
    this.listen(window, 'keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#release?.();
    this.#release = null;
  }

  close() {
    this.remove();
  }

  render() {
    const folder = this.#id ? layout.folder(this.#id) : null;
    if (!folder) return this.paint('');

    this.paint(html`
      <div class="panel">
        <header>
          <input class="name" value="${folder.name}" spellcheck="false" />
          <span class="count">${folder.items.length} tools</span>
          <button class="close" title="Close">✕</button>
        </header>
        <div class="grid">
          ${folder.items.map((id) => html`<jg-app-tile app-id="${id}"></jg-app-tile>`)}
        </div>
      </div>
    `);

    this.on(this.$('.close'), 'click', () => this.close());
    this.on(this, 'click', (event) => {
      if (event.target === this) this.close();
    });
    this.on(this.$('.name'), 'change', (event) => layout.renameFolder(folder.id, event.target.value.trim() || folder.name));
    this.bind('jg-app-tile', 'click', () => this.close());
    this.bind('jg-app-tile', 'tile:menu', (event) => {
      event.stopPropagation();
      const { appId, x, y } = event.detail;
      const meta = registry.find(appId);
      contextMenu({
        x,
        y,
        title: meta.name,
        items: [
          { label: 'Move out of folder', icon: 'arrowUp', action: () => layout.removeFromFolder(folder.id, appId) },
          { label: layout.dock().includes(appId) ? 'Remove from dock' : 'Add to dock', icon: 'dock', action: () => layout.toggleDock(appId) },
          meta.widget && { label: 'Add widget', icon: 'widget', action: () => layout.addWidget(appId) },
        ],
      });
    });
  }
}

define('jg-folder-view', JGFolderView);
