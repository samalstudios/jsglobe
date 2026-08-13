import { JGElement, define, css, html, escapeHtml } from '../core/dom.js';
import { base } from './styles.js';

const sheet = css`
  :host {
    display: block;
    width: 100%;
    min-width: 0;
    --code-font-size: 12.5px;
    --code-line-height: 1.62;
  }
  :host([grow]) { display: flex; flex: 1; min-height: 0; }
  :host([hidden]) { display: none; }

  .frame {
    position: relative;
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 0;
    background: color-mix(in srgb, var(--input) 100%, transparent);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .frame:hover { border-color: var(--border-strong); }
  :host([focused]) .frame {
    border-color: color-mix(in srgb, var(--ring) 70%, var(--border));
    box-shadow: var(--shadow-ring);
  }
  :host([invalid]) .frame { border-color: color-mix(in srgb, var(--destructive) 60%, var(--border)); }

  .gutter {
    flex: none;
    padding: 10px 8px 10px 10px;
    text-align: right;
    color: color-mix(in srgb, var(--muted-foreground) 70%, transparent);
    background: color-mix(in srgb, var(--muted) 45%, transparent);
    border-right: 1px solid var(--border);
    user-select: none;
    overflow: hidden;
  }
  :host(:not([gutter])) .gutter { display: none; }

  .scroll {
    position: relative;
    flex: 1 1 0;
    width: 0;
    min-width: 0;
    overflow: auto;
    scrollbar-width: thin;
  }

  .gutter,
  .highlight,
  .editor {
    font-family: var(--font-mono);
    font-size: var(--code-font-size);
    line-height: var(--code-line-height);
    tab-size: 2;
    white-space: pre;
  }

  .highlight,
  .editor {
    margin: 0;
    padding: 10px 12px;
    min-width: 100%;
    min-height: 100%;
    border: 0;
    box-sizing: border-box;
  }

  .highlight {
    position: relative;
    pointer-events: none;
    color: var(--foreground);
  }
  :host([wrap]) .highlight,
  :host([wrap]) .editor { white-space: pre-wrap; overflow-wrap: anywhere; }

  .editor {
    position: absolute;
    inset: 0;
    resize: none;
    overflow: hidden;
    color: transparent;
    caret-color: var(--foreground);
    background: transparent;
    outline: none;
    spellcheck: false;
  }
  .editor::selection { background: color-mix(in srgb, var(--ring) 45%, transparent); }
  .editor::placeholder { color: color-mix(in srgb, var(--muted-foreground) 80%, transparent); }

  .tok-comment { color: var(--syn-comment); font-style: italic; }
  .tok-string { color: var(--syn-str); }
  .tok-number { color: var(--syn-num); }
  .tok-keyword { color: var(--syn-key); }
  .tok-literal { color: var(--syn-bool); }
  .tok-function { color: var(--syn-fn); }
  .tok-tag { color: var(--syn-tag); }
  .tok-attr { color: var(--syn-attr); }
  .tok-punct { color: var(--syn-punct); }
  .tok-heading { color: var(--syn-key); font-weight: 600; }
`;

const JS_KEYWORDS =
  'await|async|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|get|if|import|in|instanceof|let|new|of|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield';
const JS_LITERALS = 'true|false|null|undefined|NaN|Infinity';
const CSS_UNITS = 'px|em|rem|%|vh|vw|s|ms|deg|fr|ch|pt';
const SQL_KEYWORDS =
  'select|from|where|insert|into|values|update|set|delete|create|table|alter|drop|join|left|right|inner|outer|on|group|by|order|having|limit|offset|as|and|or|not|null|distinct|union|index|primary|key|foreign|references|default|case|when|then|else|end';

const GRAMMARS = {
  javascript: [
    ['comment', /\/\*[\s\S]*?\*\/|\/\/[^\n]*/],
    ['string', /`(?:\\[\s\S]|[^\\`])*`|"(?:\\[\s\S]|[^\\"\n])*"|'(?:\\[\s\S]|[^\\'\n])*'/],
    ['literal', new RegExp(`\\b(?:${JS_LITERALS})\\b`)],
    ['keyword', new RegExp(`\\b(?:${JS_KEYWORDS})\\b`)],
    ['number', /\b0[xX][\da-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ['function', /\b[A-Za-z_$][\w$]*(?=\s*\()/],
    ['punct', /[{}[\]();,.:?=+\-*/%<>!&|^~]/],
  ],
  json: [
    ['attr', /"(?:\\.|[^\\"])*"(?=\s*:)/],
    ['string', /"(?:\\.|[^\\"])*"/],
    ['literal', /\b(?:true|false|null)\b/],
    ['number', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ['punct', /[{}[\],:]/],
  ],
  css: [
    ['comment', /\/\*[\s\S]*?\*\//],
    ['string', /"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])*'/],
    ['keyword', /@[\w-]+/],
    ['attr', /[\w-]+(?=\s*:)/],
    ['number', new RegExp(`#[\\da-fA-F]{3,8}\\b|\\b-?\\d*\\.?\\d+(?:${CSS_UNITS})?\\b`)],
    ['function', /\b[\w-]+(?=\()/],
    ['tag', /\.[\w-]+|#[\w-]+|::?[\w-]+|\b[a-z]+(?=[^:;{}]*\{)/],
    ['punct', /[{}();:,>+~]/],
  ],
  html: [
    ['comment', /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/],
    ['string', /"(?:\\.|[^\\"])*"|'(?:\\.|[^\\'])*'/],
    ['tag', /<\/?[\w:-]+|\/?>/],
    ['attr', /\b[\w:-]+(?==)/],
    ['punct', /[=]/],
  ],
  xml: null,
  svg: null,
  yaml: [
    ['comment', /#[^\n]*/],
    ['attr', /^[ \t]*[\w.-]+(?=\s*:)/m],
    ['string', /"(?:\\.|[^\\"\n])*"|'(?:\\.|[^\\'\n])*'/],
    ['literal', /\b(?:true|false|null|yes|no|on|off)\b/],
    ['number', /-?\b\d+(?:\.\d+)?\b/],
    ['punct', /^[ \t]*-(?=\s)|[:[\]{},]/m],
  ],
  sql: [
    ['comment', /--[^\n]*|\/\*[\s\S]*?\*\//],
    ['string', /'(?:''|[^'])*'/],
    ['keyword', new RegExp(`\\b(?:${SQL_KEYWORDS})\\b`, 'i')],
    ['number', /\b\d+(?:\.\d+)?\b/],
    ['punct', /[(),;*=<>]/],
  ],
  markdown: [
    ['heading', /^#{1,6} [^\n]*/m],
    ['comment', /^>[^\n]*/m],
    ['string', /`[^`\n]*`|```[\s\S]*?```/],
    ['keyword', /\*\*[^*\n]+\*\*|__[^_\n]+__/],
    ['function', /\[[^\]\n]*\]\([^)\n]*\)/],
    ['punct', /^[ \t]*[-*+](?= )|^[ \t]*\d+\.(?= )/m],
  ],
  shell: [
    ['comment', /#[^\n]*/],
    ['string', /"(?:\\.|[^\\"])*"|'[^']*'/],
    ['keyword', /\b(?:if|then|else|fi|for|in|do|done|while|case|esac|function|return|export|local|source|sudo|cd|echo|set)\b/],
    ['attr', /(?:^|\s)--?[\w-]+/],
    ['number', /\b\d+\b/],
    ['punct', /[|&;()<>$]/],
  ],
  plain: [],
};

GRAMMARS.xml = GRAMMARS.html;
GRAMMARS.svg = GRAMMARS.html;
GRAMMARS.js = GRAMMARS.javascript;
GRAMMARS.jsx = GRAMMARS.javascript;
GRAMMARS.ts = GRAMMARS.javascript;
GRAMMARS.typescript = GRAMMARS.javascript;
GRAMMARS.md = GRAMMARS.markdown;
GRAMMARS.yml = GRAMMARS.yaml;
GRAMMARS.bash = GRAMMARS.shell;
GRAMMARS.sh = GRAMMARS.shell;
GRAMMARS.text = GRAMMARS.plain;

const compile = (rules) => {
  const source = rules.map(([, pattern]) => `(${pattern.source})`).join('|');
  const flags = `gm${rules.some(([, pattern]) => pattern.flags.includes('i')) ? 'i' : ''}`;
  return rules.length ? new RegExp(source, flags) : null;
};

const compiled = new Map();

const grammarFor = (language) => {
  const rules = GRAMMARS[language] ?? GRAMMARS.plain;
  if (!compiled.has(rules)) compiled.set(rules, { rules, pattern: compile(rules) });
  return compiled.get(rules);
};

export const highlight = (code, language = 'plain') => {
  const { rules, pattern } = grammarFor(language);
  if (!pattern) return escapeHtml(code);

  let out = '';
  let last = 0;
  pattern.lastIndex = 0;

  for (let match = pattern.exec(code); match; match = pattern.exec(code)) {
    const index = match.findIndex((group, position) => position > 0 && group !== undefined);
    if (index < 1) {
      pattern.lastIndex += 1;
      continue;
    }
    out += escapeHtml(code.slice(last, match.index));
    out += `<span class="tok-${rules[index - 1][0]}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;
    if (match[0].length === 0) pattern.lastIndex += 1;
  }

  return out + escapeHtml(code.slice(last));
};

const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

class JGCode extends JGElement {
  static shadow = { mode: 'open', delegatesFocus: true };
  static styles = [base, sheet];
  static observedAttributes = ['value', 'language', 'placeholder', 'readonly', 'rows'];

  #value = '';

  get value() {
    return this.$('.editor')?.value ?? this.#value;
  }

  set value(next) {
    this.#value = String(next ?? '');
    const editor = this.$('.editor');
    if (!editor) return;
    editor.value = this.#value;
    this.#paint();
  }

  get language() {
    return this.getAttribute('language') ?? 'plain';
  }

  set language(next) {
    this.setAttribute('language', next);
  }

  get selectionStart() {
    return this.$('.editor')?.selectionStart ?? 0;
  }

  focus() {
    this.$('.editor')?.focus();
  }

  insert(text) {
    const editor = this.$('.editor');
    if (!editor) return;
    const { selectionStart, selectionEnd } = editor;
    editor.setRangeText(text, selectionStart, selectionEnd, 'end');
    this.#changed();
  }

  render() {
    const rows = Number(this.getAttribute('rows')) || 12;
    this.paint(html`
      <div class="frame" style="--rows:${rows}">
        <div class="gutter" part="gutter">1</div>
        <div class="scroll">
          <pre class="highlight" aria-hidden="true"><code></code></pre>
          <textarea
            class="editor"
            part="editor"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            placeholder="${this.getAttribute('placeholder') ?? ''}"
          ></textarea>
        </div>
      </div>
    `);

    const editor = this.$('.editor');
    const scroll = this.$('.scroll');
    editor.readOnly = this.hasAttribute('readonly');
    editor.value = this.getAttribute('value') ?? this.#value;

    this.$('.frame').style.height = this.hasAttribute('grow')
      ? '100%'
      : `calc(${rows} * var(--code-line-height) * var(--code-font-size) + 22px)`;

    this.on(editor, 'input', (event) => {
      event.stopPropagation();
      this.#changed();
    });
    this.on(editor, 'keydown', (event) => this.#keys(event));
    this.on(editor, 'focus', () => this.setAttribute('focused', ''));
    this.on(editor, 'blur', () => {
      this.removeAttribute('focused');
      this.emit('change', { value: editor.value });
    });
    this.on(editor, 'scroll', () => {
      scroll.scrollTop = editor.scrollTop;
      this.$('.gutter').scrollTop = editor.scrollTop;
    });

    this.#paint();
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next || !this.$('.editor')) return;
    if (name === 'value') this.value = next ?? '';
    if (name === 'language') this.#paint();
    if (name === 'placeholder') this.$('.editor').placeholder = next ?? '';
    if (name === 'readonly') this.$('.editor').readOnly = this.hasAttribute('readonly');
    if (name === 'rows') this.refresh();
  }

  #changed() {
    this.#value = this.$('.editor').value;
    this.#paint();
    this.emit('input', { value: this.#value });
  }

  #paint() {
    const code = this.$('.editor').value;
    this.$('.highlight code').innerHTML = highlight(code.endsWith('\n') ? `${code} ` : code, this.language);
    if (this.hasAttribute('gutter')) {
      const lines = code.split('\n').length;
      this.$('.gutter').textContent = Array.from({ length: lines }, (item, index) => index + 1).join('\n');
    }
  }

  #keys(event) {
    const editor = event.currentTarget;
    if (event.key === 'Tab') {
      event.preventDefault();
      const { selectionStart, selectionEnd } = editor;
      if (selectionStart === selectionEnd && !event.shiftKey) {
        editor.setRangeText('  ', selectionStart, selectionEnd, 'end');
      } else {
        const start = editor.value.lastIndexOf('\n', selectionStart - 1) + 1;
        const block = editor.value.slice(start, selectionEnd);
        const next = event.shiftKey
          ? block.replace(/^ {1,2}/gm, '')
          : block.replace(/^/gm, '  ');
        editor.setRangeText(next, start, selectionEnd, 'select');
      }
      this.#changed();
      return;
    }

    if (event.key === 'Enter') {
      const { selectionStart } = editor;
      const line = editor.value.slice(editor.value.lastIndexOf('\n', selectionStart - 1) + 1, selectionStart);
      const indent = line.match(/^[ \t]*/)[0] + (/[{[(:]$/.test(line.trim()) ? '  ' : '');
      if (!indent) return;
      event.preventDefault();
      editor.setRangeText(`\n${indent}`, selectionStart, editor.selectionEnd, 'end');
      this.#changed();
      return;
    }

    if (PAIRS[event.key] && editor.selectionStart !== editor.selectionEnd) {
      event.preventDefault();
      const { selectionStart, selectionEnd } = editor;
      const inner = editor.value.slice(selectionStart, selectionEnd);
      editor.setRangeText(`${event.key}${inner}${PAIRS[event.key]}`, selectionStart, selectionEnd, 'select');
      this.#changed();
    }
  }
}

define('jg-code', JGCode);
