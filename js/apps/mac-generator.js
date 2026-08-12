import { JGApp, define, html, css } from '../core/app.js';
import { randomBytes, copyText, debounce } from '../core/util.js';

const sheet = css`
  .list { font-family: var(--font-mono); font-size: 12.5px; line-height: 1.9; user-select: all; }
`;

const SEPARATORS = [
  { value: ':', label: 'Colon - 00:1b:44' },
  { value: '-', label: 'Hyphen - 00-1b-44' },
  { value: '.', label: 'Cisco - 001b.4411' },
  { value: '', label: 'None - 001b4411' },
];

const format = (bytes, separator, upper) => {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  const text = separator === '.' ? `${hex[0]}${hex[1]}.${hex[2]}${hex[3]}.${hex[4]}${hex[5]}` : hex.join(separator);
  return upper ? text.toUpperCase() : text;
};

const generate = ({ prefix, unicast, universal }) => {
  const bytes = randomBytes(6);
  const parts = prefix.replace(/[^0-9a-f]/gi, '');
  for (let i = 0; i < Math.min(6, Math.floor(parts.length / 2)); i += 1) {
    bytes[i] = parseInt(parts.substr(i * 2, 2), 16);
  }
  if (!parts.length) {
    bytes[0] = unicast ? bytes[0] & 0xfe : bytes[0] | 0x01;
    bytes[0] = universal ? bytes[0] & 0xfd : bytes[0] | 0x02;
  }
  return bytes;
};

class MacGenerator extends JGApp {
  static appId = 'mac-generator';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row nowrap">
        <jg-input id="prefix" class="grow" mono placeholder="Optional OUI prefix, e.g. 00:1B:44"></jg-input>
        <jg-input id="count" type="number" min="1" max="200" value="5" suffix="qty" style="width:120px"></jg-input>
        <jg-button id="generate">Generate</jg-button>
      </div>

      <div class="row">
        <jg-select id="separator" value=":" style="width:200px">
          ${SEPARATORS.map((item) => html`<option value="${item.value}">${item.label}</option>`)}
        </jg-select>
        <jg-switch id="upper"></jg-switch><span class="hint">Uppercase</span>
        <jg-switch id="unicast" checked></jg-switch><span class="hint">Unicast</span>
        <jg-switch id="universal" checked></jg-switch><span class="hint">Universally administered</span>
      </div>

      <jg-field label="Addresses" grow>
        <div slot="action"><jg-button size="sm" variant="outline" id="copy">Copy all</jg-button></div>
        <pre class="code tall scroll list" id="out"></pre>
      </jg-field>

      <jg-card title="Analyse an address">
        <jg-input id="analyse" mono placeholder="00:1b:44:11:3a:b7"></jg-input>
        <div class="kv" id="details"></div>
      </jg-card>
    </div>`);

    this.on(this.$('#generate'), 'click', () => this.#run());
    ['#separator', '#upper', '#unicast', '#universal'].forEach((selector) =>
      this.on(this.$(selector), 'change', () => this.#run()),
    );
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').textContent));
    this.on(this.$('#analyse'), 'input', debounce(() => this.#analyse(), 140));
    this.#run();
  }

  #run() {
    const count = Math.min(200, Math.max(1, Number(this.$('#count').value) || 1));
    const separator = this.$('#separator').value;
    const upper = this.$('#upper').checked;
    const options = {
      prefix: this.$('#prefix').value,
      unicast: this.$('#unicast').checked,
      universal: this.$('#universal').checked,
    };
    this.$('#out').textContent = Array.from({ length: count }, () => format(generate(options), separator, upper)).join('\n');
  }

  #analyse() {
    const raw = this.$('#analyse').value.replace(/[^0-9a-f]/gi, '');
    const details = this.$('#details');
    if (raw.length !== 12) {
      details.innerHTML = html`<div>Status</div><div>${raw.length ? 'Needs 12 hex digits' : 'Waiting for input'}</div>`;
      return;
    }
    const bytes = Uint8Array.from(raw.match(/../g).map((pair) => parseInt(pair, 16)));
    details.innerHTML = html`
      <div>Normalised</div><div class="mono">${format(bytes, ':', false)}</div>
      <div>OUI</div><div class="mono">${format(bytes.slice(0, 3), ':', true)}</div>
      <div>Device id</div><div class="mono">${format(bytes.slice(3), ':', true)}</div>
      <div>Cast</div><div>${bytes[0] & 0x01 ? 'Multicast' : 'Unicast'}</div>
      <div>Administration</div><div>${bytes[0] & 0x02 ? 'Locally administered' : 'Universally administered'}</div>
      <div>EUI-64</div><div class="mono">${format(Uint8Array.from([bytes[0] ^ 0x02, bytes[1], bytes[2], 0xff, 0xfe, bytes[3], bytes[4], bytes[5]]), ':', false)}</div>
    `;
  }
}

define('jg-app-mac', MacGenerator);
