import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';
import { evaluate, CONSTANTS, FUNCTIONS } from '../core/expression.js';

const sheet = css`
  .result { font: 600 clamp(22px, 6vw, 34px)/1.2 var(--font-mono); letter-spacing: -0.02em; overflow-wrap: anywhere; }
  .history { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow: auto; }
  .entry {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    font-family: var(--font-mono);
    font-size: 12px;
    cursor: pointer;
  }
  .entry:hover { border-color: var(--border-strong); }
  .entry .value { color: var(--ring); }
  .refs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px; font-size: 12px; }
  .ref code { font-family: var(--font-mono); color: var(--ring); }
  .widget { display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 0 12px 12px; }
`;

class MathEvaluator extends JGApp {
  static appId = 'math-evaluator';
  static styles = [...JGApp.styles, sheet];

  #history = [];

  renderWidget() {
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <jg-input id="input" size="sm" mono placeholder="2 + 2 * pi"></jg-input>
        <div class="result" style="font-size:20px" id="out">-</div>
      </div>
    </div>`);
    this.on(this.$('#input'), 'input', debounce(() => {
      const value = this.$('#input').value.trim();
      try {
        this.$('#out').textContent = value ? String(evaluate(value)) : '-';
      } catch {
        this.$('#out').textContent = '...';
      }
    }, 120));
  }

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Expression" hint="Supports + − × ÷ ^ % !, functions and constants">
        <jg-input id="input" mono value="sqrt(16) + 2^8 / pi"></jg-input>
      </jg-field>

      <jg-card title="Result">
        <div class="result" id="result">-</div>
        <div class="spread">
          <span class="hint" id="detail"></span>
          <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
        </div>
      </jg-card>

      <jg-card title="History" sub="Click an entry to load it">
        <div class="history" id="history"></div>
      </jg-card>

      <jg-card title="Reference">
        <div class="refs">
          ${Object.keys(FUNCTIONS).map((name) => html`<div class="ref"><code>${name}()</code></div>`)}
          ${Object.keys(CONSTANTS).map((name) => html`<div class="ref"><code>${name}</code></div>`)}
        </div>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 140));
    this.on(this.$('#input'), 'keydown', (event) => {
      if (event.key === 'Enter') this.#remember();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#result').textContent));
    this.#run();
  }

  #run() {
    const source = this.$('#input').value.trim();
    const result = this.$('#result');
    const detail = this.$('#detail');

    if (!source) {
      result.textContent = '-';
      detail.textContent = '';
      return;
    }

    try {
      const value = evaluate(source);
      result.textContent = Number.isFinite(value) ? String(value) : String(value);
      detail.textContent = Number.isFinite(value)
        ? `${value.toLocaleString(undefined, { maximumFractionDigits: 10 })} · hex ${Number.isInteger(value) ? `0x${value.toString(16)}` : '-'} · exp ${value.toExponential(4)}`
        : 'Press Enter to keep this in history';
      result.style.color = '';
    } catch (error) {
      result.textContent = error.message;
      result.style.color = 'var(--destructive)';
      detail.textContent = '';
    }
  }

  #remember() {
    const source = this.$('#input').value.trim();
    if (!source) return;
    try {
      const value = evaluate(source);
      this.#history = [{ source, value }, ...this.#history].slice(0, 20);
      this.$('#history').innerHTML = this.#history
        .map((entry) => html`<div class="entry" data-source="${entry.source}"><span>${entry.source}</span><span class="value">${entry.value}</span></div>`)
        .join('');
      this.bind('.entry', 'click', (event) => {
        this.$('#input').value = event.currentTarget.dataset.source;
        this.#run();
      });
    } catch {
      /* nothing to remember */
    }
  }
}

define('jg-app-math', MathEvaluator);
