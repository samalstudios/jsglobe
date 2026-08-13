import { JGElement, define, css, html, raw } from '../core/dom.js';
import { base } from './styles.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    display: block;
    flex: none;
  }
  :host([hidden]) { display: none; }

  .bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 50%, transparent);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .bar::-webkit-scrollbar { display: none; }

  :host([variant="plain"]) .bar { border: 0; background: none; padding: 0; }
  :host([variant="sidebar"]) { height: 100%; }
  :host([variant="sidebar"]) .bar {
    flex-direction: column;
    align-items: stretch;
    height: 100%;
    width: var(--sidebar-width, 176px);
    padding: 8px;
    overflow-x: hidden;
    overflow-y: auto;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
    appearance: none;
    height: 30px;
    padding: 0 9px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted-foreground);
    font: 500 12.5px/1 var(--font-sans);
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
  }
  .item:hover:not(:disabled) { background: var(--accent); color: var(--foreground); }
  .item:disabled { opacity: 0.45; cursor: not-allowed; }
  .item:focus-visible { outline: none; border-color: color-mix(in srgb, var(--ring) 70%, transparent); box-shadow: var(--shadow-ring); }
  .item[aria-pressed="true"],
  .item[aria-current="true"] {
    background: var(--card);
    color: var(--foreground);
    border-color: var(--border);
    box-shadow: var(--shadow-sm);
  }
  .item[data-danger="true"]:hover:not(:disabled) {
    color: var(--destructive);
    background: color-mix(in srgb, var(--destructive) 12%, transparent);
  }
  .item svg { flex: none; }
  :host([variant="sidebar"]) .item { width: 100%; height: 32px; }
  :host([icons]) .item { padding: 0; width: 30px; justify-content: center; }
  :host([icons]) .item .text { display: none; }

  .count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted-foreground);
  }

  .sep {
    flex: none;
    width: 1px;
    align-self: stretch;
    margin: 2px 4px;
    background: var(--border);
  }
  :host([variant="sidebar"]) .sep { width: auto; height: 1px; margin: 6px 2px; }

  .group {
    flex: none;
    padding: 10px 9px 4px;
    font: 600 10.5px/1 var(--font-sans);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--muted-foreground) 85%, transparent);
  }

  .spacer { flex: 1; min-width: 6px; }
  .slot { display: flex; align-items: center; gap: 6px; flex: none; }
  :host([variant="sidebar"]) .slot { flex-direction: column; align-items: stretch; }
`;

class JGToolbar extends JGElement {
  static styles = [base, sheet];

  #items = [];
  #value = null;

  set items(next) {
    this.#items = Array.isArray(next) ? next.filter(Boolean) : [];
    this.refresh();
  }

  get items() {
    return this.#items;
  }

  set value(next) {
    this.#value = next ?? null;
    this.$$('.item').forEach((node) => {
      if (node.dataset.select === 'true') node.setAttribute('aria-current', String(node.dataset.id === this.#value));
    });
  }

  get value() {
    return this.#value;
  }

  update(id, patch) {
    const item = this.#items.find((entry) => entry.id === id);
    if (!item) return;
    Object.assign(item, patch);
    this.refresh();
  }

  render() {
    this.paint(html`
      <div class="bar" role="toolbar">
        ${this.#items.map((item) => this.#item(item))}
        <div class="slot"><slot></slot></div>
      </div>
    `);

    this.bind('.item', 'click', (event) => {
      const id = event.currentTarget.dataset.id;
      const item = this.#items.find((entry) => entry.id === id);
      if (!item || item.disabled) return;
      if (item.select) this.value = id;
      if (item.toggle) {
        item.active = !item.active;
        event.currentTarget.setAttribute('aria-pressed', String(item.active));
      }
      item.action?.(item);
      this.emit('select', { id, item });
    });
  }

  #item(item) {
    if (item.separator) return html`<div class="sep"></div>`;
    if (item.spacer) return html`<div class="spacer"></div>`;
    if (item.group) return html`<div class="group">${item.group}</div>`;

    const active = item.select ? this.#value === item.id : item.active;
    const state = item.select ? `aria-current="${String(Boolean(active))}"` : `aria-pressed="${String(Boolean(active))}"`;

    return html`<button
      class="item"
      type="button"
      data-id="${item.id}"
      data-select="${String(Boolean(item.select))}"
      data-danger="${String(Boolean(item.danger))}"
      title="${item.title ?? item.label ?? ''}"
      ${raw(state)}
      ${item.disabled ? raw('disabled') : ''}
    >
      ${item.icon ? icon(item.icon, 15) : ''}
      ${item.label ? html`<span class="text">${item.label}</span>` : ''}
      ${item.count === undefined ? '' : html`<span class="count">${item.count}</span>`}
    </button>`;
  }
}

define('jg-toolbar', JGToolbar);
