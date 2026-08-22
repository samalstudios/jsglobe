import { JGApp, define, html, css } from '../core/app.js';
import { t } from '../core/i18n.js';
import { escapeHtml } from '../core/dom.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .diff {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: auto;
    max-height: 420px;
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.65;
    background: color-mix(in srgb, var(--muted) 65%, transparent);
  }
  .line { display: grid; grid-template-columns: 46px 46px 1fr; gap: 0; }
  .line span { padding: 1px 8px; }
  .line .n { color: var(--muted-foreground); text-align: right; font-size: 11px; user-select: none; }
  .line .text { white-space: pre-wrap; overflow-wrap: anywhere; }
  .line[data-kind="add"] { background: color-mix(in srgb, var(--success) 14%, transparent); }
  .line[data-kind="del"] { background: color-mix(in srgb, var(--destructive) 14%, transparent); }
  .line[data-kind="add"] .text::before { content: "+ "; color: var(--success); }
  .line[data-kind="del"] .text::before { content: "− "; color: var(--destructive); }
  .line[data-kind="same"] .text::before { content: "  "; }
  ins, del { text-decoration: none; border-radius: 3px; padding: 0 1px; }
  ins { background: color-mix(in srgb, var(--success) 32%, transparent); }
  del { background: color-mix(in srgb, var(--destructive) 32%, transparent); }
`;

const lcs = (left, right) => {
  const rows = left.length;
  const cols = right.length;
  const table = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const result = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (left[i] === right[j]) {
      result.push({ kind: 'same', text: left[i], left: i + 1, right: j + 1 });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ kind: 'del', text: left[i], left: i + 1, right: null });
      i += 1;
    } else {
      result.push({ kind: 'add', text: right[j], left: null, right: j + 1 });
      j += 1;
    }
  }
  while (i < rows) {
    result.push({ kind: 'del', text: left[i], left: i + 1, right: null });
    i += 1;
  }
  while (j < cols) {
    result.push({ kind: 'add', text: right[j], left: null, right: j + 1 });
    j += 1;
  }
  return result;
};

const inlineDiff = (before, after) => {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const parts = lcs(a, b);
  return {
    before: parts
      .filter((part) => part.kind !== 'add')
      .map((part) => (part.kind === 'del' ? `<del>${escapeHtml(part.text)}</del>` : escapeHtml(part.text)))
      .join(''),
    after: parts
      .filter((part) => part.kind !== 'del')
      .map((part) => (part.kind === 'add' ? `<ins>${escapeHtml(part.text)}</ins>` : escapeHtml(part.text)))
      .join(''),
  };
};

class TextDiff extends JGApp {
  static appId = 'text-diff';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="split">
        <jg-field label="${t('text-diff.original', 'Original')}"><jg-textarea id="left" rows="6" placeholder="${t('text-diff.pasteOriginal', 'Paste the original text')}"></jg-textarea></jg-field>
        <jg-field label="${t('text-diff.changed', 'Changed')}"><jg-textarea id="right" rows="6" placeholder="${t('text-diff.pasteChanged', 'Paste the changed text')}"></jg-textarea></jg-field>
      </div>

      <div class="row">
        <jg-switch id="trim" checked></jg-switch><span class="hint">${t('text-diff.ignoreWhitespace', 'Ignore trailing whitespace')}</span>
        <jg-switch id="case"></jg-switch><span class="hint">${t('text-diff.ignoreCase', 'Ignore case')}</span>
        <jg-switch id="words" checked></jg-switch><span class="hint">${t('text-diff.highlightWords', 'Highlight word changes')}</span>
        <span class="grow"></span>
        <span class="hint" id="summary"></span>
      </div>

      <div class="diff" id="diff"></div>
    </div>`);

    const run = debounce(() => this.#run(), 180);
    ['#left', '#right'].forEach((selector) => this.on(this.$(selector), 'input', run));
    ['#trim', '#case', '#words'].forEach((selector) => this.on(this.$(selector), 'change', () => this.#run()));

    this.$('#left').value = 'the quick brown fox\njumps over the lazy dog\nsecond line stays';
    this.$('#right').value = 'the quick red fox\njumps over the lazy dog\na brand new line\nsecond line stays';
    this.#run();
  }

  #run() {
    const normalize = (text) => {
      let value = text;
      if (this.$('#trim').checked) value = value.replace(/[ \t]+$/gm, '');
      if (this.$('#case').checked) value = value.toLowerCase();
      return value.split('\n');
    };

    const left = normalize(this.$('#left').value);
    const right = normalize(this.$('#right').value);
    const parts = lcs(left, right);

    const added = parts.filter((part) => part.kind === 'add').length;
    const removed = parts.filter((part) => part.kind === 'del').length;
    this.$('#summary').textContent = `${added} added · ${removed} removed · ${parts.filter((part) => part.kind === 'same').length} unchanged`;

    const useWords = this.$('#words').checked;
    const rendered = [];

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const next = parts[index + 1];
      if (useWords && part.kind === 'del' && next?.kind === 'add') {
        const pair = inlineDiff(part.text, next.text);
        rendered.push(
          html`<div class="line" data-kind="del"><span class="n">${part.left}</span><span class="n"></span><span class="text">${{ raw: pair.before }}</span></div>`,
        );
        rendered.push(
          html`<div class="line" data-kind="add"><span class="n"></span><span class="n">${next.right}</span><span class="text">${{ raw: pair.after }}</span></div>`,
        );
        index += 1;
        continue;
      }
      rendered.push(
        html`<div class="line" data-kind="${part.kind}">
          <span class="n">${part.left ?? ''}</span>
          <span class="n">${part.right ?? ''}</span>
          <span class="text">${part.text}</span>
        </div>`,
      );
    }

    this.$('#diff').innerHTML = rendered.join('');
  }
}

define('jg-app-text-diff', TextDiff);
