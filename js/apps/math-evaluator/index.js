import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { debounce, copyText } from '../../core/util.js';
import { evaluate, CONSTANTS, FUNCTIONS } from '../../core/expression.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

class MathEvaluator extends JGApp {
  static appId = 'math-evaluator';
  static styles = [...JGApp.styles, sheet];

  #history = [];

  renderWidget() {
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <jg-input id="input" size="sm" mono placeholder="${t('math-evaluator.22Pi', '2 + 2 * pi')}"></jg-input>
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

  tools() {
    return [
      {
        name: 'evaluate_expression',
        description: 'Work out a mathematical expression, with functions and constants',
        params: { expression: { type: 'string', description: 'The expression, such as sqrt(2) * pi', required: true } },
        run: ({ expression }) => {
          try {
            return String(evaluate(expression));
          } catch (failure) {
            return `Could not work that out: ${failure.message}`;
          }
        },
      },
    ];
  }

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="${t('math-evaluator.expression', 'Expression')}" hint="${t('math-evaluator.supportsFunctionsAndConstants', 'Supports + − × ÷ ^ % !, functions and constants')}">
        <jg-input id="input" mono value="sqrt(16) + 2^8 / pi"></jg-input>
      </jg-field>

      <jg-card title="${t('math-evaluator.result', 'Result')}">
        <div class="result" id="result">-</div>
        <div class="spread">
          <span class="hint" id="detail"></span>
          <jg-button size="sm" variant="outline" id="copy">${t('math-evaluator.copy', 'Copy')}</jg-button>
        </div>
      </jg-card>

      <jg-card title="${t('math-evaluator.history', 'History')}" sub="${t('math-evaluator.clickAnEntryToLoad', 'Click an entry to load it')}">
        <div class="history" id="history"></div>
      </jg-card>

      <jg-card title="${t('math-evaluator.reference', 'Reference')}">
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
