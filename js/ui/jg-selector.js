import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { icon } from './icons.js';

const sheet = css`
  :host { display: inline-block; position: relative; }
  .field {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    height: 30px;
    padding: 0 8px 0 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--foreground);
    font: 500 12.5px/1 var(--font-sans);
    cursor: pointer;
    text-align: left;
  }
  .field:hover { border-color: var(--border-strong, var(--ring)); }
  :host([open]) .field { border-color: var(--ring); }
  .field .now { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .field svg { flex: none; opacity: 0.55; }

  .sheet {
    position: absolute;
    top: 34px;
    left: 0;
    z-index: 60;
    display: none;
    min-width: 100%;
    max-height: 288px;
    overflow: auto;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    box-shadow: var(--shadow-md, 0 12px 30px rgba(0, 0, 0, 0.18));
  }
  :host([open]) .sheet { display: block; }
  :host([align="right"]) .sheet { left: auto; right: 0; }
  :host([drop="up"]) .sheet { top: auto; bottom: 34px; }

  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    border: 0;
    background: transparent;
    padding: 7px 9px;
    border-radius: var(--radius-sm);
    color: var(--foreground);
    font: 500 12.5px/1.2 var(--font-sans);
    cursor: pointer;
    text-align: left;
  }
  .entry:hover, .entry[data-here="true"] { background: var(--accent); }
  .entry[aria-selected="true"] { background: color-mix(in srgb, var(--ring) 16%, var(--card)); }
  .entry em { font-style: normal; opacity: 0.55; font-size: 11px; }
`;

class JGSelector extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['value'];

  #items = [];
  #here = -1;

  set items(list) {
    this.#items = (list ?? []).map((item) => (typeof item === 'object' ? item : { value: item, label: item }));
    this.refresh();
  }

  get items() {
    return this.#items;
  }

  get value() {
    return this.getAttribute('value') ?? this.#items[0]?.value ?? '';
  }

  set value(next) {
    this.setAttribute('value', String(next ?? ''));
  }

  get current() {
    return this.#items.find((item) => String(item.value) === String(this.value));
  }

  render() {
    const now = this.current;
    this.paint(html`
      <button class="field" part="field" aria-haspopup="listbox">
        <span class="now" style="${now?.style ?? ''}">${now?.label ?? this.getAttribute('placeholder') ?? ''}</span>
        ${icon('chevronDown', 13)}
      </button>
      <div class="sheet" role="listbox">
        ${this.#items.map(
          (item, index) => html`<button class="entry" role="option" data-index="${index}"
            aria-selected="${String(String(item.value) === String(this.value))}"
            style="${item.style ?? ''}">${item.label}${item.hint ? html`<em>${item.hint}</em>` : ''}</button>`,
        )}
      </div>
    `);

    this.on(this.$('.field'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('.sheet'), 'mousedown', (event) => event.preventDefault());

    this.on(this.$('.field'), 'click', (event) => {
      event.stopPropagation();
      this.#toggle(!this.hasAttribute('open'));
    });

    this.on(this.$('.sheet'), 'click', (event) => {
      const entry = event.target.closest('[data-index]');
      if (!entry) return;
      this.#choose(Number(entry.dataset.index));
    });

    this.on(this, 'keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!this.hasAttribute('open')) return this.#toggle(true);
        this.#move(event.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (event.key === 'Enter' && this.hasAttribute('open')) {
        event.preventDefault();
        this.#choose(this.#here);
        return;
      }
      if (event.key === 'Escape' && this.hasAttribute('open')) {
        event.preventDefault();
        event.stopPropagation();
        this.#toggle(false);
      }
    });

    this.listen(document, 'click', () => this.#toggle(false));
  }

  // a list that would run off the bottom of the window opens upwards instead
  #aim() {
    const box = this.getBoundingClientRect();
    const sheet = this.$('.sheet');
    const tall = Math.min(sheet?.scrollHeight || 0, 288) + 40;
    const below = window.innerHeight - box.bottom;
    if (below < tall && box.top > below) this.setAttribute('drop', 'up');
    else this.removeAttribute('drop');
  }

  #toggle(open) {
    if (open) {
      this.setAttribute('open', '');
      this.#aim();
      this.#here = this.#items.findIndex((item) => String(item.value) === String(this.value));
      this.#mark();
      this.$('.entry[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    } else {
      this.removeAttribute('open');
    }
  }

  #move(step) {
    if (!this.#items.length) return;
    this.#here = (this.#here + step + this.#items.length) % this.#items.length;
    this.#mark();
    this.$$('.entry')[this.#here]?.scrollIntoView({ block: 'nearest' });
  }

  #mark() {
    this.$$('.entry').forEach((entry, index) => {
      entry.dataset.here = String(index === this.#here);
    });
  }

  #choose(index) {
    const item = this.#items[index];
    if (!item) return;
    this.value = item.value;
    this.#toggle(false);
    this.refresh();
    this.emit('change', { value: item.value, item });
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'value' && previous !== next && this.shadowRoot?.childElementCount) this.refresh();
  }
}

define('jg-selector', JGSelector);
