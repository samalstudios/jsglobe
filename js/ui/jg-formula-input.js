import { JGElement, define, css, html, raw } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { base } from './styles.js';
import { formulaToHtml } from '../lib/formula.js';

const GROUPS = [
  {
    name: () => t('formula.structure', 'Structure'),
    keys: [
      { face: 'x²', code: '^{}' },
      { face: 'x₂', code: '_{}' },
      { face: 'a⁄b', code: '\\frac{}{}' },
      { face: '√', code: '\\sqrt{}' },
      { face: '( )', code: '()' },
    ],
  },
  {
    name: () => t('formula.operators', 'Operators'),
    keys: [
      { face: '±', code: '\\pm ' },
      { face: '×', code: '\\times ' },
      { face: '÷', code: '\\div ' },
      { face: '·', code: '\\cdot ' },
      { face: '≤', code: '\\leq ' },
      { face: '≥', code: '\\geq ' },
      { face: '≠', code: '\\neq ' },
      { face: '≈', code: '\\approx ' },
      { face: '∝', code: '\\propto ' },
    ],
  },
  {
    name: () => t('formula.symbols', 'Symbols'),
    keys: [
      { face: '∑', code: '\\sum ' },
      { face: '∏', code: '\\prod ' },
      { face: '∫', code: '\\int ' },
      { face: '∂', code: '\\partial ' },
      { face: '∇', code: '\\nabla ' },
      { face: '∞', code: '\\infty ' },
      { face: '→', code: '\\rightarrow ' },
      { face: '∈', code: '\\in ' },
      { face: '°', code: '\\degree ' },
    ],
  },
  {
    name: () => t('formula.greek', 'Greek'),
    keys: [
      { face: 'α', code: '\\alpha ' },
      { face: 'β', code: '\\beta ' },
      { face: 'γ', code: '\\gamma ' },
      { face: 'δ', code: '\\delta ' },
      { face: 'θ', code: '\\theta ' },
      { face: 'λ', code: '\\lambda ' },
      { face: 'μ', code: '\\mu ' },
      { face: 'π', code: '\\pi ' },
      { face: 'σ', code: '\\sigma ' },
      { face: 'φ', code: '\\phi ' },
      { face: 'ω', code: '\\omega ' },
      { face: 'Δ', code: '\\Delta ' },
      { face: 'Σ', code: '\\Sigma ' },
      { face: 'Ω', code: '\\Omega ' },
    ],
  },
];

const sheet = css`
  :host { display: block; }
  .shell {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    overflow: hidden;
  }
  .shell:focus-within { border-color: var(--ring); }

  .stage {
    display: grid;
    place-items: center;
    min-height: 66px;
    padding: 14px 12px;
    background: var(--background);
    font: 400 21px/1.7 Georgia, Times New Roman, serif;
    color: var(--foreground);
    text-align: center;
    overflow-x: auto;
  }
  .stage .empty { font: 400 13px/1 var(--font-sans); color: var(--muted-foreground); }

  input {
    width: 100%;
    border: 0;
    border-top: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    padding: 9px 11px;
    font: 500 12.5px/1.4 var(--font-mono);
    outline: 0;
  }

  .tabs { display: flex; gap: 2px; padding: 6px 6px 0; border-top: 1px solid var(--border); }
  .tab {
    border: 0;
    background: transparent;
    padding: 5px 9px;
    border-radius: var(--radius-sm);
    font: 500 11.5px/1 var(--font-sans);
    color: var(--muted-foreground);
    cursor: pointer;
  }
  .tab:hover { background: var(--accent); color: var(--foreground); }
  .tab[aria-pressed="true"] { background: color-mix(in srgb, var(--ring) 16%, var(--card)); color: var(--foreground); }

  .keys { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; }
  .key {
    min-width: 34px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--foreground);
    font: 400 14px/1 Georgia, Times New Roman, serif;
    cursor: pointer;
  }
  .key:hover { border-color: var(--ring); background: var(--accent); }

  .frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.82em; line-height: 1.15; margin: 0 0.18em; }
  .frac .over { border-bottom: 1px solid currentColor; padding: 0 0.28em; }
  .frac .under { padding: 0 0.28em; }
  .root { border-top: 1px solid currentColor; padding: 0 0.1em; }
`;

class JGFormulaInput extends JGElement {
  static styles = [base, sheet];
  static observedAttributes = ['value'];

  #group = 0;

  get value() {
    return this.getAttribute('value') ?? '';
  }

  set value(next) {
    this.setAttribute('value', next ?? '');
  }

  get html() {
    return formulaToHtml(this.value);
  }

  render() {
    this.paint(html`
      <div class="shell">
        <div class="stage" id="stage"></div>
        <input id="src" type="text" spellcheck="false" autocomplete="off"
          value="${this.value}" placeholder="${this.getAttribute('placeholder') ?? 'a^2 + b^2 = c^2'}" />
        <div class="tabs">
          ${GROUPS.map((group, index) => html`<button class="tab" data-group="${index}" aria-pressed="${String(index === this.#group)}">${group.name()}</button>`)}
        </div>
        <div class="keys" id="keys"></div>
      </div>
    `);

    this.#paintKeys();
    this.#paintStage();

    const input = this.$('#src');
    this.on(input, 'input', () => {
      this.setAttribute('value', input.value);
      this.#paintStage();
      this.emit('change', { value: input.value, html: this.html });
    });

    this.on(this.$('.tabs'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('.tabs'), 'click', (event) => {
      const tab = event.target.closest('[data-group]');
      if (!tab) return;
      this.#group = Number(tab.dataset.group);
      this.$$('.tab').forEach((node) => node.setAttribute('aria-pressed', String(Number(node.dataset.group) === this.#group)));
      this.#paintKeys();
    });

    this.on(this.$('#keys'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('#keys'), 'click', (event) => {
      const key = event.target.closest('[data-code]');
      if (key) this.#put(key.dataset.code);
    });
  }

  #paintKeys() {
    const host = this.$('#keys');
    if (!host) return;
    host.innerHTML = GROUPS[this.#group].keys
      .map((key) => `<button class="key" data-code="${key.code.replace(/"/g, '&quot;')}" title="${key.code.trim()}">${key.face}</button>`)
      .join('');
  }

  #paintStage() {
    const stage = this.$('#stage');
    if (!stage) return;
    const body = this.value.trim();
    stage.innerHTML = body ? formulaToHtml(body) : `<span class="empty">${t('formula.blank', 'The formula appears here as you type')}</span>`;
  }

  #put(code) {
    const input = this.$('#src');
    if (!input) return;
    const at = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? at;
    const picked = input.value.slice(at, end);
    const brace = code.indexOf('{}');
    const filled = picked && brace !== -1 ? code.replace('{}', `{${picked}}`) : code;
    input.value = input.value.slice(0, at) + filled + input.value.slice(end);

    const caret = brace === -1 ? at + filled.length : picked ? at + filled.length : at + brace + 1;
    input.focus();
    input.setSelectionRange(caret, caret);
    this.setAttribute('value', input.value);
    this.#paintStage();
    this.emit('change', { value: input.value, html: this.html });
  }

  attributeChangedCallback(name, previous, next) {
    if (name !== 'value' || previous === next) return;
    const input = this.$('#src');
    if (input && input.value !== next) {
      input.value = next ?? '';
      this.#paintStage();
    }
  }
}

define('jg-formula-input', JGFormulaInput);
