import { JGElement, define, css, html } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { base } from './styles.js';
import { commands } from '../core/commands.js';
import { clamp } from '../core/util.js';
import { icon } from './icons.js';
import { keys } from '../core/keys.js';

const sheet = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 620;
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
    width: min(560px, calc(100vw - 32px));
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
    padding: 13px 16px;
    border-bottom: 1px solid var(--border);
  }
  .search:focus-within { background: color-mix(in srgb, var(--ring) 7%, transparent); }
  .chevron {
    display: grid;
    place-items: center;
    flex: none;
    width: 20px;
    height: 20px;
    color: var(--muted-foreground);
  }
  .chevron svg { width: 17px; height: 17px; --icon-accent: currentColor; }
  input {
    flex: 1;
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 15.5px;
    outline: none;
  }
  input::placeholder { color: var(--muted-foreground); }
  input:focus, input:focus-visible { outline: none; box-shadow: none; }
  kbd {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 2px 6px;
    background: color-mix(in srgb, var(--muted) 60%, transparent);
    white-space: nowrap;
  }
  .results { max-height: min(52vh, 420px); overflow: auto; padding: 6px; }
  .group {
    padding: 9px 10px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    border: 0;
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }
  .item[data-active="true"] { background: var(--accent); }
  .glyph {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    flex: none;
    color: var(--muted-foreground);
    background: color-mix(in srgb, var(--muted) 65%, transparent);
  }
  .item[data-active="true"] .glyph { color: var(--foreground); }
  .glyph svg { width: 15px; height: 15px; --icon-accent: currentColor; }
  .meta { min-width: 0; flex: 1; }
  .name { font-size: 13.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 11.5px; color: var(--muted-foreground); }
  .value { font-size: 11.5px; color: var(--muted-foreground); font-family: var(--font-mono); flex: none; }
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

class JGCommands extends JGElement {
  static styles = [base, sheet];

  #query = '';
  #index = 0;
  #results = [];
  #release = null;

  open() {
    this.#query = '';
    this.#index = 0;
    this.#release ??= keys.overlay();
    this.setAttribute('open', '');
    this.refresh();
    queueMicrotask(() => {
      const input = this.$('input');
      input?.focus();
      input?.select();
    });
  }

  close() {
    this.#release?.();
    this.#release = null;
    this.removeAttribute('open');
    this.paint('');
  }

  get isOpen() {
    return this.hasAttribute('open');
  }

  render() {
    if (!this.isOpen) return this.paint('');

    this.paint(html`
      <div class="veil"></div>
      <div class="panel" role="dialog" aria-label="${t('commands.title', 'Commands')}">
        <div class="search">
          <span class="chevron">${icon('terminal', 17)}</span>
          <input type="text" placeholder="${t('commands.placeholder', 'Run a command...')}" spellcheck="false" />
          <kbd>esc</kbd>
        </div>
        <div class="results"></div>
        <div class="foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>⌘K</kbd> search tools</span>
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
    this.#results = commands.search(this.#query);
    this.#index = clamp(this.#index, 0, Math.max(0, this.#results.length - 1));

    const groups = [];
    this.#results.forEach((command) => {
      const name = command.group ?? 'Commands';
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.items.push(command);
      else groups.push({ name, items: [command] });
    });

    let cursor = -1;
    this.$('.results').innerHTML = this.#results.length
      ? groups.map(
          (group) => html`<div class="group">${group.name}</div>
            ${group.items.map((command) => {
              cursor += 1;
              return html`<button class="item" data-index="${cursor}" data-active="${String(cursor === this.#index)}">
                <span class="glyph">${icon(command.icon ?? 'sparkles', 15)}</span>
                <span class="meta">
                  <span class="name">${command.label}</span>
                  ${command.detail ? html`<span class="sub">${command.detail}</span>` : ''}
                </span>
                ${command.value ? html`<span class="value">${command.value}</span>` : ''}
                ${command.shortcut ? html`<kbd>${command.shortcut}</kbd>` : ''}
              </button>`;
            })}`,
        )
      : html`<div class="empty">No command matches "${this.#query}".</div>`;

    this.$$('.item').forEach((node) => {
      node.addEventListener('click', () => this.#run(Number(node.dataset.index)));
      node.addEventListener('pointerenter', () => {
        this.#index = Number(node.dataset.index);
        this.#highlight();
      });
    });
  }

  #highlight() {
    this.$$('.item').forEach((node) => {
      const active = Number(node.dataset.index) === this.#index;
      node.dataset.active = String(active);
      if (active) node.scrollIntoView({ block: 'nearest' });
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
      this.#run(this.#index);
    }
  }

  #run(index) {
    const command = this.#results[index];
    if (!command) return;
    this.close();
    queueMicrotask(() => command.action?.());
  }
}

define('jg-commands', JGCommands);
