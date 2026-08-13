import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .result {
    max-height: 420px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 65%, transparent);
    font-family: var(--font-mono);
    font-size: 12.5px;
  }
  .change { display: grid; grid-template-columns: 20px 1fr; gap: 8px; padding: 5px 10px; border-bottom: 1px solid var(--border); }
  .change:last-child { border-bottom: 0; }
  .change .mark { font-weight: 700; text-align: center; }
  .change[data-kind="added"] { background: color-mix(in srgb, var(--success) 12%, transparent); }
  .change[data-kind="added"] .mark { color: var(--success); }
  .change[data-kind="removed"] { background: color-mix(in srgb, var(--destructive) 12%, transparent); }
  .change[data-kind="removed"] .mark { color: var(--destructive); }
  .change[data-kind="changed"] { background: color-mix(in srgb, var(--warning) 12%, transparent); }
  .change[data-kind="changed"] .mark { color: var(--warning); }
  .path { color: var(--ring); }
  .value { color: var(--foreground); overflow-wrap: anywhere; }
  .from { color: var(--destructive); }
  .to { color: var(--success); }
`;

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
        <jg-field label="Original"><jg-code id="left" rows="7" gutter language="json" placeholder="{ }"></jg-code></jg-field>
        <jg-field label="Changed"><jg-code id="right" rows="7" gutter language="json" placeholder="{ }"></jg-code></jg-field>
      </div>

      <div class="row">
        <jg-button size="sm" variant="outline" id="sample">Load sample</jg-button>
        <jg-switch id="ignoreOrder"></jg-switch><span class="hint">Ignore array order</span>
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
      result.innerHTML = html`<div class="change"><span class="mark">·</span><span class="value muted">Paste JSON on both sides.</span></div>`;
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
      : html`<div class="change"><span class="mark">=</span><span class="value muted">No differences found.</span></div>`;
  }
}

define('jg-app-json-diff', JsonDiff);
