import { JGApp, define, html, css } from '../core/app.js';
import { copyText, randomBytes, toHex } from '../core/util.js';

const sheet = css`
  .list { font-family: var(--font-mono); font-size: 12.5px; line-height: 1.9; user-select: all; }
  .widget { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 0 12px 12px; }
  .widget .value { font-family: var(--font-mono); font-size: 11px; overflow-wrap: anywhere; color: var(--muted-foreground); }
`;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const uuidV4 = () => crypto.randomUUID();

const uuidV7 = () => {
  const bytes = randomBytes(16);
  const stamp = Date.now();
  bytes[0] = (stamp / 2 ** 40) & 0xff;
  bytes[1] = (stamp / 2 ** 32) & 0xff;
  bytes[2] = (stamp / 2 ** 24) & 0xff;
  bytes[3] = (stamp / 2 ** 16) & 0xff;
  bytes[4] = (stamp / 2 ** 8) & 0xff;
  bytes[5] = stamp & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const ulid = () => {
  let time = Date.now();
  let stamp = '';
  for (let i = 0; i < 10; i += 1) {
    stamp = CROCKFORD[time % 32] + stamp;
    time = Math.floor(time / 32);
  }
  const random = [...randomBytes(16)].slice(0, 16).map((byte) => CROCKFORD[byte % 32]).join('');
  return stamp + random;
};

const GENERATORS = {
  v4: uuidV4,
  v7: uuidV7,
  nil: () => '00000000-0000-0000-0000-000000000000',
  ulid,
  short: () => toHex(randomBytes(8)),
};

class UuidGenerator extends JGApp {
  static appId = 'uuid-generator';
  static styles = [...JGApp.styles, sheet];

  #values = [];

  renderWidget() {
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div class="value" id="value">${uuidV4()}</div>
        <div class="row tight">
          <jg-button size="sm" id="new" class="grow">New</jg-button>
          <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
        </div>
      </div>
    </div>`);
    this.on(this.$('#new'), 'click', () => {
      this.$('#value').textContent = uuidV4();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#value').textContent));
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="kind"></jg-tabs>
        <span class="grow"></span>
        <jg-input id="count" type="number" min="1" max="500" value="5" suffix="qty" style="width:110px"></jg-input>
        <jg-button id="generate">Generate</jg-button>
      </div>

      <div class="row">
        <jg-switch id="upper"></jg-switch><span class="hint">Uppercase</span>
        <jg-switch id="braces"></jg-switch><span class="hint">Wrap in braces</span>
        <jg-switch id="dashes" checked></jg-switch><span class="hint">Keep dashes</span>
      </div>

      <jg-field label="Output" grow>
        <div slot="action" class="row tight">
          <jg-button size="sm" variant="outline" id="copy">Copy all</jg-button>
        </div>
        <pre class="code tall scroll list" id="out"></pre>
      </jg-field>

      <div class="hint" id="about"></div>
    </div>`);

    this.$('#kind').items = [
      { value: 'v4', label: 'UUID v4' },
      { value: 'v7', label: 'UUID v7' },
      { value: 'ulid', label: 'ULID' },
      { value: 'short', label: 'Short ID' },
      { value: 'nil', label: 'Nil' },
    ];

    ['#kind', '#upper', '#braces', '#dashes'].forEach((selector) =>
      this.on(this.$(selector), 'change', () => this.#run()),
    );
    this.on(this.$('#generate'), 'click', () => this.#run());
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').textContent));
    this.#run();
  }

  #run() {
    const kind = this.$('#kind').value;
    const count = Math.min(500, Math.max(1, Number(this.$('#count').value) || 1));
    const generate = GENERATORS[kind];
    this.#values = Array.from({ length: count }, generate);

    const upper = this.$('#upper').checked;
    const braces = this.$('#braces').checked;
    const dashes = this.$('#dashes').checked;

    const formatted = this.#values.map((value) => {
      let out = dashes ? value : value.replace(/-/g, '');
      out = upper ? out.toUpperCase() : out.toLowerCase();
      return braces ? `{${out}}` : out;
    });

    this.$('#out').textContent = formatted.join('\n');
    this.$('#about').textContent = {
      v4: 'Version 4 - 122 bits of randomness, the safe default for most identifiers.',
      v7: 'Version 7 - millisecond timestamp prefix, so ids sort chronologically and index well.',
      ulid: 'ULID - 26 character Crockford base32, lexicographically sortable and URL safe.',
      short: 'Short ID - 64 bits of hex, compact but only suitable for low-volume ids.',
      nil: 'The nil UUID, used as a placeholder for "no value".',
    }[kind];
  }
}

define('jg-app-uuid', UuidGenerator);
