import { JGElement, define, css, html } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { base } from './styles.js';

// A neutral ramp, then ten hues down five shades. Read across for a hue at one
// weight, down for the same hue darkening, which is how people look for a
// colour once there are more than a handful.
const SWATCHES = [
  '#ffffff', '#f4f4f5', '#e4e4e7', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a', '#000000',
  '#fca5a5', '#fdba74', '#fcd34d', '#86efac', '#5eead4', '#7dd3fc', '#93c5fd', '#a5b4fc', '#d8b4fe', '#f9a8d4',
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#dc2626', '#ea580c', '#d97706', '#16a34a', '#0d9488', '#0284c7', '#2563eb', '#4f46e5', '#9333ea', '#db2777',
  '#b91c1c', '#c2410c', '#b45309', '#15803d', '#0f766e', '#0369a1', '#1d4ed8', '#4338ca', '#7e22ce', '#be185d',
  '#7f1d1d', '#7c2d12', '#78350f', '#14532d', '#134e4a', '#0c4a6e', '#1e3a8a', '#312e81', '#581c87', '#831843',
];

// A page can only put something in the top layer where the browser has the
// popover API. Without it the sheet stays where it was, which is still right
// everywhere it is not boxed in.
const CAN_POP = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

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
    width: 272px;
    box-sizing: border-box;
    padding: 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    box-shadow: var(--shadow-md, 0 10px 28px rgba(0, 0, 0, 0.16));
  }
  :host([open]) .sheet { display: block; }
  :host([align="right"]) .sheet { left: auto; right: 0; }
  :host([drop="up"]) .sheet { top: auto; bottom: 36px; }

  /* in the top layer the sheet is placed against the trigger by hand, so the
     browser's own centring has to be cleared */
  .sheet[popover] {
    position: fixed;
    inset: auto;
    margin: 0;
    overflow: visible;
  }
  .sheet[popover]:popover-open { display: block; }
  .grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
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

    if (CAN_POP) this.$('.sheet').setAttribute('popover', 'manual');

    this.on(this.$('.trigger'), 'click', (event) => {
      event.stopPropagation();
      if (this.hasAttribute('open')) this.#shut();
      else this.#open();
    });

    this.on(this.$('.grid'), 'click', (event) => {
      const chip = event.target.closest('[data-colour]');
      if (!chip) return;
      this.#pick(chip.dataset.colour);
    });

    this.on(this.$('input[type="color"]'), 'input', (event) => this.#pick(event.target.value));
    const clear = this.$('.clear');
    if (clear) this.on(clear, 'click', () => this.#pick('transparent'));

    this.listen(document, 'click', () => this.#shut());
    // the sheet is placed against the trigger, so it has to follow it
    this.listen(window, 'resize', () => this.hasAttribute('open') && this.#place());
    this.listen(window, 'scroll', () => this.hasAttribute('open') && this.#place(), true);
  }

  #open() {
    const sheet = this.$('.sheet');
    if (CAN_POP) {
      try {
        sheet.showPopover();
      } catch {
        /* already showing */
      }
    }
    this.setAttribute('open', '');
    this.#place();
  }

  #shut() {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    const sheet = this.$('.sheet');
    if (!CAN_POP) return;
    try {
      sheet.hidePopover();
    } catch {
      /* already hidden */
    }
  }

  // the sheet opens beside the trigger, which is only the right place when
  // there is room for it there. In the top layer it carries no ancestor to be
  // placed against, so it is given viewport coordinates outright.
  #place() {
    const room = { width: window.innerWidth, height: window.innerHeight };
    // nothing to aim at while the page has no size, so leave the sheet be
    if (!room.width || !room.height) return;

    const here = this.getBoundingClientRect();
    const sheet = this.$('.sheet');
    if (!sheet) return;
    const width = sheet.offsetWidth || 272;
    const height = sheet.offsetHeight || 190;

    if (!CAN_POP) {
      if (here.left + width > room.width - 8) this.setAttribute('align', 'right');
      else this.removeAttribute('align');
      const below = room.height - here.bottom;
      if (below < height + 8 && here.top > below) this.setAttribute('drop', 'up');
      else this.removeAttribute('drop');
      return;
    }

    const left = Math.max(8, Math.min(here.left, room.width - width - 8));
    const below = room.height - here.bottom;
    const above = here.top;
    const top = below < height + 8 && above > below ? Math.max(8, here.top - height - 4) : here.bottom + 4;

    sheet.style.left = `${Math.round(left)}px`;
    sheet.style.top = `${Math.round(top)}px`;
  }

  #pick(colour) {
    this.value = colour;
    const bar = this.$('.bar');
    if (bar) bar.style.background = colour === 'transparent' ? 'var(--card)' : colour;
    this.#shut();
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
