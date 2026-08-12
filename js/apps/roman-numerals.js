import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .value { font-family: var(--font-mono); font-size: 26px; letter-spacing: 0.06em; }
  .table { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 6px; }
  .pair {
    display: flex;
    justify-content: space-between;
    padding: 6px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 12px;
  }
`;

const NUMERALS = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

const toRoman = (number) => {
  if (!Number.isInteger(number) || number < 1 || number > 3999) return null;
  let remaining = number;
  return NUMERALS.reduce((out, [value, symbol]) => {
    while (remaining >= value) {
      remaining -= value;
      out += symbol;
    }
    return out;
  }, '');
};

const fromRoman = (input) => {
  const text = input.toUpperCase().replace(/[^IVXLCDM]/g, '');
  if (!text) return null;
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < text.length; i += 1) {
    const current = values[text[i]];
    const next = values[text[i + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  return toRoman(total) === text ? total : total;
};

class RomanNumerals extends JGApp {
  static appId = 'roman-numerals';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="cols equal">
        <jg-card title="Number → Roman">
          <jg-input id="number" type="number" min="1" max="3999" value="2024"></jg-input>
          <jg-output id="roman"></jg-output>
        </jg-card>
        <jg-card title="Roman → Number">
          <jg-input id="roman-in" value="MMXXIV" mono></jg-input>
          <jg-output id="number-out"></jg-output>
        </jg-card>
      </div>

      <jg-card title="Reference" sub="Valid range is 1 to 3999">
        <div class="table">
          ${NUMERALS.map((pair) => html`<div class="pair"><span>${pair[1]}</span><span class="muted">${pair[0]}</span></div>`)}
        </div>
      </jg-card>
    </div>`);

    const run = debounce(() => {
      const number = Number(this.$('#number').value);
      this.$('#roman').value = toRoman(number) ?? 'Out of range (1-3999)';
      const parsed = fromRoman(this.$('#roman-in').value);
      this.$('#number-out').value = parsed === null ? 'Not a Roman numeral' : String(parsed);
    }, 120);

    this.on(this.$('#number'), 'input', run);
    this.on(this.$('#roman-in'), 'input', run);
    run();
  }
}

define('jg-app-roman', RomanNumerals);
