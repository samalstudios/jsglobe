import { JGElement, define, css, html, raw } from '../core/dom.js';
import { base } from './styles.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    display: block;
    flex: none;
    min-width: 0;
    max-width: 100%;
  }
  :host([hidden]) { display: none; }

  .bar {
    position: relative;
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 55%, transparent);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .bar::-webkit-scrollbar { display: none; }

  /* fade the edge the bar can still scroll towards */
  :host([data-overflow="end"]) .bar { mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent); }
  :host([data-overflow="start"]) .bar { mask-image: linear-gradient(to left, #000 calc(100% - 28px), transparent); }
  :host([data-overflow="both"]) .bar {
    mask-image: linear-gradient(to right, transparent, #000 28px, #000 calc(100% - 28px), transparent);
  }

  :host([variant="plain"]) .bar { border: 0; background: none; padding: 0.1em; gap: 4px; }
  :host([variant="plain"]) .item { padding: 0 11px; }

  :host([variant="sidebar"]) { height: 100%; }
  :host([variant="sidebar"]) .bar {
    flex-direction: column;
    align-items: stretch;
    height: 100%;
    width: var(--sidebar-width, 176px);
    padding: 10px;
    border: 0;
    border-radius: 0;
    background: none;
    overflow-x: hidden;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }
  :host([variant="sidebar"]) .bar::-webkit-scrollbar { display: block; width: 9px; }
  :host([variant="sidebar"]) .bar::-webkit-scrollbar-thumb {
    background: var(--border-strong);
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
  }

  .item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 7px;
    flex: none;
    appearance: none;
    height: 32px;
    min-width: 32px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted-foreground);
    font: 500 12.5px/1 var(--font-sans);
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.13s ease, color 0.13s ease, box-shadow 0.13s ease;
  }
  .item:hover:not(:disabled) {
    background: color-mix(in srgb, var(--foreground) 7%, transparent);
    color: var(--foreground);
  }
  .item:active:not(:disabled) { background: color-mix(in srgb, var(--foreground) 11%, transparent); }
  .item:disabled { opacity: 0.4; cursor: not-allowed; }
  .item:focus-visible { outline: none; box-shadow: var(--shadow-ring); }

  .item[aria-pressed="true"],
  .item[aria-current="true"] {
    background: color-mix(in srgb, var(--ring) 15%, transparent);
    color: var(--foreground);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ring) 30%, transparent);
  }
  .item[aria-pressed="true"]:hover,
  .item[aria-current="true"]:hover { background: color-mix(in srgb, var(--ring) 22%, transparent); }
  .item[aria-pressed="true"] svg,
  .item[aria-current="true"] svg { color: var(--ring); }

  /* run, pause and stop read as what they do */
  .item[data-tone="run"] { background: color-mix(in srgb, var(--success) 13%, transparent); color: var(--foreground); }
  .item[data-tone="run"]:hover:not(:disabled) { background: color-mix(in srgb, var(--success) 21%, transparent); }
  .item[data-tone="run"] svg { color: var(--success); }
  .item[data-tone="pause"] { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--foreground); }
  .item[data-tone="pause"]:hover:not(:disabled) { background: color-mix(in srgb, var(--warning) 24%, transparent); }
  .item[data-tone="pause"] svg { color: var(--warning); }
  .item[data-tone="stop"] { color: var(--foreground); }
  .item[data-tone="stop"]:hover:not(:disabled) { background: color-mix(in srgb, var(--destructive) 14%, transparent); }
  .item[data-tone="stop"] svg { color: var(--destructive); }

  .item[data-danger="true"]:hover:not(:disabled) {
    color: var(--destructive);
    background: color-mix(in srgb, var(--destructive) 13%, transparent);
  }

  .item svg { flex: none; width: 16px; height: 16px; }
  :host([variant="sidebar"]) .item { width: 100%; height: 34px; }
  :host([icons]) .item,
  .item[data-icon-only="true"] { padding: 0; width: 32px; justify-content: center; }
  :host([icons]) .item .text,
  .item[data-icon-only="true"] .text { display: none; }

  .count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted-foreground);
  }

  /* a separator is breathing room first and a hairline second */
  .sep {
    flex: none;
    width: 1px;
    align-self: stretch;
    margin: 6px 7px;
    background: color-mix(in srgb, var(--border-strong) 50%, transparent);
  }
  :host([variant="sidebar"]) .sep { width: auto; height: 1px; margin: 8px 4px; }

  .group {
    flex: none;
    padding: 12px 8px 5px;
    font: 600 10px/1 var(--font-sans);
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--muted-foreground) 80%, transparent);
  }

  .spacer { flex: 1; min-width: 8px; }
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

    this.#watchOverflow();
  }

  #watchOverflow() {
    const bar = this.$('.bar');
    if (!bar || this.getAttribute('variant') === 'sidebar') return;

    const mark = () => {
      const slack = bar.scrollWidth - bar.clientWidth;
      if (slack < 2) {
        this.removeAttribute('data-overflow');
        return;
      }
      const start = bar.scrollLeft > 1;
      const end = bar.scrollLeft < slack - 1;
      this.dataset.overflow = start && end ? 'both' : start ? 'start' : 'end';
    };

    this.on(bar, 'scroll', mark, { passive: true });
    const observer = new ResizeObserver(mark);
    observer.observe(bar);
    this.track(() => observer.disconnect());
    mark();
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
      data-tone="${item.tone ?? ''}"
      data-icon-only="${String(Boolean(item.iconOnly))}"
      title="${item.title ?? item.label ?? ''}"
      ${raw(state)}
      ${item.disabled ? raw('disabled') : ''}
    >
      ${item.icon ? icon(item.icon, 16) : ''}
      ${item.label ? html`<span class="text">${item.label}</span>` : ''}
      ${item.count === undefined ? '' : html`<span class="count">${item.count}</span>`}
    </button>`;
  }
}

define('jg-toolbar', JGToolbar);
