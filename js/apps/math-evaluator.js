import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText } from '../core/util.js';

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

const CONSTANTS = { pi: Math.PI, e: Math.E, tau: Math.PI * 2, phi: (1 + Math.sqrt(5)) / 2, inf: Infinity };

const FUNCTIONS = {
  abs: Math.abs, sqrt: Math.sqrt, cbrt: Math.cbrt, ln: Math.log, log: Math.log10, log2: Math.log2,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, sign: Math.sign, trunc: Math.trunc,
  min: Math.min, max: Math.max, hypot: Math.hypot, pow: Math.pow,
  fact: (n) => (n <= 1 ? 1 : Array.from({ length: n }, (unused, index) => index + 1).reduce((total, value) => total * value, 1)),
  deg: (radians) => (radians * 180) / Math.PI,
  rad: (degrees) => (degrees * Math.PI) / 180,
};

const tokenize = (input) => {
  const tokens = [];
  const source = input.replace(/\s+/g, '');
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/[0-9.]/.test(char)) {
      let number = '';
      while (index < source.length && /[0-9._eE]/.test(source[index])) {
        if ((source[index] === 'e' || source[index] === 'E') && !/[0-9]/.test(source[index + 1] ?? '') && source[index + 1] !== '-') break;
        number += source[index] === '_' ? '' : source[index];
        index += 1;
      }
      tokens.push({ type: 'number', value: Number(number) });
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      let name = '';
      while (index < source.length && /[a-zA-Z0-9]/.test(source[index])) {
        name += source[index];
        index += 1;
      }
      tokens.push({ type: 'name', value: name.toLowerCase() });
      continue;
    }
    if ('+-*/^%(),!'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      index += 1;
      continue;
    }
    throw new Error(`Unexpected character "${char}"`);
  }
  return tokens;
};

const evaluate = (input, variables = {}) => {
  const tokens = tokenize(input);
  let position = 0;

  const peek = () => tokens[position];
  const eat = (value) => {
    if (peek()?.type === 'op' && peek().value === value) {
      position += 1;
      return true;
    }
    return false;
  };

  const parseExpression = () => {
    let left = parseTerm();
    while (peek()?.type === 'op' && '+-'.includes(peek().value)) {
      const operator = tokens[position].value;
      position += 1;
      const right = parseTerm();
      left = operator === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = () => {
    let left = parseFactor();
    while (peek()?.type === 'op' && '*/%'.includes(peek().value)) {
      const operator = tokens[position].value;
      position += 1;
      const right = parseFactor();
      left = operator === '*' ? left * right : operator === '/' ? left / right : left % right;
    }
    return left;
  };

  const parseFactor = () => {
    const base = parseUnary();
    if (peek()?.type === 'op' && peek().value === '^') {
      position += 1;
      return base ** parseFactor();
    }
    return base;
  };

  const parseUnary = () => {
    if (eat('-')) return -parseUnary();
    if (eat('+')) return parseUnary();
    return parsePostfix();
  };

  const parsePostfix = () => {
    let value = parsePrimary();
    while (eat('!')) value = FUNCTIONS.fact(value);
    return value;
  };

  const parsePrimary = () => {
    const token = peek();
    if (!token) throw new Error('Unexpected end of expression');

    if (token.type === 'number') {
      position += 1;
      return token.value;
    }

    if (token.type === 'name') {
      position += 1;
      const name = token.value;
      if (eat('(')) {
        const args = [];
        if (!eat(')')) {
          do {
            args.push(parseExpression());
          } while (eat(','));
          if (!eat(')')) throw new Error('Missing closing parenthesis');
        }
        const fn = FUNCTIONS[name];
        if (!fn) throw new Error(`Unknown function "${name}"`);
        return fn(...args);
      }
      if (name in variables) return variables[name];
      if (name in CONSTANTS) return CONSTANTS[name];
      throw new Error(`Unknown name "${name}"`);
    }

    if (eat('(')) {
      const value = parseExpression();
      if (!eat(')')) throw new Error('Missing closing parenthesis');
      return value;
    }

    throw new Error(`Unexpected token "${token.value}"`);
  };

  const result = parseExpression();
  if (position < tokens.length) throw new Error('Unexpected trailing input');
  return result;
};

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
