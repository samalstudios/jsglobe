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
  .body { flex: 1; min-height: 0; display: flex; }
  .tree { flex: 1; min-width: 0; overflow: auto; padding: 14px; display: grid; gap: 10px; align-content: start; }
  .log-pane {
    width: 300px;
    flex: none;
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .log {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 10px 12px;
    font: 11.5px/1.55 var(--font-mono);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .log .stamp { color: var(--muted-foreground); }
  .log .notify { color: var(--ring); }
  .log .sys { color: var(--muted-foreground); font-style: italic; }

  .unsupported { display: grid; place-items: center; gap: 10px; padding: 48px 20px; text-align: center; }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--muted-foreground); flex: none; }
  .dot[data-on="true"] { background: var(--success, #4a7a58); }

  .service { border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--card); overflow: hidden; }
  .service > header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--muted) 60%, transparent);
  }
  .service .label { font-size: 12.5px; font-weight: 600; }
  .service .uuid { font: 500 11px/1 var(--font-mono); color: var(--muted-foreground); }

  .char { display: grid; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
  .char:last-child { border-bottom: 0; }
  .char .top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .char .value {
    font: 12px/1.4 var(--font-mono);
    color: var(--foreground);
    background: color-mix(in srgb, var(--muted) 70%, transparent);
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    overflow-wrap: anywhere;
  }
  .char .reading { font-weight: 600; color: var(--ring); }
  .flags { display: flex; gap: 4px; flex-wrap: wrap; }
  .flag {
    font: 500 10px/1 var(--font-mono);
    padding: 3px 6px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--muted-foreground);
  }
  .actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

  @container (max-width: 760px) {
    .body { flex-direction: column; }
    .log-pane { width: auto; border-left: 0; border-top: 1px solid var(--border); max-height: 220px; }
  }
`;

const SERVICES = {
  '00001800': 'Generic access',
  '00001801': 'Generic attribute',
  '0000180a': 'Device information',
  '0000180d': 'Heart rate',
  '0000180f': 'Battery',
  '00001810': 'Blood pressure',
  '00001812': 'Human interface device',
  '00001816': 'Cycling speed and cadence',
  '0000181a': 'Environmental sensing',
  '0000181c': 'User data',
  '00001826': 'Fitness machine',
  '0000fe59': 'Nordic DFU',
  '6e400001': 'Nordic UART',
};

const CHARACTERISTICS = {
  '00002a00': 'Device name',
  '00002a01': 'Appearance',
  '00002a19': 'Battery level',
  '00002a1c': 'Temperature measurement',
  '00002a24': 'Model number',
  '00002a25': 'Serial number',
  '00002a26': 'Firmware revision',
  '00002a27': 'Hardware revision',
  '00002a28': 'Software revision',
  '00002a29': 'Manufacturer name',
  '00002a37': 'Heart rate measurement',
  '00002a38': 'Body sensor location',
  '00002a6e': 'Temperature',
  '00002a6f': 'Humidity',
  '00002a6d': 'Pressure',
};

const FLAGS = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate', 'broadcast', 'authenticatedSignedWrites'];

const short = (uuid) => uuid.slice(0, 8);
const nameOf = (map, uuid) => map[short(uuid)] ?? null;

const decode = (uuid, view) => {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const key = short(uuid);
  const text = new TextDecoder().decode(bytes).replace(/\0+$/, '');

  if (key === '00002a19') return `${view.getUint8(0)}%`;
  if (key === '00002a6e') return `${(view.getInt16(0, true) / 100).toFixed(2)} °C`;
  if (key === '00002a6f') return `${(view.getUint16(0, true) / 100).toFixed(2)} % RH`;
  if (key === '00002a6d') return `${(view.getUint32(0, true) / 10).toFixed(1)} Pa`;
  if (key === '00002a37' && view.byteLength > 1) {
    const wide = view.getUint8(0) & 1;
    const rate = wide ? view.getUint16(1, true) : view.getUint8(1);
    return `${rate} bpm`;
  }
  if (key === '00002a01' && view.byteLength >= 2) return `appearance ${view.getUint16(0, true)}`;
  if (/^00002a(00|24|25|26|27|28|29)$/.test(key) && /^[\x20-\x7e]+$/.test(text)) return text;
  if (bytes.length && /^[\x20-\x7e\s]+$/.test(text) && text.trim()) return text;
  return null;
};

const hex = (view) =>
  [...new Uint8Array(view.buffer, view.byteOffset, view.byteLength)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ');

class BluetoothScanner extends JGApp {
  static appId = 'bluetooth-scanner';
  static settings = [
    { key: 'autoNotify', label: 'Subscribe automatically', type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #device = null;
  #server = null;
  #subscriptions = new Map();
  #lines = [];

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">Bluetooth</div>
        <div class="hint">${navigator.bluetooth ? 'Explore GATT services, subscribe and write' : 'Needs Chrome or Edge'}</div>
      </div>
    </div>`);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#unsubscribeAll();
    try {
      this.#server?.disconnect();
    } catch {
      /* already gone */
    }
  }

  renderApp() {
    if (!navigator.bluetooth) {
      this.paint(html`<div class="app"><div class="unsupported">
        <div class="title">Web Bluetooth is not available here</div>
        <p class="hint" style="max-width:48ch">
          Chrome, Edge and Opera on desktop and Android expose <code>navigator.bluetooth</code>. Safari and Firefox have
          not shipped it, and iOS blocks it entirely. A secure origin is required.
        </p>
      </div></div>`);
      return;
    }

    this.paint(html`<div class="app">
      <div class="head">
        <span class="dot" id="dot"></span>
        <span class="title" id="state">Nothing paired</span>
        <span class="hint mono tiny" id="rssi"></span>
        <span class="grow"></span>
        <jg-switch id="all"></jg-switch><span class="hint">Any device</span>
        <jg-button size="sm" id="pick">Choose a device</jg-button>
        <jg-button size="sm" variant="outline" id="drop" disabled>Disconnect</jg-button>
      </div>
      <div class="body">
        <div class="tree" id="tree">
          <p class="hint">
            The browser shows its own picker and hands over only the device you select. Reading, subscribing and writing
            all happen here in the tab.
          </p>
        </div>
        <div class="log-pane">
          <div class="row" style="padding:10px 12px 0">
            <span class="label">Live log</span>
            <span class="grow"></span>
            <jg-button size="sm" variant="ghost" id="copy-log">Copy</jg-button>
            <jg-button size="sm" variant="ghost" id="save-log">Save</jg-button>
            <jg-button size="sm" variant="ghost" id="clear-log">Clear</jg-button>
          </div>
          <div class="log" id="log"><span class="sys">Waiting for a device.</span></div>
        </div>
      </div>
      <span class="error" id="error" style="padding:0 14px 10px"></span>
    </div>`);

    this.on(this.$('#pick'), 'click', () => this.#pick());
    this.on(this.$('#drop'), 'click', () => {
      this.#unsubscribeAll();
      this.#server?.disconnect();
    });
    this.on(this.$('#copy-log'), 'click', () => copyText(this.#lines.join('\n')));
    this.on(this.$('#save-log'), 'click', () => download('bluetooth-log.txt', this.#lines.join('\n')));
    this.on(this.$('#clear-log'), 'click', () => {
      this.#lines = [];
      this.$('#log').innerHTML = '';
    });
  }

  #write(kind, text) {
    const stamp = new Date().toLocaleTimeString([], { hour12: false });
    this.#lines.push(`${stamp}  ${text}`);
    if (this.#lines.length > 800) this.#lines.shift();
    const log = this.$('#log');
    if (!log) return;
    const stuck = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
    const line = document.createElement('div');
    line.className = kind;
    line.innerHTML = html`<span class="stamp">${stamp}</span> ${text}`;
    log.append(line);
    while (log.childElementCount > 800) log.firstElementChild.remove();
    if (stuck) log.scrollTop = log.scrollHeight;
  }

  async #pick() {
    this.$('#error').textContent = '';
    try {
      const known = [...Object.keys(SERVICES)].map((prefix) => `${prefix}-0000-1000-8000-00805f9b34fb`);
      const device = await navigator.bluetooth.requestDevice(
        this.$('#all').checked
          ? { acceptAllDevices: true, optionalServices: known }
          : {
              filters: [{ services: ['battery_service'] }, { services: ['device_information'] }, { services: ['heart_rate'] }],
              optionalServices: known,
            },
      );

      this.#device = device;
      this.$('#state').textContent = device.name || 'Unnamed device';
      this.#write('sys', `Selected ${device.name || 'unnamed device'} (${device.id.slice(0, 12)}...)`);

      device.addEventListener('gattserverdisconnected', () => {
        this.$('#state').textContent = 'Disconnected';
        this.$('#dot').dataset.on = 'false';
        this.$('#drop').disabled = true;
        this.#subscriptions.clear();
        this.#write('sys', 'Device disconnected.');
      });

      this.#watchSignal(device);
      this.#server = await device.gatt.connect();
      this.$('#dot').dataset.on = 'true';
      this.$('#drop').disabled = false;
      this.#write('sys', 'Connected, reading the GATT table.');
      await this.#walk();
    } catch (failure) {
      if (failure.name !== 'NotFoundError') {
        this.$('#error').textContent = failure.message;
        this.#write('sys', `Error: ${failure.message}`);
      }
    }
  }

  async #watchSignal(device) {
    if (typeof device.watchAdvertisements !== 'function') return;
    try {
      device.addEventListener('advertisementreceived', (event) => {
        const label = this.$('#rssi');
        if (label && typeof event.rssi === 'number') label.textContent = `${event.rssi} dBm`;
      });
      await device.watchAdvertisements();
    } catch {
      /* advertisement watching is behind a flag on some builds */
    }
  }

  async #walk() {
    const tree = this.$('#tree');
    tree.innerHTML = '';
    let services = [];
    try {
      services = await this.#server.getPrimaryServices();
    } catch (failure) {
      this.$('#error').textContent = `Could not list services: ${failure.message}`;
      return;
    }

    for (const service of services) {
      const box = document.createElement('div');
      box.className = 'service';
      box.innerHTML = html`<header>
        <span class="label">${nameOf(SERVICES, service.uuid) ?? 'Service'}</span>
        <span class="uuid">${service.uuid}</span>
      </header>`;
      tree.append(box);

      let characteristics = [];
      try {
        characteristics = await service.getCharacteristics();
      } catch {
        continue;
      }

      for (const characteristic of characteristics) {
        box.append(this.#charRow(characteristic));
      }
    }

    if (!services.length) this.$('#error').textContent = 'The device exposed no readable services.';
  }

  #charRow(characteristic) {
    const row = document.createElement('div');
    row.className = 'char';
    const flags = FLAGS.filter((flag) => characteristic.properties[flag]);
    const label = nameOf(CHARACTERISTICS, characteristic.uuid) ?? 'Characteristic';

    row.innerHTML = html`
      <div class="top">
        <span class="label">${label}</span>
        <span class="uuid">${characteristic.uuid}</span>
        <span class="flags">${flags.map((flag) => html`<span class="flag">${flag}</span>`)}</span>
      </div>
      <div class="value" data-value>-</div>
      <div class="actions">
        ${characteristic.properties.read ? html`<jg-button size="sm" variant="outline" data-read>Read</jg-button>` : ''}
        ${characteristic.properties.notify || characteristic.properties.indicate
          ? html`<jg-button size="sm" variant="outline" data-notify>Subscribe</jg-button>`
          : ''}
        ${characteristic.properties.write || characteristic.properties.writeWithoutResponse
          ? html`<jg-input size="sm" data-payload placeholder="hex or text" style="width:150px"></jg-input>
              <jg-select size="sm" data-format value="hex" style="width:88px">
                <option value="hex">hex</option><option value="text">text</option>
              </jg-select>
              <jg-button size="sm" data-write>Write</jg-button>`
          : ''}
      </div>
    `;

    const show = (view) => {
      const reading = decode(characteristic.uuid, view);
      row.querySelector('[data-value]').innerHTML = html`${reading ? html`<span class="reading">${reading}</span>  ` : ''}${hex(view)}`;
      return reading;
    };

    const read = row.querySelector('[data-read]');
    if (read) {
      this.on(read, 'click', async () => {
        try {
          const view = await characteristic.readValue();
          const reading = show(view);
          this.#write('read', `${label} ${reading ?? hex(view)}`);
        } catch (failure) {
          this.#write('sys', `Read failed on ${label}: ${failure.message}`);
        }
      });
      read.click();
    }

    const notify = row.querySelector('[data-notify]');
    if (notify) {
      this.on(notify, 'click', async () => {
        const live = this.#subscriptions.get(characteristic.uuid);
        try {
          if (live) {
            await characteristic.stopNotifications();
            characteristic.removeEventListener('characteristicvaluechanged', live);
            this.#subscriptions.delete(characteristic.uuid);
            notify.textContent = 'Subscribe';
            this.#write('sys', `Stopped ${label}`);
            return;
          }
          const handler = (event) => {
            const reading = show(event.target.value);
            this.#write('notify', `${label} ${reading ?? hex(event.target.value)}`);
          };
          await characteristic.startNotifications();
          characteristic.addEventListener('characteristicvaluechanged', handler);
          this.#subscriptions.set(characteristic.uuid, handler);
          notify.textContent = 'Unsubscribe';
          this.#write('sys', `Subscribed to ${label}`);
        } catch (failure) {
          this.#write('sys', `Subscribe failed on ${label}: ${failure.message}`);
        }
      });
      if (this.config.get('autoNotify', true) && characteristic.properties.notify) {
        setTimeout(() => notify.click(), 200);
      }
    }

    const writeButton = row.querySelector('[data-write]');
    if (writeButton) {
      this.on(writeButton, 'click', async () => {
        const raw = row.querySelector('[data-payload]').value.trim();
        const format = row.querySelector('[data-format]').value;
        if (!raw) return;
        try {
          const bytes =
            format === 'hex'
              ? Uint8Array.from((raw.replace(/[^0-9a-f]/gi, '').match(/../g) ?? []).map((pair) => parseInt(pair, 16)))
              : new TextEncoder().encode(raw);
          if (!bytes.length) throw new Error('Nothing to send');
          if (characteristic.properties.write) await characteristic.writeValueWithResponse(bytes);
          else await characteristic.writeValueWithoutResponse(bytes);
          this.#write('sys', `Wrote ${bytes.length} byte${bytes.length === 1 ? '' : 's'} to ${label}`);
        } catch (failure) {
          this.#write('sys', `Write failed on ${label}: ${failure.message}`);
        }
      });
    }

    return row;
  }

  #unsubscribeAll() {
    this.#subscriptions.clear();
  }
}

define('jg-app-bluetooth-scanner', BluetoothScanner);
