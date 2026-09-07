import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { debounce } from '../../core/util.js';

const t = await appWords('json-diff', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const kindOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

const show = (value) => {
  const text = JSON.stringify(value);
  return text && text.length > 120 ? `${text.slice(0, 120)}...` : text;
};

const diff = (left, right, path = '', out = []) => {
  if (kindOf(left) !== kindOf(right)) {
    out.push({ kind: 'changed', path: path || '$', from: left, to: right });
    return out;
  }

  if (kindOf(left) === 'object') {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
    keys.forEach((key) => {
      const next = path ? `${path}.${key}` : key;
      if (!(key in left)) out.push({ kind: 'added', path: next, to: right[key] });
      else if (!(key in right)) out.push({ kind: 'removed', path: next, from: left[key] });
      else diff(left[key], right[key], next, out);
    });
    return out;
  }

  if (kindOf(left) === 'array') {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const next = `${path}[${index}]`;
      if (index >= left.length) out.push({ kind: 'added', path: next, to: right[index] });
      else if (index >= right.length) out.push({ kind: 'removed', path: next, from: left[index] });
      else diff(left[index], right[index], next, out);
    }
    return out;
  }

  if (left !== right) out.push({ kind: 'changed', path: path || '$', from: left, to: right });
  return out;
};

class JsonDiff extends JGApp {
  static appId = 'json-diff';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="split">
        <jg-field label="${t('json-diff.original', 'Original')}"><jg-code id="left" rows="7" gutter language="json" placeholder="{ }"></jg-code></jg-field>
        <jg-field label="${t('json-diff.changed', 'Changed')}"><jg-code id="right" rows="7" gutter language="json" placeholder="{ }"></jg-code></jg-field>
      </div>

      <div class="row">
        <jg-button size="sm" variant="outline" id="sample">${t('json-diff.loadSample', 'Load sample')}</jg-button>
        <jg-switch id="ignoreOrder"></jg-switch><span class="hint">${t('json-diff.ignoreArrayOrder', 'Ignore array order')}</span>
        <span class="grow"></span>
        <span class="hint" id="summary"></span>
      </div>

      <div class="result" id="result"></div>
    </div>`);

    const run = debounce(() => this.#run(), 180);
    this.on(this.$('#left'), 'input', run);
    this.on(this.$('#right'), 'input', run);
    this.on(this.$('#ignoreOrder'), 'change', () => this.#run());
    this.on(this.$('#sample'), 'click', () => {
      this.$('#left').value = JSON.stringify(
        { name: 'jsglobe', version: 1, tools: ['json', 'hash'], server: { port: 8080, tls: false } },
        null,
        2,
      );
      this.$('#right').value = JSON.stringify(
        { name: 'jsglobe', version: 2, tools: ['json', 'hash', 'qr'], server: { port: 8080, tls: true }, owner: 'sia' },
        null,
        2,
      );
      this.#run();
    });

    this.#run();
  }

  #run() {
    const result = this.$('#result');
    const summary = this.$('#summary');
    const leftText = this.$('#left').value.trim();
    const rightText = this.$('#right').value.trim();

    if (!leftText || !rightText) {
      result.innerHTML = html`<div class="change"><span class="mark">·</span><span class="value muted">${t('json-diff.pasteJsonOnBothSides', 'Paste JSON on both sides.')}</span></div>`;
      summary.textContent = '';
      return;
    }

    let left;
    let right;
    try {
      left = JSON.parse(leftText);
    } catch (error) {
      summary.innerHTML = html`<span class="error">Original: ${error.message}</span>`;
      return;
    }
    try {
      right = JSON.parse(rightText);
    } catch (error) {
      summary.innerHTML = html`<span class="error">Changed: ${error.message}</span>`;
      return;
    }

    if (this.$('#ignoreOrder').checked) {
      const sortDeep = (value) => {
        if (Array.isArray(value)) return value.map(sortDeep).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        if (value && typeof value === 'object') {
          return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
        }
        return value;
      };
      left = sortDeep(left);
      right = sortDeep(right);
    }

    const changes = diff(left, right);
    const counts = changes.reduce((totals, change) => ({ ...totals, [change.kind]: (totals[change.kind] ?? 0) + 1 }), {});
    summary.textContent = changes.length
      ? `${counts.added ?? 0} added, ${counts.removed ?? 0} removed, ${counts.changed ?? 0} changed`
      : 'The documents are identical';

    result.innerHTML = changes.length
      ? changes
          .map(
            (change) => html`<div class="change" data-kind="${change.kind}">
              <span class="mark">${change.kind === 'added' ? '+' : change.kind === 'removed' ? '−' : '~'}</span>
              <span class="value">
                <span class="path">${change.path}</span>
                ${change.kind === 'changed'
                  ? html` <span class="from">${show(change.from)}</span> → <span class="to">${show(change.to)}</span>`
                  : html` ${show(change.kind === 'added' ? change.to : change.from)}`}
              </span>
            </div>`,
          )
          .join('')
      : html`<div class="change"><span class="mark">=</span><span class="value muted">${t('json-diff.noDifferencesFound', 'No differences found.')}</span></div>`;
  }
}

define('jg-app-json-diff', JsonDiff);
