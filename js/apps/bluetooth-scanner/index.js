import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { icon } from '../../ui/icons.js';
import { copyText, download, toast } from '../../core/util.js';
import {
  SERVICE_NAMES,
  VENDOR_NAMES,
  USER_DESCRIPTION,
  fullUuid,
  shortUuid,
  isAssigned,
  nameFor,
  propertiesOf,
  decodeValue,
  parsePayload,
  toHex,
  tableToText,
} from '../../lib/gatt.js';

const t = await appWords('bluetooth-scanner', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

// the services the picker asks for by default, so a device that has them can be
// filtered down to. Anything else needs its uuid adding by hand
const KNOWN = [...Object.keys(SERVICE_NAMES).map(fullUuid), ...Object.keys(VENDOR_NAMES)];

const clock = () => new Date().toLocaleTimeString([], { hour12: false });

class BluetoothScanner extends JGApp {
  static appId = 'bluetooth-scanner';
  static settings = [
    { key: 'autoNotify', label: t('bluetooth-scanner.subscribeAutomatically', 'Subscribe automatically'), type: 'switch', default: true },
    { key: 'autoRead', label: t('bluetooth-scanner.readEverythingOnConnect', 'Read every value on connecting'), type: 'switch', default: true },
    { key: 'hex', label: t('bluetooth-scanner.alwaysShowRawBytes', 'Always show the raw bytes'), type: 'switch', default: false },
  ];
  static styles = [...JGApp.styles, sheet];

  #device = null;
  #server = null;
  #subscriptions = new Map();
  #lines = [];
  #table = [];
  #filter = 'all';

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('bluetooth-scanner.bluetooth', 'Bluetooth')}</div>
        <div class="hint">
          ${navigator.bluetooth
            ? t('bluetooth-scanner.widgetBlurb', 'Explore GATT services, subscribe and write')
            : t('bluetooth-scanner.needsChromeOrEdge', 'Needs Chrome or Edge')}
        </div>
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
        <div class="title">${t('bluetooth-scanner.webBluetoothIsNotAvailable', 'Web Bluetooth is not available here')}</div>
        <p class="hint" style="max-width:48ch">
          ${t(
            'bluetooth-scanner.whichBrowsersHaveIt',
            'Chrome, Edge and Opera on desktop and Android expose navigator.bluetooth. Safari and Firefox have not shipped it, and iOS blocks it entirely. A secure origin is required.',
          )}
        </p>
      </div></div>`);
      return;
    }

    this.paint(html`<div class="app">
      <div class="head">
        <span class="dot" id="dot" data-on="false"></span>
        <span class="title" id="state">${t('bluetooth-scanner.nothingPaired', 'Nothing paired')}</span>
        <span class="hint mono tiny" id="rssi" hidden></span>
        <span class="grow"></span>
        <jg-switch id="all" checked></jg-switch><span class="hint">${t('bluetooth-scanner.anyDevice', 'Any device')}</span>
        <jg-button size="sm" variant="ghost" id="uuids" title="${t('bluetooth-scanner.customServices', 'Custom services')}">${icon('plus', 13)}</jg-button>
        <jg-button size="sm" id="pick">${t('bluetooth-scanner.chooseADevice', 'Choose a device')}</jg-button>
        <jg-button size="sm" variant="outline" id="again" hidden>${t('bluetooth-scanner.reconnect', 'Reconnect')}</jg-button>
        <jg-button size="sm" variant="outline" id="drop" disabled>${t('bluetooth-scanner.disconnect', 'Disconnect')}</jg-button>
      </div>

      <div class="body">
        <div class="treepane">
          <div class="treehead" id="treehead" hidden>
            <span class="hint" id="summary"></span>
            <span class="grow"></span>
            <jg-button size="sm" variant="ghost" id="fold">${t('bluetooth-scanner.collapseAll', 'Collapse all')}</jg-button>
            <jg-button size="sm" variant="ghost" id="save-table">${t('bluetooth-scanner.saveTable', 'Save table')}</jg-button>
          </div>
          <div class="tree" id="tree">
            <p class="hint">
              ${t(
                'bluetooth-scanner.pickerExplainer',
                'The browser shows its own picker and hands over only the device you select. Reading, subscribing and writing all happen here in the tab.',
              )}
            </p>
          </div>
        </div>

        <div class="log-pane">
          <div class="row" style="padding:10px 12px 0">
            <span class="label">${t('bluetooth-scanner.liveLog', 'Live log')}</span>
            <span class="grow"></span>
            <jg-button size="sm" variant="ghost" id="copy-log">${t('bluetooth-scanner.copy', 'Copy')}</jg-button>
            <jg-button size="sm" variant="ghost" id="save-log">${t('bluetooth-scanner.save', 'Save')}</jg-button>
            <jg-button size="sm" variant="ghost" id="clear-log">${t('bluetooth-scanner.clear', 'Clear')}</jg-button>
          </div>
          <div class="row logfilter">
            <jg-tabs id="kinds" size="sm"></jg-tabs>
            <span class="grow"></span>
            <jg-button size="sm" variant="ghost" id="hold">${t('bluetooth-scanner.pause', 'Pause')}</jg-button>
          </div>
          <div class="log" id="log"><span class="sys">${t('bluetooth-scanner.waitingForADevice', 'Waiting for a device.')}</span></div>
        </div>
      </div>

      <span class="error" id="error" style="padding:0 14px 10px"></span>

      <jg-dialog id="uuid-box" title-text="${t('bluetooth-scanner.customServices', 'Custom services')}"
        sub="${t('bluetooth-scanner.customServicesExplainer', 'A browser only hands over services that were asked for by name. Add the uuids your device uses, one per line, before choosing it.')}">
        <jg-textarea id="uuid-list" rows="6" placeholder="6e400001-b5a3-f393-e0a9-e50e24dcca9e"></jg-textarea>
        <span class="error" id="uuid-error"></span>
        <div class="row end">
          <jg-button size="sm" variant="outline" id="uuid-cancel">${t('bluetooth-scanner.cancel', 'Cancel')}</jg-button>
          <jg-button size="sm" id="uuid-save">${t('bluetooth-scanner.keepThem', 'Keep them')}</jg-button>
        </div>
      </jg-dialog>
    </div>`);

    this.$('#kinds').items = [
      { value: 'all', label: t('bluetooth-scanner.everything', 'Everything') },
      { value: 'notify', label: t('bluetooth-scanner.notifications', 'Notifications') },
      { value: 'read', label: t('bluetooth-scanner.reads', 'Reads') },
      { value: 'sys', label: t('bluetooth-scanner.events', 'Events') },
    ];
    this.$('#kinds').value = 'all';

    this.on(this.$('#pick'), 'click', () => this.#pick());
    this.on(this.$('#again'), 'click', () => this.#connect(this.#device));
    this.on(this.$('#drop'), 'click', () => this.#disconnect());
    this.on(this.$('#copy-log'), 'click', () => {
      copyText(this.#lines.join('\n'));
      toast(t('bluetooth-scanner.logCopied', 'Log copied'));
    });
    this.on(this.$('#save-log'), 'click', () => download('bluetooth-log.txt', this.#lines.join('\n')));
    this.on(this.$('#clear-log'), 'click', () => {
      this.#lines = [];
      this.$('#log').innerHTML = '';
    });
    this.on(this.$('#hold'), 'click', () => this.#toggleHold());
    this.on(this.$('#kinds'), 'change', (event) => {
      this.#filter = event.detail.value;
      this.$('#log').dataset.only = this.#filter;
    });

    this.on(this.$('#fold'), 'click', () => this.#foldAll());
    this.on(this.$('#save-table'), 'click', () => this.#saveTable());
    this.on(this.$('#uuids'), 'click', () => {
      this.$('#uuid-list').value = (this.config.get('extra', []) ?? []).join('\n');
      this.$('#uuid-error').textContent = '';
      this.$('#uuid-box').open();
    });
    this.on(this.$('#uuid-cancel'), 'click', () => this.$('#uuid-box').close());
    this.on(this.$('#uuid-save'), 'click', () => this.#keepUuids());

    this.on(this.$('#tree'), 'click', (event) => {
      const uuid = event.target.closest('[data-copy]');
      if (uuid) {
        copyText(uuid.dataset.copy);
        toast(t('bluetooth-scanner.uuidCopied', 'UUID copied'));
        return;
      }
      const header = event.target.closest('.service > header');
      if (header) header.parentElement.classList.toggle('shut');
    });
  }

  // ---- the log ----------------------------------------------------------

  #toggleHold() {
    const log = this.$('#log');
    log.dataset.held = log.dataset.held === 'true' ? 'false' : 'true';
    this.$('#hold').textContent =
      log.dataset.held === 'true' ? t('bluetooth-scanner.resume', 'Resume') : t('bluetooth-scanner.pause', 'Pause');
  }

  #write(kind, text) {
    const stamp = clock();
    this.#lines.push(`${stamp}  ${text}`);
    if (this.#lines.length > 800) this.#lines.shift();

    const log = this.$('#log');
    if (!log || log.dataset.held === 'true') return;
    const stuck = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
    const line = document.createElement('div');
    line.className = kind;
    line.dataset.kind = kind;
    line.innerHTML = html`<span class="stamp">${stamp}</span> ${text}`;
    log.append(line);
    while (log.childElementCount > 800) log.firstElementChild.remove();
    if (stuck) log.scrollTop = log.scrollHeight;
  }

  // ---- custom service uuids ---------------------------------------------

  #keepUuids() {
    const typed = this.$('#uuid-list')
      .value.split(/[\s,]+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const bad = typed.filter((entry) => !fullUuid(entry));
    if (bad.length) {
      this.$('#uuid-error').textContent = t('bluetooth-scanner.notAUuid', 'Not a uuid: {value}', { value: bad[0] });
      return;
    }
    this.config.set('extra', [...new Set(typed.map(fullUuid))]);
    this.$('#uuid-box').close();
    toast(t('bluetooth-scanner.uuidsKept', '{count} custom services kept', { count: typed.length }));
  }

  #wanted() {
    return [...new Set([...KNOWN, ...(this.config.get('extra', []) ?? [])])];
  }

  // ---- connecting -------------------------------------------------------

  async #pick() {
    this.$('#error').textContent = '';
    const optionalServices = this.#wanted();
    try {
      const device = await navigator.bluetooth.requestDevice(
        this.$('#all').checked
          ? { acceptAllDevices: true, optionalServices }
          : { filters: optionalServices.map((service) => ({ services: [service] })), optionalServices },
      );

      device.addEventListener('gattserverdisconnected', () => this.#dropped());
      this.#watchSignal(device);
      await this.#connect(device);
    } catch (failure) {
      if (failure.name === 'NotFoundError') return;
      this.$('#error').textContent = failure.message;
      this.#write('sys', t('bluetooth-scanner.errorWas', 'Error: {reason}', { reason: failure.message }));
    }
  }

  async #connect(device) {
    if (!device) return;
    this.#device = device;
    const name = device.name || t('bluetooth-scanner.unnamedDevice', 'Unnamed device');
    this.$('#state').textContent = name;
    this.$('#again').hidden = true;
    this.#write('sys', t('bluetooth-scanner.selectedDevice', 'Selected {name}', { name }));

    try {
      this.#server = await device.gatt.connect();
      this.$('#dot').dataset.on = 'true';
      this.$('#drop').disabled = false;
      this.#write('sys', t('bluetooth-scanner.connectedReadingTable', 'Connected, reading the GATT table.'));
      await this.#walk();
    } catch (failure) {
      this.$('#error').textContent = failure.message;
      this.#write('sys', t('bluetooth-scanner.errorWas', 'Error: {reason}', { reason: failure.message }));
      this.#dropped();
    }
  }

  #disconnect() {
    this.#unsubscribeAll();
    try {
      this.#server?.disconnect();
    } catch {
      /* already gone */
    }
    this.#dropped();
  }

  // whatever ended the connection, nothing in the table works any more, so it
  // stops offering buttons that can only fail
  #dropped() {
    this.$('#state').textContent = t('bluetooth-scanner.disconnected', 'Disconnected');
    this.$('#dot').dataset.on = 'false';
    this.$('#drop').disabled = true;
    this.$('#again').hidden = !this.#device;
    this.$('#rssi').hidden = true;
    this.#subscriptions.clear();
    this.$('#tree').dataset.stale = 'true';
    for (const button of this.$$('.char jg-button, .char jg-input, .char jg-select')) button.disabled = true;
    this.#write('sys', t('bluetooth-scanner.deviceDisconnected', 'Device disconnected.'));
  }

  async #watchSignal(device) {
    if (typeof device.watchAdvertisements !== 'function') return;
    try {
      device.addEventListener('advertisementreceived', (event) => {
        const label = this.$('#rssi');
        if (!label || typeof event.rssi !== 'number') return;
        label.hidden = false;
        label.textContent = `${event.rssi} dBm`;
      });
      await device.watchAdvertisements();
    } catch {
      /* advertisement watching is behind a flag on some builds */
    }
  }

  // ---- the table --------------------------------------------------------

  async #walk() {
    const tree = this.$('#tree');
    tree.innerHTML = '';
    delete tree.dataset.stale;
    this.#table = [];

    let services = [];
    try {
      services = await this.#server.getPrimaryServices();
    } catch (failure) {
      this.$('#error').textContent = t('bluetooth-scanner.couldNotListServices', 'Could not list the services: {reason}', {
        reason: failure.message,
      });
      return;
    }

    let characteristicCount = 0;

    for (const service of services) {
      const name = nameFor(service.uuid, 'service');
      const box = document.createElement('div');
      box.className = 'service';
      box.innerHTML = html`<header>
        <span class="twist">${icon('chevronRight', 13)}</span>
        <span class="label">${name ?? t('bluetooth-scanner.service', 'Service')}</span>
        <button class="uuid" data-copy="${service.uuid}" title="${service.uuid}">${shortUuid(service.uuid)}</button>
        ${isAssigned(service.uuid) ? '' : html`<span class="flag vendor">${t('bluetooth-scanner.vendor', 'vendor')}</span>`}
      </header>`;
      tree.append(box);

      let characteristics = [];
      try {
        characteristics = await service.getCharacteristics();
      } catch {
        continue;
      }

      const noted = [];
      for (const characteristic of characteristics) {
        const row = await this.#charRow(characteristic);
        box.append(row.element);
        noted.push(row.note);
        characteristicCount += 1;
      }
      this.#table.push({ uuid: service.uuid, name, characteristics: noted });
    }

    this.$('#treehead').hidden = !services.length;
    this.$('#summary').textContent = t('bluetooth-scanner.tableSummary', '{services} services, {characteristics} characteristics', {
      services: services.length,
      characteristics: characteristicCount,
    });

    if (!services.length) {
      this.$('#error').textContent = t(
        'bluetooth-scanner.noServicesHandedOver',
        'The browser handed over no services. A device that uses its own uuids needs them adding under Custom services.',
      );
    }
  }

  // a vendor characteristic has no name of its own, but devices usually write
  // one into the description descriptor
  async #describedName(characteristic) {
    const known = nameFor(characteristic.uuid, 'characteristic');
    if (known) return known;
    try {
      const descriptor = await characteristic.getDescriptor(USER_DESCRIPTION);
      const value = await descriptor.readValue();
      const text = new TextDecoder().decode(value).replace(/\0+$/, '').trim();
      if (text) return text;
    } catch {
      /* most characteristics carry no description */
    }
    return null;
  }

  async #charRow(characteristic) {
    const row = document.createElement('div');
    row.className = 'char';
    const flags = propertiesOf(characteristic.properties);
    const described = await this.#describedName(characteristic);
    const label = described ?? t('bluetooth-scanner.characteristic', 'Characteristic');
    const writable = characteristic.properties.write || characteristic.properties.writeWithoutResponse;
    const note = { uuid: characteristic.uuid, name: described, properties: flags, value: null };

    row.innerHTML = html`
      <div class="top">
        <span class="label">${label}</span>
        <button class="uuid" data-copy="${characteristic.uuid}" title="${characteristic.uuid}">${shortUuid(characteristic.uuid)}</button>
        <span class="flags">${flags.map((flag) => html`<span class="flag">${flag}</span>`)}</span>
      </div>
      <div class="value" data-value><span class="idle">${t('bluetooth-scanner.notReadYet', 'Not read yet')}</span></div>
      <div class="actions">
        ${characteristic.properties.read ? html`<jg-button size="sm" variant="outline" data-read>${t('bluetooth-scanner.read', 'Read')}</jg-button>` : ''}
        ${characteristic.properties.notify || characteristic.properties.indicate
          ? html`<jg-button size="sm" variant="outline" data-notify>${t('bluetooth-scanner.subscribe', 'Subscribe')}</jg-button>`
          : ''}
        ${writable
          ? html`<jg-input size="sm" data-payload placeholder="${t('bluetooth-scanner.hexOrText', 'hex or text')}" style="width:150px"></jg-input>
              <jg-select size="sm" data-format value="hex" style="width:88px">
                <option value="hex">${t('bluetooth-scanner.hex', 'hex')}</option><option value="text">${t('bluetooth-scanner.text', 'text')}</option>
              </jg-select>
              <jg-button size="sm" data-write>${t('bluetooth-scanner.write', 'Write')}</jg-button>`
          : ''}
      </div>
    `;

    // the reading leads, the bytes follow it only when they add something
    const show = (view) => {
      const reading = decodeValue(characteristic.uuid, view);
      const bytes = toHex(view);
      const raw = this.config.get('hex', false) || !reading;
      row.querySelector('[data-value]').innerHTML = html`
        ${reading ? html`<span class="reading">${reading.text}</span>` : ''}
        ${raw ? html`<span class="bytes">${bytes}</span>` : ''}
        <span class="when">${clock()}</span>`;
      note.value = reading?.text ?? bytes;
      return reading?.text ?? null;
    };

    const read = row.querySelector('[data-read]');
    if (read) {
      this.on(read, 'click', async () => {
        try {
          const view = await characteristic.readValue();
          const reading = show(view);
          this.#write('read', `${label} ${reading ?? toHex(view)}`);
        } catch (failure) {
          this.#write('sys', t('bluetooth-scanner.readFailed', 'Read failed on {name}: {reason}', { name: label, reason: failure.message }));
        }
      });
      if (this.config.get('autoRead', true)) read.click();
    }

    const notify = row.querySelector('[data-notify]');
    if (notify) {
      this.on(notify, 'click', () => this.#toggleNotify(characteristic, notify, label, show));
      if (this.config.get('autoNotify', true) && characteristic.properties.notify) {
        setTimeout(() => notify.click(), 200);
      }
    }

    const writeButton = row.querySelector('[data-write]');
    if (writeButton) {
      this.on(writeButton, 'click', async () => {
        const raw = row.querySelector('[data-payload]').value;
        const format = row.querySelector('[data-format]').value;
        try {
          const bytes = parsePayload(raw, format);
          if (!bytes.length) throw new Error(t('bluetooth-scanner.nothingToSend', 'Nothing to send'));
          if (characteristic.properties.write) await characteristic.writeValueWithResponse(bytes);
          else await characteristic.writeValueWithoutResponse(bytes);
          this.#write('sys', t('bluetooth-scanner.wroteBytes', 'Wrote {count} bytes to {name}', { count: bytes.length, name: label }));
        } catch (failure) {
          this.#write('sys', t('bluetooth-scanner.writeFailed', 'Write failed on {name}: {reason}', { name: label, reason: failure.message }));
        }
      });
    }

    return { element: row, note };
  }

  async #toggleNotify(characteristic, button, label, show) {
    const live = this.#subscriptions.get(characteristic.uuid);
    try {
      if (live) {
        await this.#unsubscribe(characteristic.uuid);
        button.textContent = t('bluetooth-scanner.subscribe', 'Subscribe');
        this.#write('sys', t('bluetooth-scanner.stoppedListening', 'Stopped listening to {name}', { name: label }));
        return;
      }
      const handler = (event) => {
        const reading = show(event.target.value);
        this.#write('notify', `${label} ${reading ?? toHex(event.target.value)}`);
      };
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handler);
      this.#subscriptions.set(characteristic.uuid, { characteristic, handler });
      button.textContent = t('bluetooth-scanner.unsubscribe', 'Unsubscribe');
      this.#write('sys', t('bluetooth-scanner.subscribedTo', 'Subscribed to {name}', { name: label }));
    } catch (failure) {
      this.#write('sys', t('bluetooth-scanner.subscribeFailed', 'Subscribe failed on {name}: {reason}', { name: label, reason: failure.message }));
    }
  }

  // ---- housekeeping -----------------------------------------------------

  async #unsubscribe(uuid) {
    const held = this.#subscriptions.get(uuid);
    if (!held) return;
    this.#subscriptions.delete(uuid);
    held.characteristic.removeEventListener('characteristicvaluechanged', held.handler);
    try {
      await held.characteristic.stopNotifications();
    } catch {
      /* the connection may already have gone */
    }
  }

  #unsubscribeAll() {
    for (const uuid of [...this.#subscriptions.keys()]) this.#unsubscribe(uuid);
  }

  #foldAll() {
    const boxes = [...this.$$('.service')];
    const anyOpen = boxes.some((box) => !box.classList.contains('shut'));
    boxes.forEach((box) => box.classList.toggle('shut', anyOpen));
    this.$('#fold').textContent = anyOpen
      ? t('bluetooth-scanner.expandAll', 'Expand all')
      : t('bluetooth-scanner.collapseAll', 'Collapse all');
  }

  #saveTable() {
    download('gatt-table.txt', tableToText(this.#device, this.#table));
  }
}

define('jg-app-bluetooth-scanner', BluetoothScanner);
