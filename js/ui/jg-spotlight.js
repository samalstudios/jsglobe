import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { registry } from '../core/registry.js';
import { router } from '../core/router.js';
import { clamp } from '../core/util.js';
import { icon } from './icons.js';

const sheet = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 600;
    display: none;
  }
  :host([open]) { display: block; }
  .veil {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--background) 55%, transparent);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    animation: fade 0.16s ease;
  }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  .panel {
    position: relative;
    width: min(640px, calc(100vw - 32px));
    margin: max(12vh, 60px) auto 0;
    border-radius: var(--radius-xl);
    background: var(--glass-strong);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    animation: rise 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.1);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(-10px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
  }
  .glass { color: var(--muted-foreground); font-size: 15px; }
  input {
    flex: 1;
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 16px;
    outline: none;
  }
  input::placeholder { color: var(--muted-foreground); }
  kbd {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 2px 6px;
    background: color-mix(in srgb, var(--muted) 60%, transparent);
  }
  .results { max-height: min(52vh, 420px); overflow: auto; padding: 6px; }
  .group {
    padding: 8px 10px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }
  .item {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 9px 10px;
    border-radius: var(--radius-md);
    border: 0;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }
  .item[data-active="true"] { background: var(--accent); }
  .badge {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: var(--tint);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    flex: none;
  }
  .meta { min-width: 0; flex: 1; }
  .name { font-size: 13.5px; font-weight: 600; }
  .tag { font-size: 12px; color: var(--muted-foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .path { font-family: var(--font-mono); font-size: 11px; color: var(--muted-foreground); }
  .empty { padding: 26px 16px; text-align: center; color: var(--muted-foreground); font-size: 13px; }
  .foot {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 8px 14px;
    border-top: 1px solid var(--border);
    font-size: 11.5px;
    color: var(--muted-foreground);
  }
`;

class JGSpotlight extends JGElement {
  static styles = [base, sheet];

  #query = '';
  #index = 0;
  #results = [];

  open(initial = '') {
    this.#query = initial;
    this.#index = 0;
    this.setAttribute('open', '');
    this.refresh();
    queueMicrotask(() => {
      const input = this.$('input');
      input?.focus();
      input?.select();
    });
  }

  close() {
    this.removeAttribute('open');
    this.paint('');
    this.emit('spotlight:close');
  }

  get isOpen() {
    return this.hasAttribute('open');
  }

  render() {
    if (!this.isOpen) return this.paint('');

    this.paint(html`
      <div class="veil"></div>
      <div class="panel" role="dialog" aria-label="Search apps">
        <div class="search">
          <span class="glass">⌕</span>
          <input type="text" placeholder="Search tools, formats, keywords..." value="${this.#query}" spellcheck="false" />
          <kbd>esc</kbd>
        </div>
        <div class="results"></div>
        <div class="foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span>${registry.all().length} tools installed</span>
        </div>
      </div>
    `);

    const input = this.$('input');
    this.on(input, 'input', () => {
      this.#query = input.value;
      this.#index = 0;
      this.#renderResults();
    });
    this.on(input, 'keydown', (event) => this.#keys(event));
    this.on(this.$('.veil'), 'click', () => this.close());
    this.#renderResults();
  }

  #renderResults() {
    this.#results = this.#query.trim() ? registry.search(this.#query, 20) : registry.all().slice(0, 8);
    this.#index = clamp(this.#index, 0, Math.max(0, this.#results.length - 1));

    this.$('.results').innerHTML = this.#results.length
      ? html`<div class="group">${this.#query.trim() ? 'Results' : 'Suggestions'}</div>
          ${this.#results.map(
            (app, index) => html`<button
              class="item"
              data-id="${app.id}"
              data-active="${String(index === this.#index)}"
              style="--tint:${app.tint}"
            >
              <span class="badge">${icon(app.icon, 16)}</span>
              <span class="meta">
                <span class="name">${app.name}</span>
                <span class="tag">${app.tagline}</span>
              </span>
              <span class="path">/${app.id}</span>
            </button>`,
          )}`
      : html`<div class="empty">No tools match "${this.#query}".</div>`;

    this.$$('.item').forEach((node) => {
      node.addEventListener('click', () => this.#launch(node.dataset.id));
      node.addEventListener('pointerenter', () => {
        this.#index = this.#results.findIndex((app) => app.id === node.dataset.id);
        this.#highlight();
      });
    });
  }

  #highlight() {
    this.$$('.item').forEach((node, index) => {
      node.dataset.active = String(index === this.#index);
      if (index === this.#index) node.scrollIntoView({ block: 'nearest' });
    });
  }

  #keys(event) {
    if (event.key === 'Escape') return this.close();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.#index = (this.#index + 1) % Math.max(1, this.#results.length);
      this.#highlight();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.#index = (this.#index - 1 + this.#results.length) % Math.max(1, this.#results.length);
      this.#highlight();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const app = this.#results[this.#index];
      if (app) this.#launch(app.id);
    }
  }

  #launch(id) {
    this.close();
    router.app(id);
  }
}

define('jg-spotlight', JGSpotlight);
