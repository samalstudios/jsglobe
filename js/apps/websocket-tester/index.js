import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { download, toast } from '../../core/util.js';

const t = await appWords('websocket-tester', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const ECHO = 'wss://echo.websocket.org';
const uid = () => Math.random().toString(36).slice(2, 8);
const stamp = () => new Date().toTimeString().slice(0, 8);

class WebsocketTester extends JGApp {
  static appId = 'websocket-tester';
  static styles = [...JGApp.styles, sheet];

  #socket = null;
  #frames = [];
  #snippets = [];

  renderApp() {
    const saved = this.store.read({ url: ECHO, snippets: null, message: '' });
    this.#snippets = saved.snippets ?? [
      { id: uid(), text: '{"type":"ping"}' },
      { id: uid(), text: 'hello from Toolbox' },
    ];

    this.paint(html`<div class="app">
      <div class="row">
        <jg-input id="url" mono style="flex:1;min-width:220px" value="${saved.url}" placeholder="${t('websocket-tester.wssExampleComSocket', 'wss://example.com/socket')}"></jg-input>
        <jg-input id="protocol" size="sm" mono style="width:150px" placeholder="${t('websocket-tester.subprotocol', 'Subprotocol')}"></jg-input>
        <jg-button id="toggle">${t('websocket-tester.connect', 'Connect')}</jg-button>
      </div>

      <div class="row">
        <jg-badge id="status" tone="muted">${t('websocket-tester.closed', 'Closed')}</jg-badge>
        <span class="hint" id="detail"></span>
        <span class="grow"></span>
        <span class="hint" id="counts"></span>
      </div>

      <div class="shell">
        <div class="stack tight" style="min-height:0">
          <div class="log" id="log"></div>
          <jg-field label="${t('websocket-tester.message', 'Message')}">
            <jg-code id="message" rows="4" language="json" placeholder='{"type":"hello"}'></jg-code>
          </jg-field>
          <div class="row">
            <jg-button size="sm" id="send" disabled>${t('websocket-tester.send', 'Send')}</jg-button>
            <jg-button size="sm" variant="outline" id="save-snippet">${t('websocket-tester.saveMessage', 'Save message')}</jg-button>
            <span class="grow"></span>
            <jg-button size="sm" variant="ghost" id="clear">${t('websocket-tester.clearLog', 'Clear log')}</jg-button>
            <jg-button size="sm" variant="ghost" id="export">${t('websocket-tester.exportLog', 'Export log')}</jg-button>
          </div>
        </div>

        <div class="side">
          <jg-card title="${t('websocket-tester.savedMessages', 'Saved messages')}" sub="${t('websocket-tester.clickToLoadOne', 'Click to load one')}">
            <div class="saved" id="snippets"></div>
          </jg-card>
          <jg-card title="${t('websocket-tester.notes', 'Notes')}">
            <div class="hint">
              Browsers only allow secure pages to open wss:// sockets, and a server must accept the connection
              for anything to appear here. There is no preflight, so unlike HTTP this is not blocked by CORS.
            </div>
          </jg-card>
        </div>
      </div>
    </div>`);

    this.on(this.$('#toggle'), 'click', () => (this.#socket ? this.#disconnect() : this.#connect()));
    this.on(this.$('#send'), 'click', () => this.#send());
    this.on(this.$('#clear'), 'click', () => {
      this.#frames = [];
      this.#paintLog();
    });
    this.on(this.$('#export'), 'click', () =>
      download('websocket-log.json', JSON.stringify(this.#frames, null, 2), 'application/json'),
    );
    this.on(this.$('#save-snippet'), 'click', () => {
      const text = this.$('#message').value.trim();
      if (!text) return;
      this.#snippets = [{ id: uid(), text }, ...this.#snippets].slice(0, 12);
      this.#paintSnippets();
      this.#persist();
    });

    this.$('#message').value = saved.message ?? '';
    this.#paintSnippets();
    this.#paintLog();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#socket?.close();
    this.#socket = null;
  }

  #persist() {
    this.store.write({
      url: this.$('#url').value,
      message: this.$('#message').value,
      snippets: this.#snippets,
    });
  }

  #paintSnippets() {
    this.$('#snippets').innerHTML = this.#snippets.length
      ? this.#snippets
          .map(
            (snippet) => html`<div class="snippet">
              <button data-load="${snippet.id}" title="${snippet.text}">${snippet.text}</button>
              <jg-button size="icon-sm" variant="ghost" data-drop="${snippet.id}">✕</jg-button>
            </div>`,
          )
          .join('')
      : html`<span class="hint">${t('websocket-tester.savedMessagesAppearHere', 'Saved messages appear here.')}</span>`;

    this.bind('[data-load]', 'click', (event) => {
      const snippet = this.#snippets.find((item) => item.id === event.currentTarget.dataset.load);
      if (snippet) this.$('#message').value = snippet.text;
    });
    this.bind('[data-drop]', 'click', (event) => {
      this.#snippets = this.#snippets.filter((item) => item.id !== event.currentTarget.dataset.drop);
      this.#paintSnippets();
      this.#persist();
    });
  }

  #add(kind, body) {
    this.#frames.push({ kind, body, at: stamp() });
    if (this.#frames.length > 400) this.#frames = this.#frames.slice(-400);
    this.#paintLog();
  }

  #paintLog() {
    const log = this.$('#log');
    const labels = { in: 'received', out: 'sent', system: 'system', error: 'error' };

    log.innerHTML = this.#frames.length
      ? this.#frames
          .map(
            (frame) => html`<div class="frame" data-kind="${frame.kind}">
              <span class="time">${frame.at}<br />${labels[frame.kind]}</span>
              <span class="body">${frame.body}</span>
            </div>`,
          )
          .join('')
      : html`<span class="hint">${t('websocket-tester.framesAppearHereOnceYou', 'Frames appear here once you connect.')}</span>`;

    log.scrollTop = log.scrollHeight;

    const received = this.#frames.filter((frame) => frame.kind === 'in').length;
    const sent = this.#frames.filter((frame) => frame.kind === 'out').length;
    this.$('#counts').textContent = `${sent} sent - ${received} received`;
  }

  #state(tone, text, detail = '') {
    const status = this.$('#status');
    status.setAttribute('tone', tone);
    status.textContent = text;
    this.$('#detail').textContent = detail;
  }

  #connect() {
    const url = this.$('#url').value.trim();
    if (!/^wss?:\/\//i.test(url)) {
      toast(t('websocket-tester.theAddressMustStartWith', 'The address must start with ws:// or wss://'), 'error');
      return;
    }

    const protocol = this.$('#protocol').value.trim();
    this.#state('warning', 'Connecting', url);
    this.#add('system', `Opening ${url}${protocol ? ` with protocol ${protocol}` : ''}`);

    try {
      this.#socket = protocol ? new WebSocket(url, protocol) : new WebSocket(url);
    } catch (error) {
      this.#state('danger', 'Failed', error.message);
      this.#add('error', error.message);
      this.#socket = null;
      return;
    }

    const opened = performance.now();

    this.#socket.addEventListener('open', () => {
      this.#state('success', 'Open', `${Math.round(performance.now() - opened)} ms handshake`);
      this.$('#toggle').textContent = 'Disconnect';
      this.$('#send').removeAttribute('disabled');
      this.#add('system', `Connected${this.#socket.protocol ? ` using ${this.#socket.protocol}` : ''}`);
      this.#persist();
    });

    this.#socket.addEventListener('message', async (event) => {
      const data = event.data instanceof Blob ? `[binary ${(await event.data.arrayBuffer()).byteLength} bytes]` : String(event.data);
      this.#add('in', data);
    });

    this.#socket.addEventListener('error', () => {
      this.#add('error', 'The socket reported an error. The server may have refused the connection.');
    });

    this.#socket.addEventListener('close', (event) => {
      this.#state('muted', 'Closed', event.code ? `code ${event.code}${event.reason ? `: ${event.reason}` : ''}` : '');
      this.$('#toggle').textContent = 'Connect';
      this.$('#send').setAttribute('disabled', '');
      this.#add('system', `Closed with code ${event.code}${event.reason ? ` (${event.reason})` : ''}`);
      this.#socket = null;
    });
  }

  #disconnect() {
    this.#socket?.close(1000, 'Closed from Toolbox');
    this.#socket = null;
    this.$('#toggle').textContent = 'Connect';
    this.$('#send').setAttribute('disabled', '');
  }

  #send() {
    const text = this.$('#message').value;
    if (!this.#socket || this.#socket.readyState !== WebSocket.OPEN) {
      toast(t('websocket-tester.connectFirst', 'Connect first'), 'error');
      return;
    }
    this.#socket.send(text);
    this.#add('out', text);
    this.#persist();
  }
}

define('jg-app-websocket-tester', WebsocketTester);
