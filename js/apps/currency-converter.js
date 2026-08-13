import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, toast } from '../core/util.js';

const sheet = css`
  .convert { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: end; }
  @media (max-width: 700px) { .convert { grid-template-columns: 1fr; } }
  .swap { align-self: center; }
  .result {
    display: grid;
    gap: 3px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--muted) 45%, transparent);
  }
  .result .big { font: 650 26px/1.15 var(--font-sans); letter-spacing: -0.02em; }
  .result .rate { font-family: var(--font-mono); font-size: 12px; color: var(--muted-foreground); }
  .table { display: grid; gap: 4px; }
  .line { display: grid; grid-template-columns: 62px 1fr auto; gap: 10px; align-items: center; font-size: 13px; }
  .line .code { font-family: var(--font-mono); color: var(--muted-foreground); }
  .line .amount { font-family: var(--font-mono); text-align: right; }
  .spark { height: 6px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  .spark i { display: block; height: 100%; background: color-mix(in srgb, var(--ring) 70%, transparent); }
`;

const SOURCE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies';

const NAMES = {
  usd: 'US dollar', eur: 'Euro', gbp: 'British pound', chf: 'Swiss franc', jpy: 'Japanese yen',
  cny: 'Chinese yuan', cad: 'Canadian dollar', aud: 'Australian dollar', nzd: 'New Zealand dollar',
  sek: 'Swedish krona', nok: 'Norwegian krone', dkk: 'Danish krone', pln: 'Polish zloty',
  czk: 'Czech koruna', huf: 'Hungarian forint', ron: 'Romanian leu', try: 'Turkish lira',
  rub: 'Russian ruble', uah: 'Ukrainian hryvnia', inr: 'Indian rupee', pkr: 'Pakistani rupee',
  bdt: 'Bangladeshi taka', idr: 'Indonesian rupiah', myr: 'Malaysian ringgit', sgd: 'Singapore dollar',
  thb: 'Thai baht', php: 'Philippine peso', krw: 'South Korean won', hkd: 'Hong Kong dollar',
  twd: 'Taiwan dollar', vnd: 'Vietnamese dong', aed: 'UAE dirham', sar: 'Saudi riyal',
  qar: 'Qatari riyal', kwd: 'Kuwaiti dinar', omr: 'Omani rial', ils: 'Israeli shekel',
  egp: 'Egyptian pound', zar: 'South African rand', ngn: 'Nigerian naira', kes: 'Kenyan shilling',
  mad: 'Moroccan dirham', brl: 'Brazilian real', mxn: 'Mexican peso', ars: 'Argentine peso',
  clp: 'Chilean peso', cop: 'Colombian peso', pen: 'Peruvian sol', isk: 'Icelandic krona',
  btc: 'Bitcoin', eth: 'Ethereum', xau: 'Gold ounce', xag: 'Silver ounce',
};

const POPULAR = ['usd', 'eur', 'gbp', 'chf', 'jpy', 'cad', 'aud', 'cny', 'inr', 'aed', 'sek', 'btc'];

const format = (value, code) => {
  if (!Number.isFinite(value)) return '-';
  if (['btc', 'eth', 'xau', 'xag'].includes(code)) return value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value.toFixed(Math.abs(value) < 1 ? 6 : 4).replace(/0+$/, '').replace(/\.$/, '');
};

class CurrencyConverter extends JGApp {
  static appId = 'currency-converter';
  static styles = [...JGApp.styles, sheet];

  #rates = null;
  #date = '';
  #base = 'eur';

  async renderApp() {
    const saved = this.store.read({ from: 'eur', to: 'usd', amount: 100, favourites: null });

    this.paint(html`<div class="app">
      <div class="convert">
        <jg-field label="From">
          <div class="row">
            <jg-input id="amount" type="number" step="any" value="${saved.amount}" style="flex:1"></jg-input>
            <jg-select id="from" value="${saved.from}" style="width:150px"></jg-select>
          </div>
        </jg-field>
        <jg-button class="swap" size="icon" variant="outline" id="swap" title="Swap">⇄</jg-button>
        <jg-field label="To">
          <div class="row">
            <jg-input id="converted" readonly style="flex:1"></jg-input>
            <jg-select id="to" value="${saved.to}" style="width:150px"></jg-select>
          </div>
        </jg-field>
      </div>

      <div class="result">
        <span class="big" id="headline">-</span>
        <span class="rate" id="rate"></span>
      </div>

      <div class="row">
        <jg-badge id="status" tone="muted">Loading rates</jg-badge>
        <span class="hint" id="stamp"></span>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="refresh">Refresh</jg-button>
        <jg-button size="sm" variant="ghost" id="copy">Copy</jg-button>
      </div>

      <jg-card title="At a glance" sub="The same amount in other currencies">
        <div class="table" id="table"></div>
      </jg-card>

      <div class="hint">
        Rates come from an open source dataset that mirrors daily central bank data. Values are indicative, not a
        dealing quote.
      </div>
    </div>`);

    this.on(this.$('#amount'), 'input', debounce(() => this.#paint(), 160));
    this.on(this.$('#from'), 'change', () => this.#reload());
    this.on(this.$('#to'), 'change', () => this.#paint());
    this.on(this.$('#swap'), 'click', () => {
      const from = this.$('#from').value;
      this.$('#from').value = this.$('#to').value;
      this.$('#to').value = from;
      this.#reload();
    });
    this.on(this.$('#refresh'), 'click', () => this.#reload(true));
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#headline').textContent));

    await this.#reload();
  }

  #options(codes) {
    const known = codes.filter((code) => NAMES[code]);
    const rest = codes.filter((code) => !NAMES[code]);
    return [...known, ...rest].map((code) => ({
      value: code,
      label: `${code.toUpperCase()}${NAMES[code] ? ` - ${NAMES[code]}` : ''}`,
    }));
  }

  async #reload(force = false) {
    const status = this.$('#status');
    const base = this.$('#from').value || 'eur';
    if (!force && this.#base === base && this.#rates) return this.#paint();

    status.setAttribute('tone', 'muted');
    status.textContent = 'Loading rates';

    try {
      const response = await fetch(`${SOURCE}/${base}.min.json`, { cache: force ? 'reload' : 'default' });
      if (!response.ok) throw new Error(`The rate service answered ${response.status}`);
      const data = await response.json();

      this.#rates = data[base] ?? {};
      this.#date = data.date ?? '';
      this.#base = base;

      const codes = Object.keys(this.#rates).sort();
      const from = this.$('#from');
      const to = this.$('#to');
      const currentTo = to.value;

      if (!from.options.length) {
        from.options = this.#options([base, ...codes].filter((code, index, list) => list.indexOf(code) === index));
      }
      from.value = base;
      to.options = this.#options(codes);
      to.value = codes.includes(currentTo) ? currentTo : 'usd';

      status.setAttribute('tone', 'success');
      status.textContent = `${codes.length} currencies`;
      this.$('#stamp').textContent = this.#date ? `Rates for ${this.#date}` : '';
      this.#paint();
    } catch (error) {
      status.setAttribute('tone', 'danger');
      status.textContent = 'Rates unavailable';
      this.$('#stamp').textContent = error.message;
      toast(error.message, 'error');
    }
    return undefined;
  }

  #paint() {
    if (!this.#rates) return;

    const amount = Number(this.$('#amount').value) || 0;
    const from = this.$('#from').value;
    const to = this.$('#to').value;
    const rate = this.#rates[to];

    if (!Number.isFinite(rate)) {
      this.$('#headline').textContent = '-';
      return;
    }

    const value = amount * rate;
    this.$('#converted').value = format(value, to);
    this.$('#headline').textContent = `${format(amount, from)} ${from.toUpperCase()} = ${format(value, to)} ${to.toUpperCase()}`;
    this.$('#rate').textContent = `1 ${from.toUpperCase()} = ${format(rate, to)} ${to.toUpperCase()} - 1 ${to.toUpperCase()} = ${format(1 / rate, from)} ${from.toUpperCase()}`;

    this.store.write({ from, to, amount });

    const others = POPULAR.filter((code) => code !== from && this.#rates[code]);
    const peak = Math.max(...others.map((code) => amount * this.#rates[code]));

    this.$('#table').innerHTML = others
      .map((code) => {
        const converted = amount * this.#rates[code];
        return html`<div class="line">
          <span class="code">${code.toUpperCase()}</span>
          <span class="spark"><i style="width:${peak ? Math.max(2, (converted / peak) * 100).toFixed(1) : 0}%"></i></span>
          <span class="amount">${format(converted, code)}</span>
        </div>`;
      })
      .join('');
  }
}

define('jg-app-currency-converter', CurrencyConverter);
