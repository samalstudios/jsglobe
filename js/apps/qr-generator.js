import { JGApp, define, html, css } from '../core/app.js';
import { encodeQr, qrToSvg } from '../lib/qr.js';
import { download, copyText, debounce } from '../core/util.js';

const sheet = css`
  .stage { display: grid; place-items: center; padding: 12px; }
  .frame {
    display: grid;
    place-items: center;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--card);
  }
  .frame svg, .frame canvas { max-width: 100%; height: auto; border-radius: 6px; }
  .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; }
  .cols3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
`;

const PRESETS = [
  { id: 'text', label: 'Text or URL' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'vcard', label: 'Contact' },
  { id: 'event', label: 'Event' },
  { id: 'geo', label: 'Location' },
];

const escapeWifi = (value) => value.replace(/([\\;,:"])/g, '\\$1');

const escapeIcal = (value) => value.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');

const icalDate = (value) => value.slice(0, 10).replace(/-/g, '');

const icalStamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}${String(date.getUTCMinutes()).padStart(2, '0')}00Z`;
};

class QrGenerator extends JGApp {
  static appId = 'qr-generator';
  static styles = [...JGApp.styles, sheet];

  #preset = 'text';
  #code = null;

  renderApp() {
    this.paint(html`<div class="app">
      <jg-tabs id="preset" full></jg-tabs>
      <div id="fields"></div>

      <div class="cols3">
        <jg-field label="Error correction" hint="Higher levels survive more damage">
          <jg-select id="ecl" value="M">
            <option value="L">L - 7%</option>
            <option value="M">M - 15%</option>
            <option value="Q">Q - 25%</option>
            <option value="H">H - 30%</option>
          </jg-select>
        </jg-field>
        <jg-field label="Module size"><jg-slider id="scale" min="2" max="16" value="8"></jg-slider></jg-field>
        <jg-field label="Quiet zone"><jg-slider id="margin" min="0" max="8" value="4"></jg-slider></jg-field>
        <jg-field label="Foreground"><jg-input id="dark" type="color" value="#000000"></jg-input></jg-field>
        <jg-field label="Background"><jg-input id="light" type="color" value="#ffffff"></jg-input></jg-field>
      </div>

      <div class="stage"><div class="frame" id="frame"></div></div>
      <div class="center hint" id="status"></div>

      <div class="row" style="justify-content:center">
        <jg-button size="sm" variant="outline" id="png">Download PNG</jg-button>
        <jg-button size="sm" variant="outline" id="svg">Download SVG</jg-button>
        <jg-button size="sm" variant="ghost" id="copy">Copy SVG markup</jg-button>
      </div>
    </div>`);

    this.$('#preset').items = PRESETS.map((preset) => ({ value: preset.id, label: preset.label }));
    this.$('#preset').value = this.#preset;
    this.on(this.$('#preset'), 'change', (event) => {
      this.#preset = event.detail.value;
      this.#fields();
      this.#run();
    });

    ['#ecl', '#dark', '#light'].forEach((selector) => this.on(this.$(selector), 'change', () => this.#run()));
    ['#scale', '#margin'].forEach((selector) => this.on(this.$(selector), 'input', () => this.#run()));
    this.on(this.$('#dark'), 'input', () => this.#run());
    this.on(this.$('#light'), 'input', () => this.#run());

    this.on(this.$('#png'), 'click', () => this.#downloadPng());
    this.on(this.$('#svg'), 'click', () => download('qr-code.svg', this.#svg(), 'image/svg+xml'));
    this.on(this.$('#copy'), 'click', () => copyText(this.#svg()));

    this.#fields();
    this.#run();
  }

  #fields() {
    const node = this.$('#fields');
    const forms = {
      text: html`<jg-field label="Content"><jg-textarea id="text" rows="3" sans placeholder="https://jsglobe.com">https://jsglobe.com</jg-textarea></jg-field>`,
      wifi: html`<div class="cols3">
        <jg-field label="Network name (SSID)"><jg-input id="ssid" placeholder="Home network"></jg-input></jg-field>
        <jg-field label="Password"><jg-input id="password" type="password"></jg-input></jg-field>
        <jg-field label="Security">
          <jg-select id="security" value="WPA"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">Open</option></jg-select>
        </jg-field>
      </div>`,
      email: html`<div class="cols3">
        <jg-field label="To"><jg-input id="to" placeholder="hello@example.com"></jg-input></jg-field>
        <jg-field label="Subject"><jg-input id="subject"></jg-input></jg-field>
        <jg-field label="Body"><jg-input id="body"></jg-input></jg-field>
      </div>`,
      sms: html`<div class="cols3">
        <jg-field label="Number"><jg-input id="number" placeholder="+1 555 0100"></jg-input></jg-field>
        <jg-field label="Message"><jg-input id="message"></jg-input></jg-field>
      </div>`,
      vcard: html`<div class="cols3">
        <jg-field label="Name"><jg-input id="name" placeholder="Ada Lovelace"></jg-input></jg-field>
        <jg-field label="Organisation"><jg-input id="org"></jg-input></jg-field>
        <jg-field label="Phone"><jg-input id="phone"></jg-input></jg-field>
        <jg-field label="Email"><jg-input id="vemail"></jg-input></jg-field>
        <jg-field label="Website"><jg-input id="url"></jg-input></jg-field>
      </div>`,
      event: html`<div class="cols3">
        <jg-field label="Title"><jg-input id="summary" placeholder="Team standup"></jg-input></jg-field>
        <jg-field label="Location"><jg-input id="location" placeholder="Meeting room 2"></jg-input></jg-field>
        <jg-field label="Starts"><jg-input id="start" type="datetime-local"></jg-input></jg-field>
        <jg-field label="Ends"><jg-input id="end" type="datetime-local"></jg-input></jg-field>
        <jg-field label="Description"><jg-input id="description"></jg-input></jg-field>
        <jg-field label="All day" row><jg-switch id="allday"></jg-switch></jg-field>
      </div>`,
      geo: html`<div class="cols3">
        <jg-field label="Latitude"><jg-input id="lat" value="51.5074"></jg-input></jg-field>
        <jg-field label="Longitude"><jg-input id="lon" value="-0.1278"></jg-input></jg-field>
      </div>`,
    };

    node.innerHTML = forms[this.#preset];
    node.querySelectorAll('jg-input, jg-textarea, jg-select').forEach((field) => {
      this.on(field, 'input', debounce(() => this.#run(), 200));
      this.on(field, 'change', () => this.#run());
    });
  }

  #payload() {
    const value = (id) => this.$(`#${id}`)?.value?.trim() ?? '';
    if (this.#preset === 'text') return value('text');
    if (this.#preset === 'wifi') {
      const security = value('security') || 'WPA';
      return `WIFI:T:${security};S:${escapeWifi(value('ssid'))};${security === 'nopass' ? '' : `P:${escapeWifi(value('password'))};`};`;
    }
    if (this.#preset === 'email') {
      const params = new URLSearchParams();
      if (value('subject')) params.set('subject', value('subject'));
      if (value('body')) params.set('body', value('body'));
      const query = params.toString();
      return `mailto:${value('to')}${query ? `?${query}` : ''}`;
    }
    if (this.#preset === 'sms') return `SMSTO:${value('number')}:${value('message')}`;
    if (this.#preset === 'geo') return `geo:${value('lat')},${value('lon')}`;
    if (this.#preset === 'event') {
      const allDay = this.$('#allday')?.checked;
      const start = value('start');
      const end = value('end');
      if (!value('summary') || !start) return '';
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        `SUMMARY:${escapeIcal(value('summary'))}`,
        value('location') && `LOCATION:${escapeIcal(value('location'))}`,
        value('description') && `DESCRIPTION:${escapeIcal(value('description'))}`,
        `DTSTART${allDay ? `;VALUE=DATE:${icalDate(start)}` : `:${icalStamp(start)}`}`,
        end && `DTEND${allDay ? `;VALUE=DATE:${icalDate(end)}` : `:${icalStamp(end)}`}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ]
        .filter(Boolean)
        .join('\n');
    }
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${value('name')}`,
      value('org') && `ORG:${value('org')}`,
      value('phone') && `TEL:${value('phone')}`,
      value('vemail') && `EMAIL:${value('vemail')}`,
      value('url') && `URL:${value('url')}`,
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\n');
  }

  #options() {
    return {
      scale: Number(this.$('#scale').value),
      margin: Number(this.$('#margin').value),
      dark: this.$('#dark').value,
      light: this.$('#light').value,
    };
  }

  #svg() {
    return this.#code ? qrToSvg(this.#code, this.#options()) : '';
  }

  #run() {
    const payload = this.#payload();
    const frame = this.$('#frame');
    const status = this.$('#status');

    if (!payload.trim() || payload === 'WIFI:T:WPA;S:;;') {
      this.#code = null;
      frame.innerHTML = '';
      status.textContent = 'Fill in the fields to generate a code.';
      return;
    }

    try {
      this.#code = encodeQr(payload, this.$('#ecl').value);
      frame.innerHTML = this.#svg();
      status.textContent = `Version ${this.#code.version} · ${this.#code.size}×${this.#code.size} modules · mask ${this.#code.mask} · ${this.#code.used} of ${this.#code.capacity} bytes used`;
    } catch (error) {
      this.#code = null;
      frame.innerHTML = '';
      status.innerHTML = html`<span class="error">${error.message}</span>`;
    }
  }

  #downloadPng() {
    if (!this.#code) return;
    const { scale, margin, dark, light } = this.#options();
    const size = (this.#code.size + margin * 2) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = light;
    context.fillRect(0, 0, size, size);
    context.fillStyle = dark;
    this.#code.modules.forEach((row, y) => {
      row.forEach((filled, x) => {
        if (filled) context.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
      });
    });
    canvas.toBlob((blob) => download('qr-code.png', blob, 'image/png'));
  }
}

define('jg-app-qr', QrGenerator);
