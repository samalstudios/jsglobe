import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';

const statSheet = css`
  :host {
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 42%, transparent);
  }
  :host([plain]) { background: transparent; }
  :host([center]) { text-align: center; justify-items: center; }
  .value {
    font: 650 19px/1.15 var(--font-sans);
    letter-spacing: -0.02em;
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
  }
  :host([mono]) .value { font-family: var(--font-mono); font-size: 17px; }
  :host([tone="good"]) .value { color: var(--success); }
  :host([tone="bad"]) .value { color: var(--destructive); }
  :host([tone="warn"]) .value { color: var(--warning); }
  .name { font-size: 11px; color: var(--muted-foreground); }
  .note { font-size: 11px; color: var(--muted-foreground); }
`;

class JGStat extends JGElement {
  static styles = [base, statSheet];
  static observedAttributes = ['value', 'label', 'note'];

  render() {
    this.paint(html`
      <span class="value">${this.getAttribute('value') ?? '-'}</span>
      <span class="name">${this.getAttribute('label') ?? ''}</span>
      ${this.getAttribute('note') ? html`<span class="note">${this.getAttribute('note')}</span>` : ''}
    `);
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next || !this.$('.value')) return;
    if (name === 'value') this.$('.value').textContent = next ?? '-';
    else this.refresh();
  }
}

const meterSheet = css`
  :host { display: grid; gap: 5px; }
  .track {
    height: var(--meter-height, 7px);
    border-radius: 999px;
    background: var(--muted);
    overflow: hidden;
  }
  .fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--ring);
    transition: width 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
  }
  :host([tone="good"]) .fill { background: var(--success); }
  :host([tone="warn"]) .fill { background: var(--warning); }
  :host([tone="bad"]) .fill { background: var(--destructive); }
  .row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .label { font-size: 12px; color: var(--muted-foreground); }
  .amount { font-family: var(--font-mono); font-size: 11.5px; color: var(--muted-foreground); }
  .row:empty { display: none; }
`;

class JGMeter extends JGElement {
  static styles = [base, meterSheet];
  static observedAttributes = ['value', 'max', 'label', 'amount'];

  render() {
    const label = this.getAttribute('label');
    const amount = this.getAttribute('amount');
    this.paint(html`
      ${label || amount
        ? html`<span class="row">
            <span class="label">${label ?? ''}</span>
            <span class="amount">${amount ?? ''}</span>
          </span>`
        : ''}
      <span class="track"><i class="fill"></i></span>
    `);
    this.#fill();
  }

  #fill() {
    const value = Number(this.getAttribute('value') ?? 0);
    const max = Number(this.getAttribute('max') ?? 100) || 100;
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    const fill = this.$('.fill');
    if (fill) fill.style.width = `${percent.toFixed(1)}%`;
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next || !this.$('.track')) return;
    if (name === 'value' || name === 'max') this.#fill();
    else this.refresh();
  }
}

define('jg-stat', JGStat);
define('jg-meter', JGMeter);
