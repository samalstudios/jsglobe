import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, download } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-width: 0; min-height: 0; }
  .issues { display: grid; gap: 5px; }
  .issue { display: grid; grid-template-columns: 180px 1fr; gap: 10px; font-size: 12.5px; }
  .issue .path { font-family: var(--font-mono); color: var(--destructive); overflow-wrap: anywhere; }
`;

const SAMPLE = `{
  "id": "8f1c",
  "name": "Ada Lovelace",
  "age": 36,
  "active": true,
  "email": "ada@example.com",
  "signedUp": "2026-02-14T09:30:00Z",
  "tags": ["engineer", "mathematics"],
  "address": { "city": "London", "postcode": "NW1", "country": "GB" },
  "score": 4.5,
  "manager": null
}`;

const FORMATS = [
  [/^[^@\s]+@[^@\s.]+\.[^@\s]+$/, 'email'],
  [/^(https?|ftp):\/\/\S+$/i, 'uri'],
  [/^\d{4}-\d{2}-\d{2}$/, 'date'],
  [/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, 'date-time'],
  [/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'uuid'],
  [/^(\d{1,3}\.){3}\d{1,3}$/, 'ipv4'],
  [/^#[0-9a-f]{3,8}$/i, 'color'],
];

const detectFormat = (value) => {
  const found = FORMATS.find(([pattern]) => pattern.test(value));
  return found ? found[1] : null;
};

const typeOf = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};

const merge = (left, right) => {
  if (!left) return right;
  if (!right) return left;

  const types = new Set([...[].concat(left.type ?? []), ...[].concat(right.type ?? [])]);
  if (types.has('number') && types.has('integer')) types.delete('integer');

  const merged = { type: types.size === 1 ? [...types][0] : [...types] };

  if (left.properties || right.properties) {
    const keys = new Set([...Object.keys(left.properties ?? {}), ...Object.keys(right.properties ?? {})]);
    merged.properties = Object.fromEntries(
      [...keys].map((key) => [key, merge(left.properties?.[key], right.properties?.[key])]),
    );
    const leftRequired = left.required ?? Object.keys(left.properties ?? {});
    const rightRequired = right.required ?? Object.keys(right.properties ?? {});
    merged.required = leftRequired.filter((key) => rightRequired.includes(key));
    if (!merged.required.length) delete merged.required;
  }

  if (left.items || right.items) merged.items = merge(left.items, right.items);

  const format = left.format === right.format ? left.format : null;
  if (format) merged.format = format;

  const enums = left.enum && right.enum ? [...new Set([...left.enum, ...right.enum])] : null;
  if (enums && enums.length <= 12) merged.enum = enums;

  return merged;
};

const infer = (value, options) => {
  const type = typeOf(value);

  if (type === 'object') {
    const properties = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, infer(entry, options)]));
    const schema = { type: 'object', properties };
    if (options.required) schema.required = Object.keys(properties);
    if (options.strict) schema.additionalProperties = false;
    return schema;
  }

  if (type === 'array') {
    const items = value.map((entry) => infer(entry, options)).reduce((left, right) => merge(left, right), null);
    return { type: 'array', items: items ?? {} };
  }

  const schema = { type };

  if (type === 'string') {
    const format = options.formats ? detectFormat(value) : null;
    if (format) schema.format = format;
    if (options.examples && !format) schema.examples = [value];
  }

  if (options.examples && (type === 'integer' || type === 'number')) schema.examples = [value];

  return schema;
};

const validate = (value, schema, path = '$') => {
  const issues = [];
  if (!schema || typeof schema !== 'object') return issues;

  const types = [].concat(schema.type ?? []);
  const actual = typeOf(value);

  if (types.length && !types.includes(actual) && !(types.includes('number') && actual === 'integer')) {
    issues.push({ path, message: `expected ${types.join(' or ')} but found ${actual}` });
    return issues;
  }

  if (actual === 'object') {
    (schema.required ?? []).forEach((key) => {
      if (!(key in value)) issues.push({ path: `${path}.${key}`, message: 'required property is missing' });
    });
    Object.entries(schema.properties ?? {}).forEach(([key, child]) => {
      if (key in value) issues.push(...validate(value[key], child, `${path}.${key}`));
    });
    if (schema.additionalProperties === false) {
      Object.keys(value)
        .filter((key) => !(schema.properties ?? {})[key])
        .forEach((key) => issues.push({ path: `${path}.${key}`, message: 'property is not allowed by the schema' }));
    }
  }

  if (actual === 'array' && schema.items) {
    value.forEach((entry, index) => issues.push(...validate(entry, schema.items, `${path}[${index}]`)));
  }

  if (schema.enum && !schema.enum.includes(value)) {
    issues.push({ path, message: `value is not one of ${schema.enum.join(', ')}` });
  }

  return issues;
};

class JsonSchema extends JGApp {
  static appId = 'json-schema';
  static styles = [...JGApp.styles, sheet];

  #mode = 'infer';

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-switch id="required" checked></jg-switch><span class="hint">Mark properties required</span>
        <jg-switch id="formats" checked></jg-switch><span class="hint">Detect formats</span>
        <jg-switch id="strict"></jg-switch><span class="hint">No extra properties</span>
        <jg-switch id="examples"></jg-switch><span class="hint">Include examples</span>
        <span class="grow"></span>
        <jg-badge id="status" tone="muted">Waiting</jg-badge>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label" id="left-label">Sample JSON</span>
          <jg-code id="input" grow gutter language="json" placeholder="Paste one or more JSON documents"></jg-code>
        </div>
        <div class="pane">
          <span class="label" id="right-label">JSON Schema</span>
          <jg-code id="output" grow gutter language="json" readonly></jg-code>
        </div>
      </div>

      <jg-card title="Result" id="result-card">
        <div class="issues" id="issues"></div>
      </jg-card>
    </div>`);

    this.setActions([
      { id: 'infer', label: 'Infer schema', icon: 'spec', select: true, action: () => this.#mode_set('infer') },
      { id: 'validate', label: 'Validate against schema', icon: 'shieldCheck', select: true, action: () => this.#mode_set('validate') },
      { separator: true },
      {
        id: 'sample',
        label: 'Sample',
        icon: 'braces',
        action: () => {
          this.$('#input').value = SAMPLE;
          this.#run();
        },
      },
      { spacer: true },
      { id: 'copy', label: 'Copy', icon: 'copy', action: () => copyText(this.$('#output').value) },
      {
        id: 'download',
        label: 'Download',
        icon: 'external',
        action: () => download('schema.json', this.$('#output').value, 'application/json'),
      },
    ]);
    this.setActiveAction(this.#mode);

    const run = debounce(() => this.#run(), 300);
    this.on(this.$('#input'), 'input', run);
    this.on(this.$('#output'), 'input', run);
    ['#required', '#formats', '#strict', '#examples'].forEach((selector) => this.on(this.$(selector), 'change', () => this.#run()));

    const saved = this.store.read({ input: '', schema: '' });
    this.$('#input').value = saved.input || SAMPLE;
    if (saved.schema) this.$('#output').value = saved.schema;
    this.#run();
  }

  #mode_set(mode) {
    this.#mode = mode;
    this.setActiveAction(mode);
    this.$('#right-label').textContent = mode === 'infer' ? 'JSON Schema' : 'Schema to validate against';
    this.$('#output').toggleAttribute('readonly', mode === 'infer');
    this.#run();
  }

  #documents(text) {
    const trimmed = text.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return [parsed];
    } catch (error) {
      const lines = trimmed.split('\n').filter((line) => line.trim());
      const documents = lines.map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return undefined;
        }
      });
      if (documents.every((entry) => entry !== undefined)) return documents;
      throw error;
    }
  }

  #run() {
    const status = this.$('#status');
    const issues = this.$('#issues');
    let documents = [];

    try {
      documents = this.#documents(this.$('#input').value);
    } catch (error) {
      status.setAttribute('tone', 'danger');
      status.textContent = 'Invalid JSON';
      issues.innerHTML = html`<div class="hint">${error.message}</div>`;
      return;
    }

    if (!documents.length) {
      status.setAttribute('tone', 'muted');
      status.textContent = 'Waiting';
      issues.innerHTML = '';
      return;
    }

    if (this.#mode === 'infer') {
      const options = {
        required: this.$('#required').checked,
        formats: this.$('#formats').checked,
        strict: this.$('#strict').checked,
        examples: this.$('#examples').checked,
      };

      const schema = documents.map((document) => infer(document, options)).reduce((left, right) => merge(left, right), null);
      const output = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'Generated schema',
        ...schema,
      };

      this.$('#output').value = JSON.stringify(output, null, 2);
      status.setAttribute('tone', 'success');
      status.textContent = documents.length === 1 ? 'Schema ready' : `Merged ${documents.length} documents`;

      const count = (node) => {
        if (!node || typeof node !== 'object') return 0;
        return Object.keys(node.properties ?? {}).length + Object.values(node.properties ?? {}).reduce((total, child) => total + count(child), 0);
      };

      issues.innerHTML = html`<div class="hint">
        ${count(schema)} properties described. Optional properties appear when a key is missing from one of the
        merged documents.
      </div>`;

      this.store.write({ input: this.$('#input').value, schema: this.$('#output').value });
      return;
    }

    let schema = null;
    try {
      schema = JSON.parse(this.$('#output').value || '{}');
    } catch (error) {
      status.setAttribute('tone', 'danger');
      status.textContent = 'Schema is not valid JSON';
      issues.innerHTML = html`<div class="hint">${error.message}</div>`;
      return;
    }

    const found = documents.flatMap((document, index) =>
      validate(document, schema, documents.length > 1 ? `$[${index}]` : '$'),
    );

    status.setAttribute('tone', found.length ? 'danger' : 'success');
    status.textContent = found.length ? `${found.length} problem${found.length === 1 ? '' : 's'}` : 'Valid';

    issues.innerHTML = found.length
      ? found
          .slice(0, 40)
          .map((issue) => html`<div class="issue"><span class="path">${issue.path}</span><span>${issue.message}</span></div>`)
          .join('')
      : html`<div class="hint">Every document matches the schema.</div>`;

    this.store.write({ input: this.$('#input').value, schema: this.$('#output').value });
  }
}

define('jg-app-json-schema', JsonSchema);
