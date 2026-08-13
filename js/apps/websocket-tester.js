import { JGApp, define, html, css } from '../core/app.js';
import { download, toast } from '../core/util.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 1fr 300px; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 880px) { .shell { grid-template-columns: 1fr; } }
  .log {
    flex: 1;
    min-height: 200px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 40%, transparent);
    scrollbar-width: thin;
  }
  .frame {
    display: grid;
    grid-template-columns: 62px 1fr;
    gap: 8px;
    padding: 5px 7px;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 11.5px;
    line-height: 1.5;
  }
  .frame .time { color: var(--muted-foreground); font-size: 10.5px; }
  .frame .body { white-space: pre-wrap; overflow-wrap: anywhere; }
  .frame[data-kind="in"] { background: color-mix(in srgb, var(--success) 12%, transparent); }
  .frame[data-kind="out"] { background: color-mix(in srgb, var(--ring) 14%, transparent); }
  .frame[data-kind="system"] { color: var(--muted-foreground); }
  .frame[data-kind="error"] { background: color-mix(in srgb, var(--destructive) 14%, transparent); color: var(--destructive); }
  .side { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
  .saved { display: grid; gap: 5px; overflow: auto; scrollbar-width: thin; }
  .snippet { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; }
  .snippet button {
    text-align: left;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground);
    font-family: var(--font-mono);
    font-size: 11.5px;
    padding: 6px 8px;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .snippet button:hover { background: var(--accent); }
`;

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
        <jg-input id="url" mono style="flex:1;min-width:220px" value="${saved.url}" placeholder="wss://example.com/socket"></jg-input>
        <jg-input id="protocol" size="sm" mono style="width:150px" placeholder="Subprotocol"></jg-input>
        <jg-button id="toggle">Connect</jg-button>
      </div>

      <div class="row">
        <jg-badge id="status" tone="muted">Closed</jg-badge>
        <span class="hint" id="detail"></span>
        <span class="grow"></span>
        <span class="hint" id="counts"></span>
      </div>

      <div class="shell">
        <div class="stack tight" style="min-height:0">
          <div class="log" id="log"></div>
          <jg-field label="Message">
            <jg-code id="message" rows="4" language="json" placeholder='{"type":"hello"}'></jg-code>
          </jg-field>
          <div class="row">
            <jg-button size="sm" id="send" disabled>Send</jg-button>
            <jg-button size="sm" variant="outline" id="save-snippet">Save message</jg-button>
            <span class="grow"></span>
            <jg-button size="sm" variant="ghost" id="clear">Clear log</jg-button>
            <jg-button size="sm" variant="ghost" id="export">Export log</jg-button>
          </div>
        </div>

        <div class="side">
          <jg-card title="Saved messages" sub="Click to load one">
            <div class="saved" id="snippets"></div>
          </jg-card>
          <jg-card title="Notes">
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
      : html`<span class="hint">Saved messages appear here.</span>`;

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
      : html`<span class="hint">Frames appear here once you connect.</span>`;

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
      toast('The address must start with ws:// or wss://', 'error');
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
      toast('Connect first', 'error');
      return;
    }
    this.#socket.send(text);
    this.#add('out', text);
    this.#persist();
  }
}

define('jg-app-websocket-tester', WebsocketTester);
