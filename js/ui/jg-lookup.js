import { JGElement, define, css, html } from '../core/dom.js';
import { t } from '../core/i18n.js';
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
    width: max(100%, 208px);
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    box-shadow: var(--shadow-md, 0 12px 30px rgba(0, 0, 0, 0.18));
  }
  :host([open]) .sheet { display: block; }

  .hunt {
    width: 100%;
    height: 28px;
    padding: 0 9px;
    margin-bottom: 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--background);
    color: var(--foreground);
    font: 500 12.5px/1 var(--font-sans);
    outline: 0;
  }
  .hunt:focus { border-color: var(--ring); }

  .list { max-height: 252px; overflow: auto; display: flex; flex-direction: column; gap: 1px; }
  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 0;
    background: transparent;
    padding: 7px 9px;
    border-radius: var(--radius-sm);
    color: var(--foreground);
    font: 500 13px/1.25 var(--font-sans);
    cursor: pointer;
    text-align: left;
  }
  .entry:hover, .entry[data-here="true"] { background: var(--accent); }
  .entry[aria-selected="true"] { background: color-mix(in srgb, var(--ring) 16%, var(--card)); }
  .entry em { font-style: normal; opacity: 0.5; font-size: 11px; flex: none; }
  .none { padding: 10px; font: 400 12px/1.4 var(--font-sans); color: var(--muted-foreground); }
`;

class JGLookup extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['value'];

  #items = [];
  #shown = [];
  #here = -1;

  set items(list) {
    this.#items = (list ?? []).map((item) => (typeof item === 'object' ? item : { value: item, label: item }));
    this.#shown = this.#items;
    this.refresh();
  }

  get items() {
    return this.#items;
  }

  get value() {
    return this.getAttribute('value') ?? '';
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
      <button class="field" part="field">
        <span class="now" style="${now?.style ?? ''}">${now?.label ?? this.getAttribute('placeholder') ?? ''}</span>
        ${icon('chevronDown', 13)}
      </button>
      <div class="sheet">
        <input class="hunt" type="text" spellcheck="false" autocomplete="off"
          placeholder="${this.getAttribute('hunt') ?? t('action.search', 'Search')}" />
        <div class="list"></div>
      </div>
    `);

    this.#paintList();

    this.on(this.$('.field'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('.field'), 'click', (event) => {
      event.stopPropagation();
      this.#toggle(!this.hasAttribute('open'));
    });

    this.on(this.$('.list'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('.list'), 'click', (event) => {
      const entry = event.target.closest('[data-value]');
      if (entry) this.#choose(entry.dataset.value);
    });

    const hunt = this.$('.hunt');
    this.on(hunt, 'input', () => {
      const term = hunt.value.trim().toLowerCase();
      const onLabel = this.#items.filter((item) => String(item.label).toLowerCase().includes(term));
      this.#shown = !term
        ? this.#items
        : onLabel.length
          ? onLabel
          : this.#items.filter((item) => String(item.value).toLowerCase().includes(term));
      this.#here = this.#shown.length ? 0 : -1;
      this.#paintList();
    });
    this.on(hunt, 'keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!this.#shown.length) return;
        this.#here = (this.#here + (event.key === 'ArrowDown' ? 1 : -1) + this.#shown.length) % this.#shown.length;
        this.#paintList();
        this.$$('.entry')[this.#here]?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const pick = this.#shown[this.#here] ?? this.#shown[0];
        if (pick) this.#choose(pick.value);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.#toggle(false);
      }
    });

    this.listen(document, 'click', () => this.#toggle(false));
  }

  #paintList() {
    const list = this.$('.list');
    if (!list) return;
    list.innerHTML = this.#shown.length
      ? this.#shown
          .map(
            (item, index) =>
              `<button class="entry" data-value="${String(item.value).replace(/"/g, '&quot;')}" data-here="${index === this.#here}" aria-selected="${String(item.value) === String(this.value)}" style="${item.style ?? ''}">${item.label}${item.hint ? `<em>${item.hint}</em>` : ''}</button>`,
          )
          .join('')
      : `<div class="none">${t('search.nothing', 'Nothing matches')}</div>`;
  }

  #toggle(open) {
    if (open) {
      this.setAttribute('open', '');
      this.#shown = this.#items;
      this.#here = this.#items.findIndex((item) => String(item.value) === String(this.value));
      this.#paintList();
      const hunt = this.$('.hunt');
      if (hunt) {
        hunt.value = '';
        queueMicrotask(() => hunt.focus());
      }
      this.$('.entry[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    } else {
      this.removeAttribute('open');
    }
  }

  #choose(value) {
    const item = this.#items.find((entry) => String(entry.value) === String(value));
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

define('jg-lookup', JGLookup);
