import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { copyText, download, toast } from '../../core/util.js';
import { createClient, fieldsOf, exampleFor, problemsWith, expandTemplate, templateNames } from '../../lib/mcp.js';
import { highlight } from '../../lib/syntax.js';

const t = await appWords('mcp-tester', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const stamp = () => new Date().toTimeString().slice(0, 8);
const pretty = (value) => JSON.stringify(value, null, 2);
const LONG_TEXT = /text|code|content|body|message|prompt|script|query|markdown|html|sql/i;

class McpTester extends JGApp {
  static appId = 'mcp-tester';
  static styles = [...JGApp.styles, sheet];

  #client = null;
  #state = 'closed';
  #tab = 'tools';
  #tools = [];
  #resources = [];
  #templates = [];
  #prompts = [];
  #messages = [];
  #picked = { tools: null, resources: null, prompts: null };
  #filter = '';
  #asJson = false;
  #results = { tools: null, resources: null, prompts: null };

  renderApp() {
    const saved = this.store.read({ url: '', transport: 'demo', history: [] });
    this.paint(html`<div class="app">
      <div class="connect">
        <jg-select id="transport" value="${saved.transport}" style="width:170px">
          <option value="http">${t('mcp-tester.streamableHttp', 'Streamable HTTP')}</option>
          <option value="sse">${t('mcp-tester.sseLegacy', 'SSE (legacy)')}</option>
          <option value="demo">${t('mcp-tester.demoServer', 'Demo server')}</option>
        </jg-select>
        <jg-input id="url" class="grow" mono value="${saved.url}" placeholder="https://example.com/mcp"></jg-input>
        <jg-button id="toggle">${t('mcp-tester.connect', 'Connect')}</jg-button>
      </div>
      <details class="auth" id="auth">
        <summary>${t('mcp-tester.headers', 'Headers')}</summary>
        <div class="stack tight">
          <jg-input id="token" mono type="password" placeholder="${t('mcp-tester.bearerToken', 'Bearer token')}"></jg-input>
          <jg-textarea id="headers" rows="2" placeholder="X-Api-Key: value"></jg-textarea>
          <span class="hint">${t('mcp-tester.headersStayInThisWindow', 'Headers are sent with every request and never saved.')}</span>
        </div>
      </details>

      <div class="status">
        <jg-badge id="status" tone="muted">${t('mcp-tester.notConnected', 'Not connected')}</jg-badge>
        <span class="server" id="server"></span>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="ping" disabled>${t('mcp-tester.ping', 'Ping')}</jg-button>
        <jg-button size="sm" variant="ghost" id="reload" disabled>${t('mcp-tester.refreshLists', 'Refresh lists')}</jg-button>
      </div>

      <jg-tabs id="tabs"></jg-tabs>
      <div class="body" id="body"></div>
    </div>`);

    if (saved.transport === 'demo') this.$('#url').setAttribute('disabled', '');
    this.on(this.$('#transport'), 'change', (event) => {
      this.$('#url').toggleAttribute('disabled', event.detail.value === 'demo');
      this.#persist();
    });
    this.on(this.$('#toggle'), 'click', () => (this.#client ? this.#disconnect() : this.#connect()));
    this.on(this.$('#url'), 'keydown', (event) => {
      if (event.key === 'Enter' && !this.#client) this.#connect();
    });
    this.on(this.$('#ping'), 'click', () => this.#ping());
    this.on(this.$('#reload'), 'click', () => this.#loadLists());
    this.on(this.$('#tabs'), 'change', (event) => {
      this.#tab = event.detail.value;
      this.#filter = '';
      this.#paintBody();
    });

    this.#paintTabs();
    this.#paintBody();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#client?.close();
    this.#client = null;
  }

  #persist() {
    const saved = this.store.read({});
    this.store.write({ ...saved, url: this.$('#url').value.trim(), transport: this.$('#transport').value });
  }

  #headers() {
    const headers = {};
    const token = this.$('#token').value.trim();
    if (token) headers.authorization = /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
    for (const line of this.$('#headers').value.split('\n')) {
      const colon = line.indexOf(':');
      if (colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    return headers;
  }

  // ---- connection ------------------------------------------------------

  async #connect() {
    const transport = this.$('#transport').value;
    const url = this.$('#url').value.trim();
    if (transport !== 'demo' && !/^https?:\/\//i.test(url)) {
      toast(t('mcp-tester.theAddressMustStartWith', 'The address must start with http:// or https://'), 'error');
      return;
    }
    this.#persist();
    this.#reset();
    this.#setState('connecting');

    const client = createClient({
      url,
      transport,
      headers: this.#headers(),
      onMessage: (direction, message) => this.#log(direction, message),
      onNotification: (message) => this.#notified(message),
    });
    this.#client = client;
    try {
      await client.connect();
      if (this.#client !== client) return;
      this.#setState('open');
      await this.#loadLists();
    } catch (error) {
      if (this.#client !== client) return;
      this.#log('error', { message: error.message, ...(error.data ? { detail: error.data } : {}) });
      this.#client = null;
      client.close();
      this.#setState('failed', error.message);
    }
  }

  async #disconnect() {
    const client = this.#client;
    this.#client = null;
    this.#setState('closed');
    await client?.close();
  }

  #reset() {
    this.#tools = [];
    this.#resources = [];
    this.#templates = [];
    this.#prompts = [];
    this.#picked = { tools: null, resources: null, prompts: null };
    this.#results = { tools: null, resources: null, prompts: null };
    this.#paintTabs();
    this.#paintBody();
  }

  #setState(state, detail = '') {
    this.#state = state;
    const badge = this.$('#status');
    const server = this.$('#server');
    const tones = { closed: 'muted', connecting: 'warning', open: 'success', failed: 'danger' };
    const labels = {
      closed: t('mcp-tester.notConnected', 'Not connected'),
      connecting: t('mcp-tester.connecting', 'Connecting…'),
      open: t('mcp-tester.connected', 'Connected'),
      failed: t('mcp-tester.failed', 'Failed'),
    };
    badge.setAttribute('tone', tones[state]);
    badge.textContent = labels[state];
    const info = this.#client?.info;
    server.innerHTML = state === 'open' && info
      ? html`<strong>${info.serverInfo?.title ?? info.serverInfo?.name ?? ''}</strong> <span class="muted">${info.serverInfo?.version ?? ''}</span> <span class="pill">${info.protocolVersion}</span>`
      : state === 'failed' ? html`<span class="error-text">${detail}</span>` : '';
    this.$('#toggle').textContent = state === 'open' || state === 'connecting' ? t('mcp-tester.disconnect', 'Disconnect') : t('mcp-tester.connect', 'Connect');
    this.$('#ping').toggleAttribute('disabled', state !== 'open');
    this.$('#reload').toggleAttribute('disabled', state !== 'open');
    if (state !== 'open') this.#paintBody();
  }

  async #loadLists() {
    const client = this.#client;
    const capabilities = client?.info?.capabilities ?? {};
    const attempt = async (enabled, work) => {
      if (!enabled) return [];
      try {
        return await work();
      } catch (error) {
        this.#log('error', { message: error.message });
        return [];
      }
    };
    [this.#tools, this.#resources, this.#templates, this.#prompts] = await Promise.all([
      attempt(capabilities.tools, () => client.listAll('tools/list', 'tools')),
      attempt(capabilities.resources, () => client.listAll('resources/list', 'resources')),
      attempt(capabilities.resources, () => client.listAll('resources/templates/list', 'resourceTemplates')),
      attempt(capabilities.prompts, () => client.listAll('prompts/list', 'prompts')),
    ]);
    if (this.#client !== client) return;
    this.#picked.tools ??= this.#tools[0]?.name ?? null;
    this.#picked.prompts ??= this.#prompts[0]?.name ?? null;
    this.#picked.resources ??= this.#resources[0]?.uri ?? this.#templates[0]?.uriTemplate ?? null;
    this.#paintTabs();
    this.#paintBody();
  }

  async #ping() {
    const started = performance.now();
    try {
      await this.#client.request('ping');
      toast(t('mcp-tester.pongIn', 'Answered in {ms} ms', { ms: Math.round(performance.now() - started) }));
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  #notified(message) {
    const refresh = {
      'notifications/tools/list_changed': true,
      'notifications/resources/list_changed': true,
      'notifications/prompts/list_changed': true,
    };
    if (refresh[message.method]) this.#loadLists();
  }

  // ---- messages --------------------------------------------------------

  #log(direction, message) {
    this.#messages.push({ direction, message, at: stamp() });
    if (this.#messages.length > 500) this.#messages = this.#messages.slice(-500);
    const count = this.$('#tabs')?.shadowRoot?.querySelector('[data-value="messages"]');
    if (count) count.textContent = `${t('mcp-tester.messages', 'Messages')} ${this.#messages.length}`;
    if (this.#tab === 'messages') this.#paintMessages();
  }

  #paintTabs() {
    const label = (text, count) => (count ? `${text} ${count}` : text);
    const tabs = this.$('#tabs');
    tabs.items = [
      { value: 'tools', label: label(t('mcp-tester.toolsTab', 'Tools'), this.#tools.length) },
      { value: 'resources', label: label(t('mcp-tester.resourcesTab', 'Resources'), this.#resources.length + this.#templates.length) },
      { value: 'prompts', label: label(t('mcp-tester.promptsTab', 'Prompts'), this.#prompts.length) },
      { value: 'messages', label: label(t('mcp-tester.messages', 'Messages'), this.#messages.length) },
      { value: 'server', label: t('mcp-tester.serverTab', 'Server') },
    ];
    tabs.value = this.#tab;
  }

  #paintBody() {
    const body = this.$('#body');
    if (!body) return;
    if (this.#tab === 'messages') return this.#paintMessagesPane();
    if (this.#tab === 'server') return this.#paintServer();
    if (this.#state !== 'open') {
      body.innerHTML = html`<jg-empty glyph="⇄" title="${t('mcp-tester.connectToAServer', 'Connect to a server')}">${t('mcp-tester.pickTheDemoServerOr', 'Pick the demo server to try things out, or enter the address of your own MCP server.')}</jg-empty>`;
      return;
    }
    this.#paintSplit();
  }

  // ---- lists and details -----------------------------------------------

  #entries() {
    const query = this.#filter.toLowerCase();
    const match = (...texts) => !query || texts.some((text) => String(text ?? '').toLowerCase().includes(query));
    if (this.#tab === 'tools') {
      return this.#tools.filter((tool) => match(tool.name, tool.title, tool.description)).map((tool) => ({ key: tool.name, title: tool.title ?? tool.name, sub: tool.description, mono: tool.name }));
    }
    if (this.#tab === 'prompts') {
      return this.#prompts.filter((prompt) => match(prompt.name, prompt.title, prompt.description)).map((prompt) => ({ key: prompt.name, title: prompt.title ?? prompt.name, sub: prompt.description, mono: prompt.name }));
    }
    return [
      ...this.#resources.filter((item) => match(item.uri, item.name, item.title)).map((item) => ({ key: item.uri, title: item.title ?? item.name ?? item.uri, sub: item.uri, mono: item.mimeType })),
      ...this.#templates.filter((item) => match(item.uriTemplate, item.name, item.title)).map((item) => ({ key: item.uriTemplate, title: item.title ?? item.name ?? item.uriTemplate, sub: item.uriTemplate, mono: t('mcp-tester.template', 'template') })),
    ];
  }

  #paintSplit() {
    const body = this.$('#body');
    body.innerHTML = html`<div class="split">
      <div class="side">
        <jg-input id="filter" size="sm" placeholder="${t('mcp-tester.filter', 'Filter')}" value="${this.#filter}"></jg-input>
        <div class="entries" id="entries"></div>
      </div>
      <div class="detail" id="detail"></div>
    </div>`;
    this.on(body.querySelector('#filter'), 'input', (event) => {
      this.#filter = event.detail.value;
      this.#paintEntries();
    });
    this.#paintEntries();
    this.#paintDetail();
  }

  #paintEntries() {
    const list = this.$('#entries');
    const entries = this.#entries();
    const picked = this.#picked[this.#tab];
    list.innerHTML = entries.length
      ? entries.map((entry) => html`<button class="entry" data-key="${entry.key}" aria-current="${String(entry.key === picked)}">
          <span class="entry-title">${entry.title}</span>
          ${entry.sub ? html`<span class="entry-sub">${entry.sub}</span>` : ''}
        </button>`).join('')
      : html`<span class="hint pad">${this.#filter ? t('mcp-tester.nothingMatches', 'Nothing matches') : t('mcp-tester.theServerOffersNone', 'The server offers none')}</span>`;
    list.querySelectorAll('[data-key]').forEach((node) => this.on(node, 'click', () => {
      this.#picked[this.#tab] = node.dataset.key;
      this.#results[this.#tab] = null;
      this.#asJson = false;
      list.querySelectorAll('[data-key]').forEach((other) => other.setAttribute('aria-current', String(other === node)));
      this.#paintDetail();
    }));
  }

  #paintDetail() {
    const detail = this.$('#detail');
    if (this.#tab === 'tools') {
      const tool = this.#tools.find((item) => item.name === this.#picked.tools);
      if (!tool) return (detail.innerHTML = '');
      const hints = tool.annotations ?? {};
      detail.innerHTML = html`
        <div class="head">
          <div class="stack tight grow">
            <div class="title">${tool.title ?? tool.name}</div>
            <code class="name">${tool.name}</code>
          </div>
          <div class="row tight">
            ${hints.readOnlyHint ? html`<jg-badge tone="success">${t('mcp-tester.readOnly', 'read only')}</jg-badge>` : ''}
            ${hints.destructiveHint ? html`<jg-badge tone="danger">${t('mcp-tester.destructive', 'destructive')}</jg-badge>` : ''}
            ${hints.idempotentHint ? html`<jg-badge>${t('mcp-tester.idempotent', 'idempotent')}</jg-badge>` : ''}
            ${hints.openWorldHint ? html`<jg-badge tone="warning">${t('mcp-tester.openWorld', 'open world')}</jg-badge>` : ''}
          </div>
        </div>
        ${tool.description ? html`<p class="description">${tool.description}</p>` : ''}
        <div class="spread">
          <span class="label">${t('mcp-tester.arguments', 'Arguments')}</span>
          <jg-button size="sm" variant="ghost" id="as-json">${this.#asJson ? t('mcp-tester.useTheForm', 'Use the form') : t('mcp-tester.editAsJson', 'Edit as JSON')}</jg-button>
        </div>
        <div id="form">${this.#form(tool.inputSchema ?? {})}</div>
        <div class="row">
          <jg-button id="run">${t('mcp-tester.runTool', 'Run tool')}</jg-button>
          <jg-button size="sm" variant="ghost" id="schema">${t('mcp-tester.showSchema', 'Show schema')}</jg-button>
          <span class="grow"></span>
          <span class="hint" id="timing"></span>
        </div>
        <pre class="schema" id="schema-view" hidden>${raw(highlight(pretty({ inputSchema: tool.inputSchema, ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}) }), 'json'))}</pre>
        <div id="result"></div>`;
      this.on(detail.querySelector('#as-json'), 'click', () => {
        const current = this.#readArguments(tool.inputSchema ?? {});
        this.#asJson = !this.#asJson;
        this.#paintDetail();
        if (this.#asJson) this.$('#json-args').value = pretty(current);
      });
      this.on(detail.querySelector('#schema'), 'click', () => {
        const view = this.$('#schema-view');
        view.hidden = !view.hidden;
      });
      this.on(detail.querySelector('#run'), 'click', () => this.#runTool(tool));
      this.#paintResult();
      return;
    }

    if (this.#tab === 'prompts') {
      const prompt = this.#prompts.find((item) => item.name === this.#picked.prompts);
      if (!prompt) return (detail.innerHTML = '');
      const schema = {
        type: 'object',
        properties: Object.fromEntries((prompt.arguments ?? []).map((argument) => [argument.name, { type: 'string', title: argument.title, description: argument.description }])),
        required: (prompt.arguments ?? []).filter((argument) => argument.required).map((argument) => argument.name),
      };
      detail.innerHTML = html`
        <div class="head"><div class="stack tight grow"><div class="title">${prompt.title ?? prompt.name}</div><code class="name">${prompt.name}</code></div></div>
        ${prompt.description ? html`<p class="description">${prompt.description}</p>` : ''}
        ${prompt.arguments?.length ? html`<span class="label">${t('mcp-tester.arguments', 'Arguments')}</span>` : ''}
        <div id="form">${this.#form(schema, true)}</div>
        <div class="row"><jg-button id="run">${t('mcp-tester.getPrompt', 'Get prompt')}</jg-button><span class="grow"></span><span class="hint" id="timing"></span></div>
        <div id="result"></div>`;
      this.on(detail.querySelector('#run'), 'click', () => this.#getPrompt(prompt, schema));
      this.#paintResult();
      return;
    }

    const key = this.#picked.resources;
    const resource = this.#resources.find((item) => item.uri === key);
    const template = this.#templates.find((item) => item.uriTemplate === key);
    const item = resource ?? template;
    if (!item) return (detail.innerHTML = '');
    const names = template ? templateNames(template.uriTemplate) : [];
    detail.innerHTML = html`
      <div class="head">
        <div class="stack tight grow"><div class="title">${item.title ?? item.name ?? key}</div><code class="name">${key}</code></div>
        <div class="row tight">${item.mimeType ? html`<jg-badge>${item.mimeType}</jg-badge>` : ''}${template ? html`<jg-badge tone="accent">${t('mcp-tester.template', 'template')}</jg-badge>` : ''}</div>
      </div>
      ${item.description ? html`<p class="description">${item.description}</p>` : ''}
      ${names.length
        ? html`<div class="form">${names.map((name) => html`<jg-field label="${name}"><jg-input mono data-var="${name}"></jg-input></jg-field>`)}</div>`
        : ''}
      <div class="row"><jg-button id="run">${t('mcp-tester.readResource', 'Read resource')}</jg-button><span class="grow"></span><span class="hint" id="timing"></span></div>
      <div id="result"></div>`;
    this.on(detail.querySelector('#run'), 'click', () => {
      const values = Object.fromEntries(this.$$('[data-var]').map((node) => [node.dataset.var, node.value]));
      this.#readResource(template ? expandTemplate(template.uriTemplate, values) : key);
    });
    this.#paintResult();
  }

  // ---- forms -----------------------------------------------------------

  #form(schema, stringsOnly = false) {
    if (this.#asJson && !stringsOnly) {
      return html`<jg-code id="json-args" language="json" rows="8" value="${pretty(exampleFor(schema))}"></jg-code>`;
    }
    const fields = fieldsOf(schema);
    if (!fields.length) return html`<span class="hint">${t('mcp-tester.noArguments', 'No arguments')}</span>`;
    return html`<div class="form">${fields.map((field) => {
      const label = `${field.title}${field.required ? ' *' : ''}`;
      const hint = field.description;
      const initial = field.default;
      let control;
      if (field.options?.length) {
        control = html`<jg-select data-arg="${field.name}" data-type="${field.type}" value="${initial ?? ''}">
          ${field.required ? '' : html`<option value="">—</option>`}
          ${field.options.map((option) => html`<option value="${option}">${option}</option>`)}
        </jg-select>`;
      } else if (field.type === 'boolean') {
        control = html`<jg-switch data-arg="${field.name}" data-type="boolean" ${initial ? 'checked' : ''}></jg-switch>`;
      } else if (field.type === 'number' || field.type === 'integer') {
        control = html`<jg-input mono type="number" data-arg="${field.name}" data-type="${field.type}" value="${initial ?? ''}" ${field.type === 'integer' ? raw('step="1"') : ''}></jg-input>`;
      } else if (field.type === 'object' || field.type === 'array') {
        control = html`<jg-code language="json" rows="3" data-arg="${field.name}" data-type="${field.type}" value="${pretty(exampleFor(field.schema))}"></jg-code>`;
      } else if (LONG_TEXT.test(field.name) && !field.schema.maxLength) {
        control = html`<jg-textarea rows="3" data-arg="${field.name}" data-type="string" value="${initial ?? ''}"></jg-textarea>`;
      } else {
        control = html`<jg-input mono data-arg="${field.name}" data-type="string" value="${initial ?? ''}"></jg-input>`;
      }
      return html`<jg-field label="${label}" hint="${hint}">${control}</jg-field>`;
    })}</div>`;
  }

  #readArguments(schema) {
    if (this.#asJson) {
      const text = this.$('#json-args')?.value.trim();
      if (!text) return {};
      return JSON.parse(text);
    }
    const values = {};
    for (const node of this.$$('[data-arg]')) {
      const name = node.dataset.arg;
      const type = node.dataset.type;
      if (type === 'boolean') {
        values[name] = Boolean(node.checked);
        continue;
      }
      const text = String(node.value ?? '');
      if (text === '') continue;
      if (type === 'number' || type === 'integer') values[name] = Number(text);
      else if (type === 'object' || type === 'array') {
        try {
          values[name] = JSON.parse(text);
        } catch {
          throw new Error(t('mcp-tester.isNotValidJson', '{name} is not valid JSON', { name }));
        }
      } else values[name] = text;
    }
    return values;
  }

  // ---- calls -----------------------------------------------------------

  async #timed(tab, work) {
    const button = this.$('#run');
    button?.setAttribute('disabled', '');
    const started = performance.now();
    try {
      this.#results[tab] = { value: await work() };
    } catch (error) {
      this.#results[tab] = { error: error.message, code: error.code };
    }
    this.#results[tab].ms = Math.round(performance.now() - started);
    if (this.#tab !== tab) return;
    button?.removeAttribute('disabled');
    this.#paintResult();
  }

  async #runTool(tool) {
    let args;
    try {
      args = this.#readArguments(tool.inputSchema ?? {});
    } catch (error) {
      toast(error.message, 'error');
      return;
    }
    const problems = problemsWith(tool.inputSchema ?? {}, args);
    if (problems.length) {
      toast(problems[0], 'error');
      return;
    }
    await this.#timed('tools', () => this.#client.request('tools/call', { name: tool.name, arguments: args }));
  }

  async #getPrompt(prompt, schema) {
    const args = this.#readArguments(schema);
    const problems = problemsWith(schema, args);
    if (problems.length) {
      toast(problems[0], 'error');
      return;
    }
    await this.#timed('prompts', () => this.#client.request('prompts/get', { name: prompt.name, arguments: args }));
  }

  async #readResource(uri) {
    await this.#timed('resources', () => this.#client.request('resources/read', { uri }));
  }

  // ---- results ---------------------------------------------------------

  #paintResult() {
    const holder = this.$('#result');
    const result = this.#results[this.#tab];
    const timing = this.$('#timing');
    if (timing) timing.textContent = result ? t('mcp-tester.tookMs', '{ms} ms', { ms: result.ms }) : '';
    if (!holder) return;
    if (!result) return (holder.innerHTML = '');
    if (result.error) {
      holder.innerHTML = html`<div class="outcome failed"><div class="outcome-head"><jg-badge tone="danger">${t('mcp-tester.error', 'Error')}${result.code !== undefined ? ` ${result.code}` : ''}</jg-badge></div><div class="block text">${result.error}</div></div>`;
      return;
    }
    const value = result.value;
    let blocks = '';
    let failed = false;
    if (this.#tab === 'tools') {
      failed = Boolean(value.isError);
      blocks = [
        ...(value.content ?? []).map((block) => this.#block(block)),
        value.structuredContent ? html`<div class="block"><span class="label">${t('mcp-tester.structuredContent', 'Structured content')}</span><pre class="json">${raw(highlight(pretty(value.structuredContent), 'json'))}</pre></div>` : '',
      ].join('');
    } else if (this.#tab === 'prompts') {
      blocks = [
        value.description ? html`<p class="description">${value.description}</p>` : '',
        ...(value.messages ?? []).map((message) => html`<div class="message" data-role="${message.role}"><span class="role">${message.role}</span>${raw(this.#block(message.content))}</div>`),
      ].join('');
    } else {
      blocks = (value.contents ?? []).map((content) => this.#block({ type: content.blob !== undefined ? 'blob' : 'text', ...content })).join('');
    }
    holder.innerHTML = html`<div class="outcome ${failed ? 'failed' : ''}">
      <div class="outcome-head">
        <jg-badge tone="${failed ? 'danger' : 'success'}">${failed ? t('mcp-tester.toolError', 'Tool error') : t('mcp-tester.result', 'Result')}</jg-badge>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="copy-raw">${t('mcp-tester.copyJson', 'Copy JSON')}</jg-button>
        <jg-button size="sm" variant="ghost" id="show-raw">${t('mcp-tester.rawJson', 'Raw JSON')}</jg-button>
      </div>
      ${raw(blocks || html`<span class="hint">${t('mcp-tester.emptyResult', 'Empty result')}</span>`)}
      <pre class="json" id="raw" hidden>${raw(highlight(pretty(value), 'json'))}</pre>
    </div>`;
    this.on(holder.querySelector('#copy-raw'), 'click', () => copyText(pretty(value)));
    this.on(holder.querySelector('#show-raw'), 'click', () => {
      const node = holder.querySelector('#raw');
      node.hidden = !node.hidden;
    });
  }

  #block(block = {}) {
    if (block.type === 'text') {
      const text = String(block.text ?? '');
      const trimmed = text.trim();
      if (/^[[{]/.test(trimmed)) {
        try {
          return html`<pre class="json block">${raw(highlight(pretty(JSON.parse(trimmed)), 'json'))}</pre>`;
        } catch {}
      }
      return html`<div class="block text">${text}</div>`;
    }
    if (block.type === 'image' || (block.type === 'blob' && /^image\//.test(block.mimeType ?? ''))) {
      return html`<div class="block"><img class="picture" alt="" src="data:${block.mimeType};base64,${block.data ?? block.blob}" /></div>`;
    }
    if (block.type === 'audio') {
      return html`<div class="block"><audio controls src="data:${block.mimeType};base64,${block.data}"></audio></div>`;
    }
    if (block.type === 'resource') return this.#block({ type: block.resource?.blob !== undefined ? 'blob' : 'text', ...block.resource });
    if (block.type === 'resource_link') {
      return html`<div class="block link"><span class="label">${t('mcp-tester.resourceLink', 'Resource link')}</span><code>${block.uri}</code>${block.mimeType ? html`<jg-badge>${block.mimeType}</jg-badge>` : ''}</div>`;
    }
    if (block.type === 'blob') {
      const bytes = Math.floor(((block.blob ?? '').length * 3) / 4);
      return html`<div class="block link"><span class="label">${block.mimeType ?? 'binary'}</span><span class="muted">${t('mcp-tester.bytes', '{count} bytes', { count: bytes })}</span></div>`;
    }
    return html`<pre class="json block">${raw(highlight(pretty(block), 'json'))}</pre>`;
  }

  // ---- messages pane ---------------------------------------------------

  #paintMessagesPane() {
    const body = this.$('#body');
    body.innerHTML = html`<div class="messages-pane">
      <div class="row">
        <span class="hint">${t('mcp-tester.everyMessageBothWays', 'Every JSON-RPC message, both ways')}</span>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="clear">${t('mcp-tester.clear', 'Clear')}</jg-button>
        <jg-button size="sm" variant="ghost" id="export">${t('mcp-tester.export', 'Export')}</jg-button>
      </div>
      <div class="log" id="log"></div>
      <div class="composer">
        <jg-input id="method" mono placeholder="tools/list" style="width:220px"></jg-input>
        <jg-code id="params" language="json" rows="3" placeholder='{ "cursor": null }'></jg-code>
        <div class="row">
          <jg-button size="sm" id="send-request" ${this.#state === 'open' ? '' : 'disabled'}>${t('mcp-tester.sendRequest', 'Send request')}</jg-button>
          <jg-button size="sm" variant="outline" id="send-notification" ${this.#state === 'open' ? '' : 'disabled'}>${t('mcp-tester.sendNotification', 'Send notification')}</jg-button>
        </div>
      </div>
    </div>`;
    this.on(body.querySelector('#clear'), 'click', () => {
      this.#messages = [];
      this.#paintTabs();
      this.#paintMessages();
    });
    this.on(body.querySelector('#export'), 'click', () => download('mcp-messages.json', pretty(this.#messages), 'application/json'));
    const send = async (kind) => {
      const method = this.$('#method').value.trim();
      if (!method || !this.#client) return;
      let params;
      const text = this.$('#params').value.trim();
      try {
        params = text ? JSON.parse(text) : undefined;
      } catch {
        toast(t('mcp-tester.paramsAreNotValidJson', 'The params are not valid JSON'), 'error');
        return;
      }
      try {
        if (kind === 'request') await this.#client.request(method, params);
        else await this.#client.notify(method, params);
      } catch (error) {
        this.#log('error', { message: error.message, ...(error.code !== undefined ? { code: error.code } : {}) });
      }
    };
    this.on(body.querySelector('#send-request'), 'click', () => send('request'));
    this.on(body.querySelector('#send-notification'), 'click', () => send('notification'));
    this.#paintMessages();
  }

  #paintMessages() {
    const log = this.$('#log');
    if (!log) return;
    const asked = new Map(this.#messages.filter((entry) => entry.message.method && entry.message.id !== undefined).map((entry) => [`${entry.direction}:${entry.message.id}`, entry.message.method]));
    const summary = (entry) => {
      const { message } = entry;
      if (message.method) return message.method;
      const answers = asked.get(`${entry.direction === 'in' ? 'out' : 'in'}:${message.id}`);
      if (message.error) return `${answers ? `${answers} · ` : ''}${t('mcp-tester.error', 'Error')} ${message.error.code ?? ''}`;
      if (message.result) return answers ? `${answers} · ${t('mcp-tester.reply', 'reply')}` : t('mcp-tester.reply', 'reply');
      return message.message ?? '';
    };
    log.innerHTML = this.#messages.length
      ? this.#messages.map((entry) => html`<details class="line" data-direction="${entry.direction}">
          <summary>
            <span class="arrow">${entry.direction === 'out' ? '→' : entry.direction === 'in' ? '←' : '!'}</span>
            <span class="what" data-reply="${String(entry.message.method === undefined)}">${summary(entry)}</span>
            <span class="id">${entry.message.id !== undefined ? `#${entry.message.id}` : ''}</span>
            <span class="time">${entry.at}</span>
          </summary>
          <pre class="json">${raw(highlight(pretty(entry.message), 'json'))}</pre>
        </details>`).join('')
      : html`<span class="hint pad">${t('mcp-tester.messagesAppearHere', 'Messages appear here once you connect.')}</span>`;
    log.scrollTop = log.scrollHeight;
  }

  // ---- server ----------------------------------------------------------

  #paintServer() {
    const body = this.$('#body');
    const info = this.#client?.info;
    if (!info) {
      body.innerHTML = html`<jg-empty glyph="ⓘ" title="${t('mcp-tester.notConnected', 'Not connected')}">${t('mcp-tester.serverDetailsShowHere', 'What the server says about itself shows here once you connect.')}</jg-empty>`;
      return;
    }
    const capabilities = Object.keys(info.capabilities ?? {});
    body.innerHTML = html`<div class="stack">
      <div class="panel flush">
        <div class="kv">
          <div>${t('mcp-tester.name', 'Name')}</div><div>${info.serverInfo?.title ?? info.serverInfo?.name ?? '—'}</div>
          <div>${t('mcp-tester.version', 'Version')}</div><div>${info.serverInfo?.version ?? '—'}</div>
          <div>${t('mcp-tester.protocol', 'Protocol')}</div><div class="mono">${info.protocolVersion}</div>
          <div>${t('mcp-tester.transport', 'Transport')}</div><div class="mono">${this.#client.transport}</div>
          <div>${t('mcp-tester.session', 'Session')}</div><div class="mono">${this.#client.session ?? '—'}</div>
          <div>${t('mcp-tester.capabilities', 'Capabilities')}</div><div class="row tight">${capabilities.length ? capabilities.map((name) => html`<jg-badge tone="accent">${name}</jg-badge>`) : '—'}</div>
        </div>
      </div>
      ${info.instructions ? html`<jg-card title="${t('mcp-tester.instructions', 'Instructions')}"><div class="block text">${info.instructions}</div></jg-card>` : ''}
      <jg-card title="${t('mcp-tester.initializeResult', 'Initialize result')}"><pre class="json">${raw(highlight(pretty(info), 'json'))}</pre></jg-card>
    </div>`;
  }
}

define('jg-app-mcp-tester', McpTester);
