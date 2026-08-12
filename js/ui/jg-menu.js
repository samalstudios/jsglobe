import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { clamp } from '../core/util.js';

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
    min-width: 196px;
    max-width: 260px;
    padding: 5px;
    border-radius: var(--radius-lg);
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    animation: pop 0.14s cubic-bezier(0.2, 0.9, 0.3, 1.2);
    transform-origin: top left;
  }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.94); }
    to { opacity: 1; transform: none; }
  }
  .title {
    padding: 7px 10px 6px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--muted-foreground);
    letter-spacing: 0.02em;
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
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  button:hover:not(:disabled) { background: var(--accent); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button.danger { color: var(--destructive); }
  .glyph { width: 16px; text-align: center; opacity: 0.8; font-size: 12px; }
  .shortcut { margin-left: auto; font-size: 11px; color: var(--muted-foreground); font-family: var(--font-mono); }
  hr { height: 1px; border: 0; background: var(--border); margin: 4px 2px; }
`;

class JGMenu extends JGElement {
  static styles = [base, sheet];

  #items = [];

  open({ x, y, title, items }) {
    this.#items = items.filter(Boolean);
    this.dataset.title = title ?? '';
    this.setAttribute('open', '');
    this.refresh();
    const menu = this.$('.menu');
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    menu.style.left = `${clamp(x, 8, window.innerWidth - width - 8)}px`;
    menu.style.top = `${clamp(y, 8, window.innerHeight - height - 8)}px`;
  }

  close() {
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
                <span class="glyph">${item.glyph ?? ''}</span>
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
