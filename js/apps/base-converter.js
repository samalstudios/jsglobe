import { JGApp, define, html, css } from '../core/app.js';
import { debounce, chunk } from '../core/util.js';

const sheet = css`
  .bases { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
  .base { display: flex; flex-direction: column; gap: 4px; }
  .bits { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.06em; overflow-wrap: anywhere; }
`;

const COMMON = [
  { base: 2, label: 'Binary (base 2)' },
  { base: 8, label: 'Octal (base 8)' },
  { base: 10, label: 'Decimal (base 10)' },
  { base: 16, label: 'Hexadecimal (base 16)' },
  { base: 32, label: 'Base 32' },
  { base: 36, label: 'Base 36' },
];

class BaseConverter extends JGApp {
  static appId = 'base-converter';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row nowrap">
        <jg-input id="value" class="grow" placeholder="Enter a number" value="255"></jg-input>
        <jg-select id="from" value="10" style="width:170px">
          ${Array.from({ length: 35 }, (unused, index) => index + 2).map(
            (base) => html`<option value="${base}">From base ${base}</option>`,
          )}
        </jg-select>
      </div>
      <div class="hint" id="status"></div>

      <div class="bases">
        ${COMMON.map(
          (item) => html`<div class="base">
            <span class="label">${item.label}</span>
            <jg-output data-base="${item.base}"></jg-output>
          </div>`,
        )}
      </div>

      <jg-card title="Custom base">
        <div class="row nowrap">
          <jg-input id="custom" type="number" min="2" max="36" value="7" suffix="base" style="width:130px"></jg-input>
          <jg-output id="customout" class="grow"></jg-output>
        </div>
      </jg-card>

      <jg-card title="Bit view" sub="32-bit representation grouped in nibbles">
        <div class="bits" id="bits"></div>
        <div class="kv" id="extra"></div>
      </jg-card>
    </div>`);

    this.on(this.$('#value'), 'input', debounce(() => this.#run(), 120));
    this.on(this.$('#from'), 'change', () => this.#run());
    this.on(this.$('#custom'), 'input', debounce(() => this.#run(), 120));
    this.#run();
  }

  #run() {
    const raw = this.$('#value').value.trim().replace(/[\s_]/g, '');
    const from = Number(this.$('#from').value);
    const status = this.$('#status');

    if (!raw) {
      status.textContent = 'Enter a value to convert.';
      this.$$('[data-base]').forEach((node) => {
        node.value = '';
      });
      this.$('#customout').value = '';
      this.$('#bits').textContent = '';
      this.$('#extra').innerHTML = '';
      return;
    }

    let value;
    try {
      value = [...raw.toLowerCase()].reduce((total, char) => {
        const digit = parseInt(char, 36);
        if (Number.isNaN(digit) || digit >= from) throw new Error(`"${char}" is not a base ${from} digit`);
        return total * BigInt(from) + BigInt(digit);
      }, 0n);
    } catch (error) {
      status.innerHTML = html`<span class="error">${error.message}</span>`;
      return;
    }

    status.textContent = `Parsed as base ${from}.`;
    COMMON.forEach((item) => {
      const node = this.$(`[data-base="${item.base}"]`);
      if (node) node.value = value.toString(item.base).toUpperCase();
    });

    const custom = Math.min(36, Math.max(2, Number(this.$('#custom').value) || 2));
    this.$('#customout').value = value.toString(custom).toUpperCase();

    const bits = value.toString(2).padStart(32, '0').slice(-64);
    this.$('#bits').textContent = chunk([...bits], 4).map((group) => group.join('')).join(' ');
    this.$('#extra').innerHTML = html`
      <div>Bit length</div><div>${value.toString(2).length}</div>
      <div>Bytes</div><div>${Math.ceil(value.toString(2).length / 8)}</div>
      <div>Fits in</div><div>${['int8', 'int16', 'int32', 'int64'].find((type) => value < 2n ** BigInt(Number(type.slice(3)) - 1)) ?? 'bigint'}</div>
      <div>Scientific</div><div>${Number(value).toExponential(4)}</div>
    `;
  }
}

define('jg-app-base-converter', BaseConverter);
