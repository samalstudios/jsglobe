import { JGApp, define, html, css } from '../core/app.js';
import { copyText } from '../core/util.js';

const sheet = css`
  .app { container-type: inline-size; }
  .unsupported { display: grid; place-items: center; gap: 10px; padding: 48px 20px; text-align: center; }
  .device { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .device .name { font-size: 14px; font-weight: 600; }
  .device .id { font: 500 11.5px/1 var(--font-mono); color: var(--muted-foreground); }
  .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--muted-foreground); flex: none; }
  .dot[data-on="true"] { background: var(--success, #4a7a58); }

  .tree { display: grid; gap: 8px; }
  .service {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
    overflow: hidden;
  }
  .service > header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--muted) 60%, transparent);
  }
  .service .label { font-size: 12.5px; font-weight: 600; color: var(--foreground); }
  .service .uuid { font: 500 11px/1 var(--font-mono); color: var(--muted-foreground); }
  .char { display: grid; gap: 4px; padding: 9px 12px; border-bottom: 1px solid var(--border); }
  .char:last-child { border-bottom: 0; }
  .char .top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .char .value { font: 12px/1.4 var(--font-mono); color: var(--muted-foreground); overflow-wrap: anywhere; }
  .flags { display: flex; gap: 4px; flex-wrap: wrap; }
  .flag {
    font: 500 10px/1 var(--font-mono);
    padding: 3px 6px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--muted-foreground);
  }
`;

const NAMED = {
  '0000180f-0000-1000-8000-00805f9b34fb': 'Battery',
  '0000180a-0000-1000-8000-00805f9b34fb': 'Device information',
  '00001800-0000-1000-8000-00805f9b34fb': 'Generic access',
  '00001801-0000-1000-8000-00805f9b34fb': 'Generic attribute',
  '0000180d-0000-1000-8000-00805f9b34fb': 'Heart rate',
  '00001812-0000-1000-8000-00805f9b34fb': 'Human interface device',
  '0000181a-0000-1000-8000-00805f9b34fb': 'Environmental sensing',
  '00002a19-0000-1000-8000-00805f9b34fb': 'Battery level',
  '00002a29-0000-1000-8000-00805f9b34fb': 'Manufacturer name',
  '00002a24-0000-1000-8000-00805f9b34fb': 'Model number',
  '00002a26-0000-1000-8000-00805f9b34fb': 'Firmware revision',
  '00002a00-0000-1000-8000-00805f9b34fb': 'Device name',
  '00002a37-0000-1000-8000-00805f9b34fb': 'Heart rate measurement',
};

const FLAGS = ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate', 'broadcast', 'authenticatedSignedWrites'];

class BluetoothScanner extends JGApp {
  static appId = 'bluetooth-scanner';
  static styles = [...JGApp.styles, sheet];

  #device = null;
  #server = null;

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">Bluetooth</div>
        <div class="hint">${navigator.bluetooth ? 'Browse GATT services on a nearby device' : 'Needs Chrome or Edge'}</div>
      </div>
    </div>`);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
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
      <div class="row">
        <span class="dot" id="dot"></span>
        <span class="title" id="state">Nothing paired</span>
        <span class="grow"></span>
        <jg-switch id="all"></jg-switch><span class="hint">Show every device</span>
        <jg-button size="sm" id="pick">Choose a device</jg-button>
        <jg-button size="sm" variant="outline" id="drop" disabled>Disconnect</jg-button>
      </div>

      <p class="hint" id="note">
        The browser shows its own picker and only hands over the device you select. Scanning happens in the browser,
        never on a server.
      </p>

      <div class="device" id="device" hidden>
        <span class="name" id="name"></span>
        <span class="id" id="id"></span>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="copy">Copy report</jg-button>
      </div>

      <div class="tree" id="tree"></div>
      <span class="error" id="error"></span>
    </div>`);

    this.on(this.$('#pick'), 'click', () => this.#pick());
    this.on(this.$('#drop'), 'click', () => {
      this.#server?.disconnect();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#tree').textContent.replace(/\n{2,}/g, '\n')));
  }

  async #pick() {
    const error = this.$('#error');
    error.textContent = '';
    try {
      const device = await navigator.bluetooth.requestDevice(
        this.$('#all').checked
          ? { acceptAllDevices: true, optionalServices: Object.keys(NAMED) }
          : { filters: [{ services: ['battery_service'] }, { services: ['device_information'] }], optionalServices: Object.keys(NAMED) },
      );
      this.#device = device;
      this.$('#device').hidden = false;
      this.$('#name').textContent = device.name || 'Unnamed device';
      this.$('#id').textContent = device.id;
      this.$('#state').textContent = 'Connecting';

      device.addEventListener('gattserverdisconnected', () => {
        this.$('#state').textContent = 'Disconnected';
        this.$('#dot').dataset.on = 'false';
        this.$('#drop').disabled = true;
      });

      this.#server = await device.gatt.connect();
      this.$('#state').textContent = 'Connected';
      this.$('#dot').dataset.on = 'true';
      this.$('#drop').disabled = false;
      await this.#walk();
    } catch (failure) {
      if (failure.name !== 'NotFoundError') error.textContent = failure.message;
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
        <span class="label">${NAMED[service.uuid] ?? 'Service'}</span>
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
        const row = document.createElement('div');
        row.className = 'char';
        const flags = FLAGS.filter((flag) => characteristic.properties[flag]);
        row.innerHTML = html`<div class="top">
            <span class="label">${NAMED[characteristic.uuid] ?? 'Characteristic'}</span>
            <span class="uuid">${characteristic.uuid}</span>
            <span class="flags">${flags.map((flag) => html`<span class="flag">${flag}</span>`)}</span>
          </div>
          <span class="value">-</span>`;
        box.append(row);

        if (characteristic.properties.read) {
          try {
            const value = await characteristic.readValue();
            const bytes = new Uint8Array(value.buffer);
            const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
            const text = new TextDecoder().decode(bytes).replace(/[^\x20-\x7e]/g, '.');
            row.querySelector('.value').textContent = `${hex}${text.trim() ? `   ${text}` : ''}`;
          } catch (failure) {
            row.querySelector('.value').textContent = `read failed: ${failure.message}`;
          }
        }
      }
    }

    if (!services.length) this.$('#error').textContent = 'The device exposed no readable services.';
  }
}

define('jg-app-bluetooth-scanner', BluetoothScanner);
