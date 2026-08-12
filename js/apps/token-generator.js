import { JGApp, define, html, css } from '../core/app.js';
import { copyText, randomInt, shuffle } from '../core/util.js';

const sheet = css`
  .value {
    font-family: var(--font-mono);
    font-size: 15px;
    line-height: 1.6;
    overflow-wrap: anywhere;
    user-select: all;
    min-height: 52px;
  }
  .meter { height: 6px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  .meter i { display: block; height: 100%; transition: width 0.25s ease, background 0.25s ease; }
  .widget { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 0 12px 12px; }
  .widget .value { font-size: 11.5px; min-height: 0; flex: 1; color: var(--muted-foreground); }
`;

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/',
};

const AMBIGUOUS = /[Il1O0o]/g;

const strength = (bits) => {
  if (bits < 40) return { label: 'Weak', color: 'var(--destructive)', ratio: 0.25 };
  if (bits < 64) return { label: 'Fair', color: 'var(--warning)', ratio: 0.5 };
  if (bits < 96) return { label: 'Strong', color: 'var(--success)', ratio: 0.75 };
  return { label: 'Excellent', color: 'var(--success)', ratio: 1 };
};

const build = ({ length, sets, avoidAmbiguous }) => {
  let alphabet = sets.map((key) => SETS[key]).join('');
  if (avoidAmbiguous) alphabet = alphabet.replace(AMBIGUOUS, '');
  if (!alphabet) return { value: '', bits: 0 };
  const required = sets
    .map((key) => (avoidAmbiguous ? SETS[key].replace(AMBIGUOUS, '') : SETS[key]))
    .filter(Boolean)
    .map((pool) => pool[randomInt(pool.length)]);
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () => alphabet[randomInt(alphabet.length)]);
  return {
    value: shuffle([...required, ...rest]).join('').slice(0, length),
    bits: Math.round(length * Math.log2(alphabet.length)),
  };
};

class TokenGenerator extends JGApp {
  static appId = 'token-generator';
  static styles = [...JGApp.styles, sheet];

  renderWidget() {
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div class="value" id="value"></div>
        <div class="row tight">
          <jg-button size="sm" id="new" class="grow">Generate</jg-button>
          <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
        </div>
      </div>
    </div>`);
    const make = () => {
      this.$('#value').textContent = build({
        length: this.config.get('length', 32),
        sets: ['lower', 'upper', 'digits', ...(this.config.get('symbols', true) ? ['symbols'] : [])],
        avoidAmbiguous: false,
      }).value;
    };
    make();
    this.on(this.$('#new'), 'click', make);
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#value').textContent));
  }

  renderApp() {
    const length = this.config.get('length', 32);
    this.paint(html`<div class="app">
      <jg-card title="Generated token" sub="Created with crypto.getRandomValues in this tab">
        <div slot="action" class="row tight">
          <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
          <jg-button size="sm" id="new">Regenerate</jg-button>
        </div>
        <div class="value" id="value"></div>
        <div class="meter"><i id="bar"></i></div>
        <div class="spread">
          <span class="hint" id="entropy"></span>
          <jg-badge id="verdict">-</jg-badge>
        </div>
      </jg-card>

      <jg-card title="Options">
        <jg-field label="Length" row>
          <jg-slider id="length" min="6" max="128" value="${length}" style="width:220px"></jg-slider>
        </jg-field>
        <div class="row">
          <jg-switch id="lower" checked></jg-switch><span class="hint">a-z</span>
          <jg-switch id="upper" checked></jg-switch><span class="hint">A-Z</span>
          <jg-switch id="digits" checked></jg-switch><span class="hint">0-9</span>
          <jg-switch id="symbols" ${this.config.get('symbols', true) ? 'checked' : ''}></jg-switch><span class="hint">symbols</span>
          <jg-switch id="ambiguous"></jg-switch><span class="hint">avoid look-alikes</span>
        </div>
      </jg-card>

      <jg-card title="Batch" sub="Generate several at once">
        <div class="row nowrap">
          <jg-input id="count" type="number" min="1" max="100" value="8" suffix="qty" style="width:120px"></jg-input>
          <jg-button variant="secondary" id="batch">Generate batch</jg-button>
          <jg-button variant="ghost" size="sm" id="copybatch">Copy batch</jg-button>
        </div>
        <pre class="code scroll" id="list" style="max-height:180px"></pre>
      </jg-card>
    </div>`);

    ['#lower', '#upper', '#digits', '#symbols', '#ambiguous'].forEach((selector) =>
      this.on(this.$(selector), 'change', () => this.#run()),
    );
    this.on(this.$('#length'), 'input', () => this.#run());
    this.on(this.$('#length'), 'change', () => this.config.set('length', this.$('#length').value));
    this.on(this.$('#symbols'), 'change', (event) => this.config.set('symbols', event.detail.checked));
    this.on(this.$('#new'), 'click', () => this.#run());
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#value').textContent));
    this.on(this.$('#batch'), 'click', () => this.#batch());
    this.on(this.$('#copybatch'), 'click', () => copyText(this.$('#list').textContent));
    this.#run();
  }

  #options() {
    const sets = ['lower', 'upper', 'digits', 'symbols'].filter((key) => this.$(`#${key}`).checked);
    return {
      length: Number(this.$('#length').value),
      sets: sets.length ? sets : ['lower'],
      avoidAmbiguous: this.$('#ambiguous').checked,
    };
  }

  #run() {
    const { value, bits } = build(this.#options());
    const grade = strength(bits);
    this.$('#value').textContent = value;
    this.$('#entropy').textContent = `${bits} bits of entropy · ${value.length} characters`;
    this.$('#verdict').textContent = grade.label;
    const bar = this.$('#bar');
    bar.style.width = `${grade.ratio * 100}%`;
    bar.style.background = grade.color;
  }

  #batch() {
    const count = Math.min(100, Math.max(1, Number(this.$('#count').value) || 1));
    const options = this.#options();
    this.$('#list').textContent = Array.from({ length: count }, () => build(options).value).join('\n');
  }
}

define('jg-app-token', TokenGenerator);
