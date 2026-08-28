import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { icon } from './icons.js';

const STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96];

const sheet = css`
  :host { display: inline-flex; position: relative; }
  .box {
    display: flex;
    align-items: center;
    height: 30px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    overflow: hidden;
  }
  .box:focus-within { border-color: var(--ring); }
  button {
    width: 24px;
    height: 100%;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  button:hover { background: var(--accent); color: var(--foreground); }
  input {
    width: 38px;
    height: 100%;
    border: 0;
    background: transparent;
    color: var(--foreground);
    text-align: center;
    font: 500 12.5px/1 var(--font-mono);
    outline: 0;
    appearance: textfield;
  }
  input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { appearance: none; margin: 0; }
  .caret { width: 20px; border-left: 1px solid var(--border); }
  .sheet {
    position: absolute;
    top: 34px;
    right: 0;
    z-index: 60;
    display: none;
    max-height: 260px;
    overflow: auto;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    box-shadow: var(--shadow-md, 0 12px 30px rgba(0, 0, 0, 0.18));
  }
  :host([open]) .sheet { display: block; }
  .step {
    display: block;
    width: 62px;
    border: 0;
    background: transparent;
    padding: 6px 9px;
    border-radius: var(--radius-sm);
    color: var(--foreground);
    font: 500 12.5px/1 var(--font-mono);
    cursor: pointer;
    text-align: left;
  }
  .step:hover { background: var(--accent); }
  .step[aria-selected="true"] { background: color-mix(in srgb, var(--ring) 16%, var(--card)); }
`;

class JGSizeSelector extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['value'];

  get value() {
    return Number(this.getAttribute('value') ?? 11);
  }

  set value(next) {
    this.setAttribute('value', String(this.#clamp(next)));
  }

  #clamp(value) {
    const number = Math.round(Number(value) || 11);
    return Math.max(1, Math.min(400, number));
  }

  render() {
    this.paint(html`
      <div class="box">
        <button class="down" title="-">${icon('minus', 13)}</button>
        <input type="number" value="${this.value}" min="1" max="400" />
        <button class="up" title="+">${icon('plus', 13)}</button>
        <button class="caret">${icon('chevronDown', 12)}</button>
      </div>
      <div class="sheet">
        ${STEPS.map((size) => html`<button class="step" data-size="${size}" aria-selected="${String(size === this.value)}">${size}</button>`)}
      </div>
    `);

    const input = this.$('input');
    this.$$('button').forEach((button) => this.on(button, 'mousedown', (event) => event.preventDefault()));

    this.on(this.$('.down'), 'click', () => this.#step(-1));
    this.on(this.$('.up'), 'click', () => this.#step(1));
    this.on(this.$('.caret'), 'click', (event) => {
      event.stopPropagation();
      if (this.hasAttribute('open')) this.removeAttribute('open');
      else this.setAttribute('open', '');
    });
    this.on(this.$('.sheet'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('.sheet'), 'click', (event) => {
      const step = event.target.closest('[data-size]');
      if (!step) return;
      this.removeAttribute('open');
      this.#settle(step.dataset.size);
    });

    this.on(input, 'change', () => this.#settle(input.value));
    this.on(input, 'keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.#settle(input.value);
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.#step(event.key === 'ArrowUp' ? 1 : -1);
      }
    });

    this.listen(document, 'click', () => this.removeAttribute('open'));
  }

  #step(direction) {
    const now = this.value;
    const at = STEPS.indexOf(now);
    const next = at === -1 ? now + direction : STEPS[Math.max(0, Math.min(STEPS.length - 1, at + direction))];
    this.#settle(next);
  }

  #settle(raw) {
    const next = this.#clamp(raw);
    this.setAttribute('value', String(next));
    const input = this.$('input');
    if (input) input.value = String(next);
    this.$$('.step').forEach((step) => step.setAttribute('aria-selected', String(Number(step.dataset.size) === next)));
    this.emit('change', { value: next });
  }

  attributeChangedCallback(name, previous, next) {
    if (name === 'value' && previous !== next) {
      const input = this.$('input');
      if (input) input.value = String(this.#clamp(next));
    }
  }
}

define('jg-size-selector', JGSizeSelector);
