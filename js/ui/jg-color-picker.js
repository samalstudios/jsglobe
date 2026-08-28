import { JGElement, define, css, html } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { base } from './styles.js';

const SWATCHES = [
  '#000000', '#3d444b', '#6b747d', '#9aa3ac', '#c9d0d8', '#ffffff',
  '#c02a2a', '#e0553d', '#c2691b', '#e0a02a', '#7ea62b', '#1d7a45',
  '#0d7b8a', '#3b6fd4', '#5b53c9', '#6c3fa8', '#a01f6f', '#d1477f',
];

const sheet = css`
  :host { display: inline-block; position: relative; }
  .trigger {
    display: inline-grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    position: relative;
  }
  .trigger:hover { background: var(--accent); color: var(--foreground); }
  :host([open]) .trigger { background: var(--accent); color: var(--foreground); }
  .trigger .bar {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 4px;
    height: 3px;
    border-radius: 2px;
    border: 1px solid color-mix(in srgb, var(--foreground) 20%, transparent);
  }
  .sheet {
    position: absolute;
    top: 36px;
    left: 0;
    z-index: 40;
    display: none;
    width: 214px;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    box-shadow: var(--shadow-md, 0 10px 28px rgba(0, 0, 0, 0.16));
  }
  :host([open]) .sheet { display: block; }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
  .chip {
    aspect-ratio: 1;
    border-radius: 5px;
    border: 1px solid color-mix(in srgb, var(--foreground) 14%, transparent);
    cursor: pointer;
    padding: 0;
  }
  .chip:hover { outline: 2px solid var(--ring); outline-offset: 1px; }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 9px;
    padding-top: 9px;
    border-top: 1px solid var(--border);
  }
  .row label { font: 500 11.5px/1 var(--font-sans); color: var(--muted-foreground); cursor: pointer; }
  input[type="color"] { width: 30px; height: 24px; padding: 0; border: 0; background: none; cursor: pointer; }
  .clear {
    margin-left: auto;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted-foreground);
    border-radius: 999px;
    padding: 4px 9px;
    font: 500 11px/1 var(--font-sans);
    cursor: pointer;
  }
  .clear:hover { color: var(--foreground); border-color: var(--ring); }
`;

class JGColorPicker extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['value', 'label'];

  get value() {
    return this.getAttribute('value') ?? '#000000';
  }

  set value(next) {
    this.setAttribute('value', next ?? '#000000');
  }

  render() {
    this.paint(html`
      <button class="trigger" part="trigger" title="${this.getAttribute('label') ?? t('color.pick', 'Pick a colour')}">
        <slot></slot>
        <span class="bar" style="background:${this.value}"></span>
      </button>
      <div class="sheet">
        <div class="grid">
          ${SWATCHES.map((colour) => html`<button class="chip" data-colour="${colour}" style="background:${colour}" title="${colour}"></button>`)}
        </div>
        <div class="row">
          <input type="color" value="${/^#[0-9a-f]{6}$/i.test(this.value) ? this.value : '#000000'}" />
          <label>${t('color.custom', 'Custom')}</label>
          ${this.hasAttribute('clearable') ? html`<button class="clear">${t('color.none', 'None')}</button>` : ''}
        </div>
      </div>
    `);

    this.on(this.$('.trigger'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('.sheet'), 'mousedown', (event) => event.preventDefault());

    this.on(this.$('.trigger'), 'click', (event) => {
      event.stopPropagation();
      const open = !this.hasAttribute('open');
      if (open) this.setAttribute('open', '');
      else this.removeAttribute('open');
    });

    this.on(this.$('.grid'), 'click', (event) => {
      const chip = event.target.closest('[data-colour]');
      if (!chip) return;
      this.#pick(chip.dataset.colour);
    });

    this.on(this.$('input[type="color"]'), 'input', (event) => this.#pick(event.target.value));
    const clear = this.$('.clear');
    if (clear) this.on(clear, 'click', () => this.#pick('transparent'));

    this.listen(document, 'click', () => this.removeAttribute('open'));
  }

  #pick(colour) {
    this.value = colour;
    const bar = this.$('.bar');
    if (bar) bar.style.background = colour === 'transparent' ? 'var(--card)' : colour;
    this.removeAttribute('open');
    this.emit('change', { value: colour });
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'value' && previous !== next) {
      const bar = this.$('.bar');
      if (bar) bar.style.background = next === 'transparent' ? 'var(--card)' : next;
    }
  }
}

define('jg-color-picker', JGColorPicker);
