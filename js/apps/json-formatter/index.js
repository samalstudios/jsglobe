import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { escapeHtml } from '../../core/dom.js';
import { copyText, download, debounce } from '../../core/util.js';

const t = await appWords('json-formatter', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const SAMPLE = `{"name":"jsglobe","version":1,"tools":["json","hash","uuid"],"private":false,"meta":{"stars":null}}`;

const highlight = (json) =>
  escapeHtml(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) return `<span class="${/:$/.test(match) ? 'tok-key' : 'tok-str'}">${match}</span>`;
      if (/true|false/.test(match)) return `<span class="tok-bool">${match}</span>`;
      if (/null/.test(match)) return `<span class="tok-null">${match}</span>`;
      return `<span class="tok-num">${match}</span>`;
    },
  );

const sortDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortDeep(value[key])]),
    );
  }
  return value;
};

const describe = (value) => {
  let nodes = 0;
  let depth = 0;
  const walk = (node, level) => {
    nodes += 1;
    depth = Math.max(depth, level);
    if (Array.isArray(node)) node.forEach((item) => walk(item, level + 1));
    else if (node && typeof node === 'object') Object.values(node).forEach((item) => walk(item, level + 1));
  };
  walk(value, 1);
  return { nodes, depth };
};

class JsonFormatter extends JGApp {
  static appId = 'json-formatter';
  static settings = [
    { key: 'indent', label: t('json-formatter.indent', 'Indent'), type: 'select', default: '2', options: [
      { value: '2', label: t('json-formatter.spaces2', '2 spaces') },
      { value: '4', label: t('json-formatter.spaces4', '4 spaces') },
      { value: 'tab', label: t('json-formatter.tab', 'Tab') },
    ] },
    { key: 'sortKeys', label: t('json-formatter.sortKeys', 'Sort keys'), type: 'switch', default: false },
  ];
  static styles = [...JGApp.styles, sheet];

  #parsed = null;

  tools() {
    return [
      {
        name: 'format_json',
        description: 'Format a JSON document with indentation, or report where it is malformed',
        params: {
          text: { type: 'string', description: 'The JSON document to format', required: true },
          indent: { type: 'integer', description: 'Spaces per level, 0 for minified' },
        },
        run: ({ text, indent = 2 }) => {
          try {
            return JSON.stringify(JSON.parse(text), null, Number(indent) || 0);
          } catch (failure) {
            return `Not valid JSON: ${failure.message}`;
          }
        },
      },
      {
        name: 'check_json',
        description: 'Say whether a JSON document parses, and where it fails if it does not',
        params: { text: { type: 'string', description: 'The JSON document to check', required: true } },
        run: ({ text }) => {
          try {
            JSON.parse(text);
            return 'Valid JSON.';
          } catch (failure) {
            return `Not valid JSON: ${failure.message}`;
          }
        },
      },
    ];
  }

  renderApp() {
    const indent = this.config.get('indent', '2');
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="mode"></jg-tabs>
        <span class="grow"></span>
        <jg-select id="indent" size="sm" value="${indent}" style="width:120px">
          <option value="2">${t('json-formatter.spaces2', '2 spaces')}</option>
          <option value="4">${t('json-formatter.spaces4', '4 spaces')}</option>
          <option value="tab">${t('json-formatter.tab', 'Tab')}</option>
        </jg-select>
        <jg-button size="sm" variant="outline" id="sample">${t('json-formatter.sample', 'Sample')}</jg-button>
        <jg-button size="sm" variant="outline" id="copy">${t('action.copy', 'Copy')}</jg-button>
        <jg-button size="sm" variant="outline" id="save">${t('action.download', 'Download')}</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <div class="label">${t('json-formatter.input', 'Input')}</div>
          <jg-code id="input" grow gutter language="json" placeholder="${t('json-formatter.paste', 'Paste JSON here')}"></jg-code>
        </div>
        <div class="pane">
          <div class="status" id="status"></div>
          <div class="view" id="output"></div>
        </div>
      </div>
    </div>`);

    this.$('#mode').items = [
      { value: 'pretty', label: t('json-formatter.formatted', 'Formatted') },
      { value: 'minify', label: t('json-formatter.minified', 'Minified') },
      { value: 'tree', label: t('json-formatter.tree', 'Tree') },
    ];

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 150));
    this.on(this.$('#mode'), 'change', () => this.#run());
    this.on(this.$('#indent'), 'change', (event) => {
      this.config.set('indent', event.detail.value);
      this.#run();
    });
    this.on(this.$('#sample'), 'click', () => {
      this.$('#input').value = SAMPLE;
      this.#run();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.#output()));
    this.on(this.$('#save'), 'click', () => download('data.json', this.#output(), 'application/json'));

    this.#run();
  }

  #indentValue() {
    const setting = this.config.get('indent', '2');
    return setting === 'tab' ? '\t' : Number(setting);
  }

  #output() {
    if (!this.#parsed) return '';
    const mode = this.$('#mode').value;
    const value = this.config.get('sortKeys', false) ? sortDeep(this.#parsed) : this.#parsed;
    return mode === 'minify' ? JSON.stringify(value) : JSON.stringify(value, null, this.#indentValue());
  }

  #run() {
    const source = this.$('#input').value.trim();
    const status = this.$('#status');
    const output = this.$('#output');

    if (!source) {
      this.#parsed = null;
      status.innerHTML = html`<span class="hint">${t('json-formatter.waiting', 'Waiting for input')}</span>`;
      output.innerHTML = '';
      return;
    }

    try {
      this.#parsed = JSON.parse(source);
    } catch (error) {
      this.#parsed = null;
      const position = Number(/position (\d+)/.exec(error.message)?.[1] ?? -1);
      const line = position >= 0 ? source.slice(0, position).split('\n').length : null;
      status.innerHTML = html`<jg-badge tone="danger">${t('json-formatter.invalid', 'Invalid JSON')}</jg-badge><span class="error">${error.message}</span>`;
      output.innerHTML = html`<span class="muted">${line ? t('json-formatter.checkLine', `Check line ${line}.`, { line }) : t('json-formatter.fixSyntax', 'Fix the syntax to continue.')}</span>`;
      return;
    }

    const stats = describe(this.#parsed);
    const text = this.#output();
    status.innerHTML = html`<jg-badge tone="success">${t('json-formatter.valid', 'Valid')}</jg-badge>
      <span class="hint">${t('json-formatter.stats', `${stats.nodes} nodes · depth ${stats.depth} · ${text.length} chars`, { nodes: stats.nodes, depth: stats.depth, chars: text.length })}</span>`;

    if (this.$('#mode').value === 'tree') {
      output.style.whiteSpace = 'normal';
      output.innerHTML = this.#tree(this.#parsed, 'root');
      output.querySelectorAll('details').forEach((node) => {
        if (node.dataset.depth === '0') node.open = true;
      });
    } else {
      output.style.whiteSpace = 'pre';
      output.innerHTML = highlight(text);
    }
  }

  #tree(value, key, depth = 0) {
    if (Array.isArray(value)) {
      return html`<details data-depth="${depth}" ${depth < 2 ? 'open' : ''}>
        <summary><span class="tok-key">${key}</span> <span class="muted">[${value.length}]</span></summary>
        ${raw(value.map((item, index) => this.#tree(item, String(index), depth + 1)).join(''))}
      </details>`;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      return html`<details data-depth="${depth}" ${depth < 2 ? 'open' : ''}>
        <summary><span class="tok-key">${key}</span> <span class="muted">{${keys.length}}</span></summary>
        ${raw(keys.map((childKey) => this.#tree(value[childKey], childKey, depth + 1)).join(''))}
      </details>`;
    }
    const type = value === null ? 'null' : typeof value === 'string' ? 'str' : typeof value === 'number' ? 'num' : 'bool';
    return html`<div style="margin-left:12px">
      <span class="tok-key">${key}</span>: <span class="tok-${type}">${JSON.stringify(value)}</span>
    </div>`;
  }
}

define('jg-app-json-formatter', JsonFormatter);
