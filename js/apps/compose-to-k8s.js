import { JGApp, define, html, css } from '../core/app.js';
import { fromYaml, toYaml } from '../core/yaml.js';
import { convert, CONTROLLERS, slug } from '../lib/compose-k8s.js';
import { debounce, copyText, download } from '../core/util.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @container (max-width: 900px) { .shell { grid-template-columns: 1fr; } }
  .app { container-type: inline-size; }
  .pane { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
    gap: 10px;
    align-items: end;
  }
  .flags { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .flags label { display: flex; align-items: center; gap: 6px; font: 500 12px/1 var(--font-sans); color: var(--muted-foreground); }
  .notes {
    max-height: 132px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 9px 11px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
  }
  .notes p { margin: 0; font: 400 11.5px/1.45 var(--font-sans); color: var(--muted-foreground); }
  .notes p::before { content: '•'; margin-right: 6px; color: var(--ring); }
  .tally { display: flex; gap: 10px; flex-wrap: wrap; font: 500 11.5px/1 var(--font-mono); color: var(--muted-foreground); }
  .bad { color: var(--destructive); font: 500 12px/1.4 var(--font-sans); }
`;

const SAMPLE = `services:
  web:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
    environment:
      NODE_ENV: production
    volumes:
      - assets:/usr/share/nginx/html
    depends_on:
      - api
    deploy:
      replicas: 2
      resources:
        limits: { cpus: "0.5", memory: 512M }

  api:
    image: node:20-alpine
    command: ["node", "server.js"]
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - DATABASE_URL=postgres://db:5432/shop
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - data:/var/lib/postgresql/data

volumes:
  assets:
  data:
`;

const POLICIES = ['IfNotPresent', 'Always', 'Never'];

class ComposeToK8s extends JGApp {
  static appId = 'compose-to-k8s';
  static styles = [...JGApp.styles, sheet];
  static settings = [
    { key: 'storage', label: 'Default volume size', type: 'text', value: '1Gi' },
    { key: 'replicas', label: 'Replicas when compose does not say', type: 'number', value: 1, min: 1, max: 20 },
  ];

  #documents = [];

  renderApp() {
    const saved = this.store.read({});

    this.paint(html`<div class="app">
      <jg-toolbar id="bar"></jg-toolbar>

      <div class="controls">
        <jg-field label="Namespace"><jg-input id="namespace" mono value="${saved.namespace ?? 'default'}"></jg-input></jg-field>
        <jg-field label="Ingress controller">
          <jg-select id="controller" value="${saved.controller ?? 'nginx'}">
            ${Object.entries(CONTROLLERS).map(([key, meta]) => html`<option value="${key}">${meta.label}</option>`)}
          </jg-select>
        </jg-field>
        <jg-field label="Host domain"><jg-input id="domain" mono value="${saved.domain ?? 'example.com'}"></jg-input></jg-field>
        <jg-field label="Image pull policy">
          <jg-select id="pullPolicy" value="${saved.pullPolicy ?? 'IfNotPresent'}">
            ${POLICIES.map((policy) => html`<option value="${policy}">${policy}</option>`)}
          </jg-select>
        </jg-field>
        <div class="flags">
          <label><jg-switch id="tls" ${saved.tls ? 'checked' : ''}></jg-switch>Request TLS</label>
        </div>
      </div>

      <div class="shell">
        <div class="pane">
          <div class="row" style="justify-content:space-between">
            <span class="label">docker-compose.yml</span>
            <jg-button size="sm" variant="ghost" id="sample">Load a sample</jg-button>
          </div>
          <jg-code id="in" grow gutter language="yaml" placeholder="Paste a compose file"></jg-code>
        </div>

        <div class="pane">
          <div class="row" style="justify-content:space-between">
            <span class="label">Kubernetes manifests</span>
            <span class="tally" id="tally"></span>
          </div>
          <jg-code id="out" grow gutter language="yaml" readonly></jg-code>
          <div class="notes" id="notes" hidden></div>
        </div>
      </div>
    </div>`);

    this.$('#bar').items = [
      { id: 'copy', label: 'Copy', icon: 'copy', action: () => copyText(this.$('#out').value) },
      { id: 'download', label: 'Download', icon: 'download', action: () => this.#download() },
      { spacer: true },
      { id: 'clear', label: 'Clear', icon: 'eraser', iconOnly: true, title: 'Empty the input', action: () => this.#clear() },
    ];

    this.$('#in').value = saved.source ?? SAMPLE;

    const run = debounce(() => this.#run(), 140);
    this.on(this.$('#in'), 'input', run);
    ['#namespace', '#domain'].forEach((id) => this.on(this.$(id), 'input', run));
    ['#controller', '#pullPolicy', '#tls'].forEach((id) => this.on(this.$(id), 'change', run));
    this.bind('#sample', 'click', () => {
      this.$('#in').value = SAMPLE;
      this.#run();
    });

    this.#run();
  }

  #clear() {
    this.$('#in').value = '';
    this.#run();
  }

  #options() {
    return {
      namespace: this.$('#namespace').value.trim() || 'default',
      controller: this.$('#controller').value,
      domain: this.$('#domain').value.trim() || 'example.com',
      pullPolicy: this.$('#pullPolicy').value,
      tls: this.$('#tls').checked,
      storage: this.config.get('storage', '1Gi'),
      replicas: Number(this.config.get('replicas', 1)),
    };
  }

  #run() {
    const source = this.$('#in').value;
    const options = this.#options();
    this.store.write({ source, ...options, storage: undefined, replicas: undefined });

    const notes = this.$('#notes');
    const tally = this.$('#tally');

    if (!source.trim()) {
      this.#documents = [];
      this.$('#out').value = '';
      tally.textContent = '';
      notes.hidden = true;
      return;
    }

    let parsed = null;
    try {
      parsed = fromYaml(source);
    } catch (error) {
      this.$('#out').value = '';
      this.#documents = [];
      tally.textContent = '';
      notes.hidden = false;
      notes.innerHTML = html`<p class="bad">That does not parse as YAML. ${error.message}</p>`;
      return;
    }

    const { documents, warnings } = convert(parsed, options);
    this.#documents = documents;
    this.$('#out').value = documents.map((document) => toYaml(document)).join('\n---\n');

    const counts = documents.reduce((seen, document) => {
      seen[document.kind] = (seen[document.kind] ?? 0) + 1;
      return seen;
    }, {});
    tally.textContent = Object.entries(counts)
      .map(([kind, count]) => `${count} ${count === 1 ? kind : kind.endsWith('s') ? `${kind}es` : `${kind}s`}`)
      .join('   ');

    notes.hidden = !warnings.length;
    notes.innerHTML = warnings.map((warning) => html`<p>${warning}</p>`).join('');
  }

  #download() {
    if (!this.#documents.length) return;
    const name = slug(this.$('#namespace').value.trim() || 'manifests');
    download(`${name}.yaml`, this.$('#out').value, 'text/yaml;charset=utf-8');
  }
}

define('jg-app-compose-to-k8s', ComposeToK8s);
