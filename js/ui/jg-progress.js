import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';

const sheet = css`
  :host { display: grid; gap: 6px; }
  :host([hidden]) { display: none; }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
  }
  .head:empty { display: none; }
  .label { color: var(--foreground); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .amount { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted-foreground); flex: none; }

  .track {
    position: relative;
    height: var(--progress-height, 6px);
    border-radius: 999px;
    background: color-mix(in srgb, var(--muted) 90%, var(--foreground) 6%);
    box-shadow: var(--shadow-well);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    width: 0;
    border-radius: 999px;
    background: linear-gradient(90deg,
      color-mix(in srgb, var(--ring) 80%, #fff 14%),
      var(--ring));
    transition: width 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  :host([tone="good"]) .fill { background: var(--success); }
  :host([tone="bad"]) .fill { background: var(--destructive); }

  :host([indeterminate]) .fill {
    width: 34% !important;
    animation: sweep 1.1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  }
  @keyframes sweep {
    from { transform: translateX(-110%); }
    to { transform: translateX(320%); }
  }

  :host([size="sm"]) { --progress-height: 4px; }
  :host([size="lg"]) { --progress-height: 10px; }
`;

class JGProgress extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['value', 'max', 'label', 'amount', 'indeterminate'];

  set value(next) {
    this.setAttribute('value', String(next));
  }

  get value() {
    return Number(this.getAttribute('value') ?? 0);
  }

  render() {
    this.paint(html`
      <div class="head">
        <span class="label">${this.getAttribute('label') ?? ''}</span>
        <span class="amount">${this.#amount()}</span>
      </div>
      <div
        class="track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="${this.getAttribute('max') ?? 100}"
        aria-valuenow="${this.getAttribute('value') ?? 0}"
      >
        <i class="fill"></i>
      </div>
    `);
    this.#fill();
  }

  #amount() {
    if (this.hasAttribute('amount')) return this.getAttribute('amount');
    if (this.hasAttribute('indeterminate')) return '';
    return `${Math.round(this.#percent())}%`;
  }

  #percent() {
    const max = Number(this.getAttribute('max') ?? 100) || 100;
    return Math.min(100, Math.max(0, (Number(this.getAttribute('value') ?? 0) / max) * 100));
  }

  #fill() {
    const fill = this.$('.fill');
    if (!fill) return;
    fill.style.width = this.hasAttribute('indeterminate') ? '34%' : `${this.#percent().toFixed(1)}%`;
    const track = this.$('.track');
    if (track) track.setAttribute('aria-valuenow', this.getAttribute('value') ?? 0);
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next || !this.$('.track')) return;
    if (name === 'value' || name === 'max' || name === 'indeterminate') {
      this.#fill();
      const amount = this.$('.amount');
      if (amount) amount.textContent = this.#amount();
      return;
    }
    this.refresh();
  }
}

define('jg-progress', JGProgress);
