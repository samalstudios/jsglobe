import { JGApp, define, html, css } from '../core/app.js';
import { copyText, download } from '../core/util.js';

const sheet = css`
  .app { padding: 0; gap: 0; container-type: inline-size; overflow: hidden; }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex: none;
    flex-wrap: wrap;
  }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 14px; gap: 12px; }
  .log {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--muted) 75%, transparent);
    font: 12.5px/1.5 var(--font-mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .log .rx { color: var(--foreground); }
  .log .tx { color: var(--ring); }
  .log .sys { color: var(--muted-foreground); font-style: italic; }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--muted-foreground); flex: none; }
  .dot[data-open="true"] { background: var(--success, #4a7a58); }
  .unsupported { display: grid; place-items: center; gap: 10px; padding: 48px 20px; text-align: center; }
`;

const BAUD = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

class SerialConsole extends JGApp {
  static appId = 'serial-console';
  static settings = [
    { key: 'baud', label: 'Default baud rate', type: 'select', default: '115200', options: BAUD.map((rate) => ({ value: String(rate), label: String(rate) })) },
    { key: 'newline', label: 'Line ending', type: 'select', default: 'lf', options: [
      { value: 'lf', label: 'LF' },
      { value: 'crlf', label: 'CRLF' },
      { value: 'cr', label: 'CR' },
      { value: 'none', label: 'None' },
    ] },
    { key: 'echo', label: 'Echo what you send', type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #port = null;
  #reader = null;
  #writer = null;
  #closing = false;

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">Serial</div>
        <div class="hint">${navigator.serial ? 'Talk to a serial device over USB' : 'Needs Chrome or Edge'}</div>
      </div>
    </div>`);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#disconnect();
  }

  renderApp() {
    if (!navigator.serial) {
      this.paint(html`<div class="app"><div class="unsupported">
        <div class="title">Web Serial is not available here</div>
        <p class="hint" style="max-width:46ch">
          Chrome, Edge and Opera on desktop expose <code>navigator.serial</code>. Safari and Firefox have not shipped it,
          and it needs a secure origin.
        </p>
      </div></div>`);
      return;
    }

    this.paint(html`<div class="app">
      <div class="head">
        <span class="dot" id="dot"></span>
        <span class="title" id="state">Not connected</span>
        <span class="grow"></span>
        <jg-select id="baud" size="sm" value="${this.config.get('baud', '115200')}" style="width:120px">
          ${BAUD.map((rate) => html`<option value="${rate}">${rate} baud</option>`)}
        </jg-select>
        <jg-select id="databits" size="sm" value="8" style="width:96px">
          <option value="8">8 data</option><option value="7">7 data</option>
        </jg-select>
        <jg-select id="parity" size="sm" value="none" style="width:110px">
          <option value="none">No parity</option><option value="even">Even</option><option value="odd">Odd</option>
        </jg-select>
        <jg-select id="stopbits" size="sm" value="1" style="width:100px">
          <option value="1">1 stop</option><option value="2">2 stop</option>
        </jg-select>
        <jg-button size="sm" id="connect">Connect</jg-button>
      </div>

      <div class="body">
        <div class="log" id="log"><span class="sys">Pick a port to begin. The browser asks you to choose the device.</span></div>
        <div class="row">
          <jg-input id="line" class="grow" placeholder="Type a command and press enter" disabled></jg-input>
          <jg-select id="newline" size="sm" value="${this.config.get('newline', 'lf')}" style="width:110px">
            <option value="lf">LF</option><option value="crlf">CRLF</option><option value="cr">CR</option><option value="none">None</option>
          </jg-select>
          <jg-button size="sm" variant="outline" id="send" disabled>Send</jg-button>
        </div>
        <div class="row">
          <jg-switch id="hex"></jg-switch><span class="hint">Show bytes as hex</span>
          <span class="grow"></span>
          <span class="hint mono tiny" id="stats">0 in · 0 out</span>
          <jg-button size="sm" variant="ghost" id="copy">Copy log</jg-button>
          <jg-button size="sm" variant="ghost" id="save">Save log</jg-button>
          <jg-button size="sm" variant="ghost" id="clear">Clear</jg-button>
        </div>
      </div>
    </div>`);

    this.on(this.$('#connect'), 'click', () => (this.#port ? this.#disconnect() : this.#connect()));
    this.on(this.$('#send'), 'click', () => this.#send());
    this.on(this.$('#line'), 'keydown', (event) => {
      if (event.key === 'Enter') this.#send();
    });
    this.on(this.$('#clear'), 'click', () => {
      this.$('#log').innerHTML = '';
      this.#count(0, 0);
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#log').textContent));
    this.on(this.$('#save'), 'click', () => download('serial-log.txt', this.$('#log').textContent));
    this.on(this.$('#baud'), 'change', (event) => this.config.set('baud', event.detail.value));
    this.on(this.$('#newline'), 'change', (event) => this.config.set('newline', event.detail.value));

    this.listen(navigator.serial, 'disconnect', () => {
      if (this.#port) this.#write('sys', 'The device was unplugged.');
      this.#disconnect();
    });
  }

  #received = 0;
  #sent = 0;

  #count(received, sent) {
    this.#received = received ?? this.#received;
    this.#sent = sent ?? this.#sent;
    const stats = this.$('#stats');
    if (stats) stats.textContent = `${this.#received} in · ${this.#sent} out`;
  }

  #write(kind, text) {
    const log = this.$('#log');
    if (!log) return;
    const stuck = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
    const span = document.createElement('span');
    span.className = kind;
    span.textContent = kind === 'sys' ? `${text}\n` : text;
    log.append(span);
    if (stuck) log.scrollTop = log.scrollHeight;
  }

  async #connect() {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({
        baudRate: Number(this.$('#baud').value),
        dataBits: Number(this.$('#databits').value),
        stopBits: Number(this.$('#stopbits').value),
        parity: this.$('#parity').value,
      });
      this.#port = port;
      this.#closing = false;

      const info = port.getInfo?.() ?? {};
      const label = info.usbVendorId
        ? `USB ${info.usbVendorId.toString(16).padStart(4, '0')}:${(info.usbProductId ?? 0).toString(16).padStart(4, '0')}`
        : 'Serial port';
      this.$('#state').textContent = `${label} at ${this.$('#baud').value} baud`;
      this.$('#dot').dataset.open = 'true';
      this.$('#connect').textContent = 'Disconnect';
      this.$('#line').disabled = false;
      this.$('#send').disabled = false;
      this.#write('sys', `Opened ${label}.`);

      this.#writer = port.writable.getWriter();
      this.#read();
    } catch (failure) {
      if (failure.name !== 'NotFoundError') this.#write('sys', `Could not open the port: ${failure.message}`);
    }
  }

  async #read() {
    const decoder = new TextDecoder();
    while (this.#port?.readable && !this.#closing) {
      this.#reader = this.#port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.#reader.read();
          if (done) break;
          if (!value?.length) continue;
          this.#count(this.#received + value.length, null);
          this.#write(
            'rx',
            this.$('#hex').checked
              ? `${[...value].map((byte) => byte.toString(16).padStart(2, '0')).join(' ')} `
              : decoder.decode(value, { stream: true }),
          );
        }
      } catch (failure) {
        if (!this.#closing) this.#write('sys', `Read stopped: ${failure.message}`);
      } finally {
        this.#reader.releaseLock();
        this.#reader = null;
      }
    }
  }

  async #send() {
    if (!this.#writer) return;
    const input = this.$('#line');
    const endings = { lf: '\n', crlf: '\r\n', cr: '\r', none: '' };
    const payload = `${input.value}${endings[this.$('#newline').value] ?? '\n'}`;
    await this.#writer.write(new TextEncoder().encode(payload));
    this.#count(null, this.#sent + payload.length);
    if (this.config.get('echo', true)) this.#write('tx', payload);
    input.value = '';
  }

  async #disconnect() {
    this.#closing = true;
    try {
      await this.#reader?.cancel();
    } catch {
      /* the reader may already be gone */
    }
    try {
      this.#writer?.releaseLock();
      await this.#port?.close();
    } catch {
      /* the port may already be closed */
    }
    this.#port = null;
    this.#writer = null;
    const connect = this.$('#connect');
    if (!connect) return;
    connect.textContent = 'Connect';
    this.$('#state').textContent = 'Not connected';
    this.$('#dot').dataset.open = 'false';
    this.$('#line').disabled = true;
    this.$('#send').disabled = true;
  }
}

define('jg-app-serial-console', SerialConsole);
