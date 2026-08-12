import { JGApp, define, html, css } from '../core/app.js';
import { debounce, chunk } from '../core/util.js';

const sheet = css`
  .binary { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.04em; overflow-wrap: anywhere; }
  .net { color: var(--ring); }
  .host { color: var(--muted-foreground); }
`;

const toInt = (address) =>
  address.split('.').reduce((total, part) => (total << 8) + (Number(part) & 255), 0) >>> 0;

const toAddress = (value) => [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');

const toBinary = (value) => chunk([...(value >>> 0).toString(2).padStart(32, '0')], 8).map((group) => group.join('')).join('.');

const isPrivate = (value) => {
  const [a, b] = toAddress(value).split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || (a === 169 && b === 254);
};

class SubnetCalculator extends JGApp {
  static appId = 'subnet-calculator';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="IPv4 address with prefix">
        <div class="row nowrap">
          <jg-input id="address" class="grow" mono value="192.168.1.130"></jg-input>
          <jg-select id="prefix" value="24" style="width:130px">
            ${Array.from({ length: 33 }, (unused, index) => index).map((bits) => html`<option value="${bits}">/${bits}</option>`)}
          </jg-select>
        </div>
      </jg-field>
      <div class="hint" id="status"></div>

      <jg-card title="Network">
        <div class="kv" id="details"></div>
      </jg-card>

      <jg-card title="Binary" sub="Network bits in accent, host bits muted">
        <div class="binary" id="binary"></div>
      </jg-card>

      <jg-card title="Split into subnets">
        <div class="row nowrap">
          <jg-select id="split" value="0" style="width:170px"></jg-select>
          <span class="hint" id="splitinfo"></span>
        </div>
        <pre class="code scroll" id="subnets" style="max-height:200px"></pre>
      </jg-card>
    </div>`);

    const run = debounce(() => this.#run(), 140);
    this.on(this.$('#address'), 'input', run);
    this.on(this.$('#prefix'), 'change', () => this.#run());
    this.on(this.$('#split'), 'change', () => this.#split());
    this.#run();
  }

  #run() {
    const address = this.$('#address').value.trim();
    const prefix = Number(this.$('#prefix').value);
    const status = this.$('#status');

    const parts = address.split('.');
    const valid = parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) <= 255);
    if (!valid) {
      status.innerHTML = html`<span class="error">Enter a valid IPv4 address such as 10.0.0.1</span>`;
      return;
    }

    const value = toInt(address);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = (value & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const total = 2 ** (32 - prefix);
    const usable = prefix >= 31 ? (prefix === 32 ? 1 : 2) : total - 2;

    status.textContent = `${toAddress(network)}/${prefix} · ${isPrivate(value) ? 'private range' : 'public range'}`;

    this.$('#details').innerHTML = html`
      <div>Network address</div><div class="mono">${toAddress(network)}</div>
      <div>Broadcast</div><div class="mono">${toAddress(broadcast)}</div>
      <div>First host</div><div class="mono">${prefix >= 31 ? toAddress(network) : toAddress(network + 1)}</div>
      <div>Last host</div><div class="mono">${prefix >= 31 ? toAddress(broadcast) : toAddress(broadcast - 1)}</div>
      <div>Subnet mask</div><div class="mono">${toAddress(mask)}</div>
      <div>Wildcard mask</div><div class="mono">${toAddress(~mask >>> 0)}</div>
      <div>Total addresses</div><div class="mono">${total.toLocaleString()}</div>
      <div>Usable hosts</div><div class="mono">${usable.toLocaleString()}</div>
      <div>CIDR</div><div class="mono">${toAddress(network)}/${prefix}</div>
      <div>Range</div><div class="mono">${toAddress(network)} - ${toAddress(broadcast)}</div>
    `;

    const bits = toBinary(value).replace(/\./g, '');
    const netBits = bits.slice(0, prefix);
    const hostBits = bits.slice(prefix);
    const joined = [...netBits].map((bit) => `<span class="net">${bit}</span>`).concat([...hostBits].map((bit) => `<span class="host">${bit}</span>`));
    this.$('#binary').innerHTML = chunk(joined, 8).map((group) => group.join('')).join('<span class="muted">.</span>');

    const select = this.$('#split');
    select.options = Array.from({ length: Math.min(9, 32 - prefix + 1) }, (unused, index) => ({
      value: String(prefix + index),
      label: index === 0 ? 'No split' : `/${prefix + index} - ${2 ** index} subnets`,
    }));
    this.#split();
  }

  #split() {
    const address = this.$('#address').value.trim();
    const prefix = Number(this.$('#prefix').value);
    const target = Number(this.$('#split').value || prefix);
    const info = this.$('#splitinfo');
    const list = this.$('#subnets');

    if (!target || target <= prefix) {
      info.textContent = 'Pick a longer prefix to divide this network.';
      list.textContent = '';
      return;
    }

    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    const network = (toInt(address) & mask) >>> 0;
    const size = 2 ** (32 - target);
    const count = 2 ** (target - prefix);
    info.textContent = `${count} subnets of ${size.toLocaleString()} addresses`;

    list.textContent = Array.from({ length: Math.min(count, 64) }, (unused, index) => {
      const start = (network + index * size) >>> 0;
      const end = (start + size - 1) >>> 0;
      return `${toAddress(start)}/${target}  →  ${toAddress(start)} - ${toAddress(end)}`;
    }).join('\n') + (count > 64 ? `\n... ${count - 64} more` : '');
  }
}

define('jg-app-subnet', SubnetCalculator);
