import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { clamp } from '../core/util.js';
import { keys } from '../core/keys.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 900;
    display: none;
  }
  :host([open]) { display: block; }
  .backdrop { position: absolute; inset: 0; }
  .menu {
    position: absolute;
    min-width: 200px;
    max-width: 264px;
    padding: 5px;
    border-radius: 12px;
    background: var(--glass-strong);
    backdrop-filter: saturate(180%) blur(30px);
    -webkit-backdrop-filter: saturate(180%) blur(30px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 10px 30px -6px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.08);
    animation: pop 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.15);
    transform-origin: top left;
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.94); }
    to { opacity: 1; transform: none; }
  }
  .title {
    padding: 6px 10px 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted-foreground);
    letter-spacing: 0.01em;
  }
  button {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 13px;
    text-align: left;
    padding: 5px 10px;
    min-height: 28px;
    border-radius: 7px;
    cursor: default;
  }
  button:hover:not(:disabled) { background: var(--ring); color: #fff; }
  button:hover:not(:disabled) .shortcut { color: rgba(255, 255, 255, 0.75); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button.danger { color: var(--destructive); }
  .glyph {
    display: grid;
    place-items: center;
    width: 16px;
    flex: none;
    text-align: center;
    font-size: 12px;
    color: var(--muted-foreground);
  }
  .glyph svg { --icon-accent: currentColor; stroke-width: 1.7; }
  button:hover:not(:disabled) .glyph { color: #fff; }
  button.danger .glyph { color: inherit; }
  button.danger:hover:not(:disabled) { background: var(--destructive); color: #fff; }
  .shortcut { margin-left: auto; font-size: 11px; color: var(--muted-foreground); font-family: var(--font-mono); }
  hr { height: 1px; border: 0; background: var(--border); margin: 4px 10px; }
`;

class JGMenu extends JGElement {
  static styles = [base, sheet];

  #items = [];
  #release = null;

  open({ x, y, title, items }) {
    this.#items = items.filter(Boolean);
    this.dataset.title = title ?? '';
    this.#release ??= keys.overlay();
    this.setAttribute('open', '');
    this.refresh();
    const menu = this.$('.menu');
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    menu.style.left = `${clamp(x, 8, window.innerWidth - width - 8)}px`;
    menu.style.top = `${clamp(y, 8, window.innerHeight - height - 8)}px`;
  }

  close() {
    this.#release?.();
    this.#release = null;
    this.removeAttribute('open');
    this.#items = [];
    this.paint('');
  }

  render() {
    if (!this.hasAttribute('open')) return this.paint('');
    this.paint(html`
      <div class="backdrop"></div>
      <div class="menu" role="menu">
        ${this.dataset.title ? html`<div class="title">${this.dataset.title}</div>` : ''}
        ${this.#items.map((item, index) =>
          item.separator
            ? html`<hr />`
            : html`<button type="button" role="menuitem" data-index="${index}" class="${item.danger ? 'danger' : ''}">
                <span class="glyph">${item.icon ? icon(item.icon, 15) : (item.glyph ?? '')}</span>
                <span>${item.label}</span>
                ${item.shortcut ? html`<span class="shortcut">${item.shortcut}</span>` : ''}
              </button>`,
        )}
      </div>
    `);
    this.$$('button').forEach((node, order) => {
      const item = this.#items[Number(node.dataset.index)];
      node.disabled = Boolean(item.disabled);
      if (order === 0) queueMicrotask(() => node.focus());
    });
    this.bind('button', 'click', (event) => {
      const item = this.#items[Number(event.currentTarget.dataset.index)];
      this.close();
      item.action?.();
    });
    this.on(this.$('.backdrop'), 'pointerdown', () => this.close());
    this.on(this.$('.backdrop'), 'contextmenu', (event) => {
      event.preventDefault();
      this.close();
    });
    this.on(window, 'keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  }
}

define('jg-menu', JGMenu);

let singleton = null;

export function contextMenu(options) {
  if (!singleton) {
    singleton = document.createElement('jg-menu');
    document.body.append(singleton);
  }
  singleton.open(options);
  return singleton;
}
