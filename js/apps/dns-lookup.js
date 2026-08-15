import { JGApp, define, html, css } from '../core/app.js';
import { copyText } from '../core/util.js';

const sheet = css`
  .app { gap: 12px; }
  .types { display: flex; flex-wrap: wrap; gap: 4px; }
  .type {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted-foreground);
    font: 600 11.5px/1 var(--font-mono);
    padding: 6px 10px;
    cursor: pointer;
  }
  .type:hover { color: var(--foreground); border-color: var(--border-strong); }
  .type[aria-pressed="true"] {
    color: var(--foreground);
    background: color-mix(in srgb, var(--ring) 16%, transparent);
    border-color: color-mix(in srgb, var(--ring) 50%, transparent);
  }
  .group { margin-bottom: 14px; }
  .group h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { font-family: var(--font-mono); overflow-wrap: anywhere; vertical-align: top; }
  td.name { color: var(--ring); }
  td.ttl { color: var(--muted-foreground); white-space: nowrap; width: 90px; }
  .flags { display: flex; gap: 6px; flex-wrap: wrap; }
  .empty-type { font-size: 12px; color: var(--muted-foreground); padding: 4px 0 8px; }
`;

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'CAA', 'PTR', 'DNSKEY', 'DS'];
const DEFAULT_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];

const RESOLVERS = {
  cloudflare: { label: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
  google: { label: 'Google', url: 'https://dns.google/resolve' },
};

const CODES = {
  0: 'NOERROR',
  1: 'FORMERR',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
  4: 'NOTIMP',
  5: 'REFUSED',
};

const NUMERIC_TYPES = {
  1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA',
  33: 'SRV', 43: 'DS', 48: 'DNSKEY', 257: 'CAA',
};

const isIpv4 = (value) => /^\d{1,3}(\.\d{1,3}){3}$/.test(value);
const isIpv6 = (value) => /^[0-9a-f:]+$/i.test(value) && value.includes(':');

const reverseName = (value) => {
  if (isIpv4(value)) return `${value.split('.').reverse().join('.')}.in-addr.arpa`;
  if (isIpv6(value)) {
    const parts = value.split('::');
    const head = parts[0] ? parts[0].split(':') : [];
    const tail = parts[1] ? parts[1].split(':') : [];
    const fill = Array.from({ length: 8 - head.length - tail.length }, () => '0');
    const groups = [...head, ...fill, ...tail].map((group) => group.padStart(4, '0'));
    return `${groups.join('').split('').reverse().join('.')}.ip6.arpa`;
  }
  return value;
};

class DnsLookup extends JGApp {
  static appId = 'dns-lookup';
  static settings = [
    { key: 'resolver', label: 'Resolver', type: 'select', default: 'cloudflare', options: [
      { value: 'cloudflare', label: 'Cloudflare' },
      { value: 'google', label: 'Google' },
    ] },
  ];
  static styles = [...JGApp.styles, sheet];

  #selected = new Set(DEFAULT_TYPES);
  #results = [];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Domain or IP address" hint="An IP address is looked up as a reverse PTR record">
        <div class="row nowrap">
          <jg-input id="query" class="grow" mono placeholder="example.com" value="jsglobe.com"></jg-input>
          <jg-select id="resolver" value="${this.config.get('resolver', 'cloudflare')}" style="width:150px">
            ${Object.entries(RESOLVERS).map(([key, item]) => html`<option value="${key}">${item.label}</option>`)}
          </jg-select>
          <jg-button id="run">Look up</jg-button>
        </div>
      </jg-field>

      <div class="types" id="types">
        ${TYPES.map((type) => html`<button class="type" data-type="${type}" aria-pressed="${String(this.#selected.has(type))}">${type}</button>`)}
      </div>

      <div class="row">
        <jg-button size="sm" variant="ghost" id="common">Common</jg-button>
        <jg-button size="sm" variant="ghost" id="all">All types</jg-button>
        <span class="grow"></span>
        <span class="flags" id="flags"></span>
        <jg-button size="sm" variant="outline" id="copy">Copy results</jg-button>
      </div>

      <div id="results"></div>

      <div class="hint">
        Queries run over DNS-over-HTTPS from this browser, so results reflect what the chosen public resolver sees
        rather than your local DNS.
      </div>
    </div>`);

    this.on(this.$('#run'), 'click', () => this.#run());
    this.on(this.$('#query'), 'keydown', (event) => {
      if (event.key === 'Enter') this.#run();
    });
    this.on(this.$('#resolver'), 'change', (event) => this.config.set('resolver', event.detail.value));
    this.on(this.$('#copy'), 'click', () => copyText(this.#asText()));

    this.bind('[data-type]', 'click', (event) => {
      const type = event.currentTarget.dataset.type;
      if (this.#selected.has(type)) this.#selected.delete(type);
      else this.#selected.add(type);
      event.currentTarget.setAttribute('aria-pressed', String(this.#selected.has(type)));
    });

    this.on(this.$('#common'), 'click', () => {
      this.#selected = new Set(DEFAULT_TYPES);
      this.#paintTypes();
    });
    this.on(this.$('#all'), 'click', () => {
      this.#selected = new Set(TYPES);
      this.#paintTypes();
    });

    this.$('#results').innerHTML = html`<jg-empty glyph="⌕" title="No lookup yet">Enter a domain and choose the record types you care about.</jg-empty>`;
  }

  #paintTypes() {
    this.$$('[data-type]').forEach((node) => node.setAttribute('aria-pressed', String(this.#selected.has(node.dataset.type))));
  }

  async #run() {
    const raw = this.$('#query').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!raw) return;

    const results = this.$('#results');
    const flags = this.$('#flags');
    flags.innerHTML = '';

    const reverse = isIpv4(raw) || isIpv6(raw);
    const name = reverse ? reverseName(raw) : raw;
    const types = reverse ? ['PTR'] : [...this.#selected];

    if (!types.length) {
      results.innerHTML = html`<jg-empty glyph="⌕" title="No record types selected">Pick at least one type above.</jg-empty>`;
      return;
    }

    results.innerHTML = html`<div class="hint">Looking up ${name}...</div>`;
    const base = RESOLVERS[this.$('#resolver').value].url;

    const answers = await Promise.all(
      types.map(async (type) => {
        try {
          const response = await fetch(`${base}?name=${encodeURIComponent(name)}&type=${type}`, {
            headers: { accept: 'application/dns-json' },
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return { type, data: await response.json() };
        } catch (error) {
          return { type, error: error.message };
        }
      }),
    );

    this.#results = answers;

    const status = answers.find((answer) => answer.data)?.data;
    if (status) {
      flags.innerHTML = [
        html`<jg-badge tone="${status.Status === 0 ? 'success' : 'danger'}">${CODES[status.Status] ?? `RCODE ${status.Status}`}</jg-badge>`,
        status.AD ? html`<jg-badge tone="accent">DNSSEC verified</jg-badge>` : '',
        status.TC ? html`<jg-badge tone="warning">truncated</jg-badge>` : '',
      ].join('');
    }

    results.innerHTML = answers
      .map((answer) => {
        const records = (answer.data?.Answer ?? []).filter(
          (record) => (NUMERIC_TYPES[record.type] ?? String(record.type)) === answer.type,
        );
        const authority = answer.data?.Authority ?? [];

        if (answer.error) {
          return html`<div class="group"><h3>${answer.type}</h3><div class="error">${answer.error}</div></div>`;
        }

        if (!records.length) {
          return html`<div class="group">
            <h3>${answer.type}</h3>
            <div class="empty-type">
              ${authority.length ? `No ${answer.type} records. Authority: ${authority[0].data}` : `No ${answer.type} records.`}
            </div>
          </div>`;
        }

        return html`<div class="group">
          <h3>${answer.type} <jg-badge>${records.length}</jg-badge></h3>
          <table>
            <thead><tr><th>Name</th><th>TTL</th><th>Value</th></tr></thead>
            <tbody>
              ${records.map(
                (record) => html`<tr>
                  <td class="name">${record.name}</td>
                  <td class="ttl">${record.TTL}s</td>
                  <td>${record.data}</td>
                </tr>`,
              )}
            </tbody>
          </table>
        </div>`;
      })
      .join('');
  }

  #asText() {
    return this.#results
      .flatMap((answer) =>
        (answer.data?.Answer ?? []).map(
          (record) => `${record.name}\t${record.TTL}\tIN\t${NUMERIC_TYPES[record.type] ?? record.type}\t${record.data}`,
        ),
      )
      .join('\n');
  }
}

define('jg-app-dns-lookup', DnsLookup);
