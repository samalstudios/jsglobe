import { JGApp, define, html, css } from '../core/app.js';
import { debounce, chunk } from '../core/util.js';

const sheet = css`
  .formats { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
  .format { display: flex; flex-direction: column; gap: 4px; }
`;

const toAddress = (value) => [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');

const parse = (input) => {
  const text = input.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) {
    const parts = text.split('.').map(Number);
    if (parts.every((part) => part <= 255)) return parts.reduce((total, part) => (total << 8) + part, 0) >>> 0;
  }
  if (/^0x[0-9a-f]+$/i.test(text)) return Number(text) >>> 0;
  if (/^0b[01]+$/i.test(text)) return parseInt(text.slice(2), 2) >>> 0;
  if (/^\d+$/.test(text)) {
    const value = Number(text);
    if (value <= 0xffffffff) return value >>> 0;
  }
  if (/^[01]{32}$/.test(text)) return parseInt(text, 2) >>> 0;
  return null;
};

const CLASSES = [
  [0, 127, 'Class A'],
  [128, 191, 'Class B'],
  [192, 223, 'Class C'],
  [224, 239, 'Class D (multicast)'],
  [240, 255, 'Class E (reserved)'],
];

const RANGES = [
  [/^10\./, 'Private (RFC 1918)'],
  [/^172\.(1[6-9]|2\d|3[01])\./, 'Private (RFC 1918)'],
  [/^192\.168\./, 'Private (RFC 1918)'],
  [/^127\./, 'Loopback'],
  [/^169\.254\./, 'Link-local'],
  [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, 'Carrier-grade NAT'],
  [/^224\./, 'Multicast'],
  [/^0\./, 'This network'],
];

class IpConverter extends JGApp {
  static appId = 'ip-converter';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="IPv4 address or numeric form" hint="Accepts dotted quad, decimal, 0x hex or binary">
        <jg-input id="input" mono value="192.168.1.1"></jg-input>
      </jg-field>
      <div class="hint" id="status"></div>

      <div class="formats">
        <div class="format"><span class="label">Dotted decimal</span><jg-output data-out="dotted"></jg-output></div>
        <div class="format"><span class="label">Decimal</span><jg-output data-out="decimal"></jg-output></div>
        <div class="format"><span class="label">Hexadecimal</span><jg-output data-out="hex"></jg-output></div>
        <div class="format"><span class="label">Octal</span><jg-output data-out="octal"></jg-output></div>
        <div class="format"><span class="label">Binary</span><jg-output data-out="binary"></jg-output></div>
        <div class="format"><span class="label">IPv6 mapped</span><jg-output data-out="ipv6"></jg-output></div>
      </div>

      <jg-card title="Classification">
        <div class="kv" id="details"></div>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 130));
    this.#run();
  }

  #run() {
    const value = parse(this.$('#input').value);
    const status = this.$('#status');

    if (value === null) {
      status.innerHTML = html`<span class="error">Could not read that address.</span>`;
      this.$$('[data-out]').forEach((node) => {
        node.value = '';
      });
      this.$('#details').innerHTML = '';
      return;
    }

    const dotted = toAddress(value);
    status.textContent = `Parsed as ${dotted}`;

    const set = (key, out) => {
      const node = this.$(`[data-out="${key}"]`);
      if (node) node.value = out;
    };

    const bytes = dotted.split('.').map(Number);
    set('dotted', dotted);
    set('decimal', String(value));
    set('hex', `0x${value.toString(16).toUpperCase().padStart(8, '0')}`);
    set('octal', bytes.map((byte) => byte.toString(8).padStart(3, '0')).join('.'));
    set('binary', chunk([...value.toString(2).padStart(32, '0')], 8).map((group) => group.join('')).join('.'));
    set('ipv6', `::ffff:${bytes[0].toString(16).padStart(2, '0')}${bytes[1].toString(16).padStart(2, '0')}:${bytes[2].toString(16).padStart(2, '0')}${bytes[3].toString(16).padStart(2, '0')}`);

    const klass = CLASSES.find(([low, high]) => bytes[0] >= low && bytes[0] <= high)?.[2] ?? 'Unknown';
    const scope = RANGES.find(([pattern]) => pattern.test(dotted))?.[1] ?? 'Public';

    this.$('#details').innerHTML = html`
      <div>Class</div><div>${klass}</div>
      <div>Scope</div><div>${scope}</div>
      <div>Octets</div><div class="mono">${bytes.join(' · ')}</div>
      <div>Reverse DNS</div><div class="mono">${[...bytes].reverse().join('.')}.in-addr.arpa</div>
      <div>Integer range</div><div class="mono">0 - 4294967295</div>
    `;
  }
}

define('jg-app-ip-converter', IpConverter);
