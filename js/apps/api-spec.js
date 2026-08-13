import { JGApp, define, html, css } from '../core/app.js';
import { toYaml, fromYaml } from '../core/yaml.js';
import { debounce, copyText, download, toast } from '../core/util.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 1fr 340px; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 8px; min-width: 0; min-height: 0; }
  .side { overflow: auto; scrollbar-width: thin; gap: 10px; }
  .route {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px;
    align-items: baseline;
    width: 100%;
    text-align: left;
    padding: 7px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
  }
  .route:hover { background: var(--accent); }
  .route .path { font-family: var(--font-mono); font-size: 11.5px; overflow-wrap: anywhere; }
  .route .summary { grid-column: 2; font-size: 11px; color: var(--muted-foreground); }
  .verb {
    font: 600 9.5px/1 var(--font-mono);
    letter-spacing: 0.06em;
    padding: 4px 6px;
    border-radius: 4px;
    color: #fff;
    text-transform: uppercase;
  }
  .verb[data-m="get"] { background: #3f6b91; }
  .verb[data-m="post"] { background: #4a7a58; }
  .verb[data-m="put"] { background: #96703f; }
  .verb[data-m="patch"] { background: #6a5a8c; }
  .verb[data-m="delete"] { background: #8a1c3b; }
  .verb[data-m="head"], .verb[data-m="options"] { background: #5b6470; }
  .issues { display: grid; gap: 5px; }
  .issue { display: flex; gap: 7px; align-items: baseline; font-size: 12px; color: var(--muted-foreground); }
  .issue b { color: var(--warning); font-weight: 600; }
  .issue.bad b { color: var(--destructive); }
`;

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

const SAMPLE = `openapi: 3.0.3
info:
  title: Toolbox API
  version: 1.0.0
  description: Example specification
servers:
  - url: https://api.example.com/v1
paths:
  /tools:
    get:
      summary: List tools
      operationId: listTools
      responses:
        '200':
          description: A list of tools
    post:
      summary: Create a tool
      operationId: createTool
      responses:
        '201':
          description: Created
  /tools/{id}:
    get:
      summary: Read one tool
      operationId: getTool
      responses:
        '200':
          description: The tool
        '404':
          description: Not found
    delete:
      summary: Remove a tool
      operationId: deleteTool
      responses:
        '204':
          description: Removed
`;

const lint = (spec) => {
  const issues = [];
  if (!spec || typeof spec !== 'object') return [{ level: 'bad', text: 'The document is not an object.' }];

  if (!spec.openapi && !spec.swagger) issues.push({ level: 'bad', text: 'Missing openapi or swagger version field.' });
  if (!spec.info) issues.push({ level: 'bad', text: 'Missing info object.' });
  else {
    if (!spec.info.title) issues.push({ level: 'bad', text: 'info.title is required.' });
    if (!spec.info.version) issues.push({ level: 'bad', text: 'info.version is required.' });
  }
  if (!spec.paths || !Object.keys(spec.paths).length) issues.push({ level: 'bad', text: 'No paths are defined.' });

  const seen = new Set();
  Object.entries(spec.paths ?? {}).forEach(([path, item]) => {
    if (!path.startsWith('/')) issues.push({ level: 'warn', text: `Path "${path}" should start with a slash.` });
    const params = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);

    METHODS.forEach((method) => {
      const operation = item?.[method];
      if (!operation) return;
      if (!operation.responses || !Object.keys(operation.responses).length) {
        issues.push({ level: 'bad', text: `${method.toUpperCase()} ${path} has no responses.` });
      }
      if (!operation.summary && !operation.description) {
        issues.push({ level: 'warn', text: `${method.toUpperCase()} ${path} has no summary.` });
      }
      if (operation.operationId) {
        if (seen.has(operation.operationId)) {
          issues.push({ level: 'bad', text: `operationId "${operation.operationId}" is used more than once.` });
        }
        seen.add(operation.operationId);
      } else {
        issues.push({ level: 'warn', text: `${method.toUpperCase()} ${path} has no operationId.` });
      }

      const declared = [...(item.parameters ?? []), ...(operation.parameters ?? [])]
        .filter((parameter) => parameter?.in === 'path')
        .map((parameter) => parameter.name);
      params
        .filter((name) => !declared.includes(name))
        .forEach((name) => issues.push({ level: 'warn', text: `${method.toUpperCase()} ${path} does not declare path parameter "${name}".` }));
    });
  });

  return issues;
};

class ApiSpec extends JGApp {
  static appId = 'api-spec';
  static styles = [...JGApp.styles, sheet];

  #format = 'yaml';
  #spec = null;

  renderApp() {
    this.paint(html`<div class="app">
      <jg-toolbar id="bar"></jg-toolbar>

      <div class="shell">
        <div class="pane">
          <jg-code id="editor" grow gutter language="yaml" placeholder="Paste an OpenAPI document"></jg-code>
          <div class="row">
            <jg-badge id="status" tone="muted">Waiting</jg-badge>
            <span class="hint" id="summary"></span>
          </div>
        </div>

        <div class="pane side">
          <jg-card title="Endpoints" sub="Click one to jump to it">
            <div class="stack tight" id="routes"></div>
          </jg-card>
          <jg-card title="Checks">
            <div class="issues" id="issues"></div>
          </jg-card>
        </div>
      </div>
    </div>`);

    this.$('#bar').items = [
      { id: 'yaml', label: 'YAML', icon: 'braces', select: true },
      { id: 'json', label: 'JSON', icon: 'code', select: true },
      { separator: true },
      { id: 'sample', label: 'Sample', icon: 'spec' },
      { id: 'format', label: 'Tidy', icon: 'alignLeft' },
      { spacer: true },
      { id: 'copy', label: 'Copy', icon: 'fileText' },
      { id: 'download', label: 'Download', icon: 'server' },
    ];
    this.$('#bar').value = this.#format;

    this.on(this.$('#bar'), 'select', (event) => {
      const id = event.detail.id;
      if (id === 'yaml' || id === 'json') return this.#convert(id);
      if (id === 'sample') {
        this.#format = 'yaml';
        this.$('#bar').value = 'yaml';
        this.$('#editor').language = 'yaml';
        this.$('#editor').value = SAMPLE;
        return this.#run();
      }
      if (id === 'format') return this.#tidy();
      if (id === 'copy') return copyText(this.$('#editor').value);
      if (id === 'download') {
        return download(`openapi.${this.#format}`, this.$('#editor').value, 'text/plain');
      }
      return undefined;
    });

    this.on(this.$('#editor'), 'input', debounce(() => this.#run(), 300));

    const saved = this.store.read({ source: '', format: 'yaml' });
    this.#format = saved.format ?? 'yaml';
    this.$('#bar').value = this.#format;
    this.$('#editor').language = this.#format;
    this.$('#editor').value = saved.source || SAMPLE;
    this.#run();
  }

  #parse(text) {
    const source = text.trim();
    if (!source) return null;
    if (source.startsWith('{')) return JSON.parse(source);
    return fromYaml(source);
  }

  #convert(format) {
    if (format === this.#format) return;
    try {
      const spec = this.#parse(this.$('#editor').value);
      this.#format = format;
      this.$('#bar').value = format;
      this.$('#editor').language = format;
      this.$('#editor').value = format === 'json' ? JSON.stringify(spec, null, 2) : toYaml(spec);
      this.#run();
    } catch (error) {
      this.$('#bar').value = this.#format;
      toast(`Cannot convert: ${error.message}`, 'error');
    }
  }

  #tidy() {
    try {
      const spec = this.#parse(this.$('#editor').value);
      this.$('#editor').value = this.#format === 'json' ? JSON.stringify(spec, null, 2) : toYaml(spec);
      this.#run();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  #run() {
    const source = this.$('#editor').value;
    this.store.write({ source, format: this.#format });

    const status = this.$('#status');
    let spec = null;

    try {
      spec = this.#parse(source);
    } catch (error) {
      status.setAttribute('tone', 'danger');
      status.textContent = 'Parse error';
      this.$('#summary').textContent = error.message;
      this.$('#routes').innerHTML = '';
      this.$('#issues').innerHTML = '';
      return;
    }

    this.#spec = spec;
    const issues = lint(spec);
    const blocking = issues.filter((issue) => issue.level === 'bad').length;

    const operations = Object.entries(spec?.paths ?? {}).flatMap(([path, item]) =>
      METHODS.filter((method) => item?.[method]).map((method) => ({ path, method, operation: item[method] })),
    );

    status.setAttribute('tone', blocking ? 'danger' : issues.length ? 'warning' : 'success');
    status.textContent = blocking ? `${blocking} problem${blocking === 1 ? '' : 's'}` : issues.length ? 'Valid with notes' : 'Valid';
    this.$('#summary').textContent = spec?.info
      ? `${spec.info.title ?? 'Untitled'} ${spec.info.version ?? ''} - ${operations.length} operation${operations.length === 1 ? '' : 's'}`
      : `${operations.length} operations`;

    this.$('#routes').innerHTML = operations.length
      ? operations
          .map(
            ({ path, method, operation }) => html`<button class="route" data-path="${path}" data-method="${method}">
              <span class="verb" data-m="${method}">${method}</span>
              <span class="path">${path}</span>
              ${operation.summary ? html`<span class="summary">${operation.summary}</span>` : ''}
            </button>`,
          )
          .join('')
      : html`<span class="hint">No operations found.</span>`;

    this.bind('.route', 'click', (event) => this.#jump(event.currentTarget.dataset.path));

    this.$('#issues').innerHTML = issues.length
      ? issues
          .map((issue) => html`<div class="issue ${issue.level === 'bad' ? 'bad' : ''}"><b>${issue.level === 'bad' ? '!' : '?'}</b><span>${issue.text}</span></div>`)
          .join('')
      : html`<span class="hint">Everything the linter checks looks fine.</span>`;
  }

  #jump(path) {
    const editor = this.$('#editor');
    const index = editor.value.indexOf(path);
    if (index < 0) return;
    const line = editor.value.slice(0, index).split('\n').length;
    editor.focus();
    const inner = editor.shadowRoot.querySelector('.editor');
    inner.setSelectionRange(index, index + path.length);
    inner.blur();
    inner.focus();
    editor.shadowRoot.querySelector('.scroll').scrollTop = Math.max(0, (line - 4) * 20);
  }
}

define('jg-app-api-spec', ApiSpec);
