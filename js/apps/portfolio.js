import { JGApp, define, html, css } from '../core/app.js';
import { uid, download, toast, pickFile } from '../core/util.js';

const sheet = css`
  .app { gap: 12px; }
  .totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
  .total {
    display: grid;
    gap: 2px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
  }
  .total .n { font: 700 20px/1.15 var(--font-sans); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .total .l { font-size: 11.5px; color: var(--muted-foreground); }
  .up { color: var(--success); }
  .down { color: var(--destructive); }

  .charts { display: grid; grid-template-columns: minmax(0, 240px) minmax(0, 1fr); gap: 14px; align-items: center; }
  @media (max-width: 760px) { .charts { grid-template-columns: 1fr; } }
  .donut { display: grid; place-items: center; position: relative; }
  .donut svg { transform: rotate(-90deg); }
  .donut .middle {
    position: absolute;
    display: grid;
    justify-items: center;
    gap: 1px;
    text-align: center;
  }
  .donut .middle .v { font: 700 17px/1.1 var(--font-sans); font-variant-numeric: tabular-nums; }
  .donut .middle .k { font-size: 10.5px; color: var(--muted-foreground); }

  .bars { display: flex; flex-direction: column; gap: 6px; }
  .bar { display: grid; grid-template-columns: 82px 1fr 96px; gap: 10px; align-items: center; font-size: 12px; }
  .bar .sym { font-family: var(--font-mono); font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
  .bar .track { position: relative; height: 16px; border-radius: 5px; background: color-mix(in srgb, var(--muted) 70%, transparent); overflow: hidden; }
  .bar .track i { position: absolute; top: 0; bottom: 0; border-radius: 4px; }
  .bar .val { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }

  .history { width: 100%; height: 92px; display: block; }

  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
  td { font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.sym { font-family: var(--font-mono); font-weight: 600; }
  td.name { white-space: normal; color: var(--muted-foreground); font-size: 11.5px; }
  th.right, td.right { text-align: right; }
  .row-acts { display: flex; gap: 2px; justify-content: flex-end; opacity: 0; }
  tbody tr:hover .row-acts { opacity: 1; }
  .dotmark { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 6px; }

  .form { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; align-items: end; }
`;

const PALETTE = ['#8a1c3b', '#3f6b91', '#4a7a58', '#96703f', '#5b5b8a', '#3f7a75', '#875a6b', '#847a44', '#9c6440', '#5b6470'];

const PROVIDERS = {
  manual: { label: 'Manual prices' },
  coingecko: {
    label: 'CoinGecko',
    note: 'Free public API, no account. Use CoinGecko ids such as bitcoin or ethereum.',
    async quotes(symbols, currency) {
      const ids = symbols.map((symbol) => symbol.toLowerCase()).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${currency.toLowerCase()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return Object.fromEntries(
        symbols
          .map((symbol) => [symbol, Number(data?.[symbol.toLowerCase()]?.[currency.toLowerCase()])])
          .filter(([, price]) => Number.isFinite(price) && price > 0),
      );
    },
  },
  currency: {
    label: 'Currency rates',
    note: 'Open source exchange rate data. Use currency or crypto tickers such as USD, CHF or BTC.',
    async quotes(symbols, currency) {
      const base = currency.toLowerCase();
      const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.min.json`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rates = (await response.json())[base] ?? {};
      return Object.fromEntries(
        symbols
          .map((symbol) => [symbol, 1 / Number(rates[symbol.toLowerCase()])])
          .filter(([, price]) => Number.isFinite(price) && price > 0),
      );
    },
  },
};

const money = (value, currency) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);

const percent = (value) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

class Portfolio extends JGApp {
  static appId = 'portfolio';
  static styles = [...JGApp.styles, sheet];

  #editing = null;

  #data() {
    return this.store.read({ positions: [], history: [] });
  }

  #save(next) {
    this.store.write(next);
  }

  #currency() {
    return this.config.get('currency', 'USD');
  }

  #rows() {
    return this.#data().positions.map((position, index) => {
      const cost = position.quantity * position.cost;
      const value = position.quantity * position.price;
      const profit = value - cost;
      return {
        ...position,
        cost,
        value,
        profit,
        ratio: cost ? profit / cost : 0,
        colour: PALETTE[index % PALETTE.length],
      };
    });
  }

  renderWidget() {
    const rows = this.#rows();
    const value = rows.reduce((total, row) => total + row.value, 0);
    const profit = rows.reduce((total, row) => total + row.profit, 0);
    const cost = rows.reduce((total, row) => total + row.cost, 0);

    this.paint(html`<div class="app" style="padding:12px">
      <div class="label">Portfolio</div>
      <div class="total" style="border:0;padding:0;background:none">
        <span class="n">${money(value, this.#currency())}</span>
        <span class="l ${profit >= 0 ? 'up' : 'down'}">
          ${profit >= 0 ? '+' : ''}${money(profit, this.#currency())} ${cost ? `(${percent(profit / cost)})` : ''}
        </span>
      </div>
      <div class="hint">${rows.length} position${rows.length === 1 ? '' : 's'}</div>
    </div>`);
  }

  renderApp() {
    const provider = this.config.get('provider', 'manual');

    this.paint(html`<div class="app">
      <div class="row">
        <jg-select id="provider" value="${provider}" size="sm" style="width:180px">
          ${Object.entries(PROVIDERS).map(([key, item]) => html`<option value="${key}">${item.label}</option>`)}
        </jg-select>
        <jg-button size="sm" variant="outline" id="refresh" ${provider === 'manual' ? 'hidden' : ''}>Refresh prices</jg-button>
        <span class="grow"></span>
        <jg-select id="currency" value="${this.#currency()}" size="sm" style="width:110px">
          ${['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'AED'].map((code) => html`<option value="${code}">${code}</option>`)}
        </jg-select>
        <jg-button size="sm" variant="ghost" id="export">Export</jg-button>
        <jg-button size="sm" variant="ghost" id="import">Import</jg-button>
      </div>

      <div class="totals" id="totals"></div>

      <jg-card title="Allocation and result">
        <div class="charts">
          <div class="donut" id="donut"></div>
          <div class="bars" id="bars"></div>
        </div>
      </jg-card>

      <jg-card title="Value over time" sub="A snapshot is kept each day you update prices">
        <svg class="history" id="history" preserveAspectRatio="none"></svg>
      </jg-card>

      <jg-card title="Positions">
        <div class="form">
          <jg-field label="Symbol"><jg-input id="f-symbol" mono placeholder="AAPL"></jg-input></jg-field>
          <jg-field label="Name"><jg-input id="f-name" placeholder="Apple"></jg-input></jg-field>
          <jg-field label="Quantity"><jg-input id="f-qty" type="number" step="any" value=""></jg-input></jg-field>
          <jg-field label="Average cost"><jg-input id="f-cost" type="number" step="any" value=""></jg-input></jg-field>
          <jg-field label="Current price"><jg-input id="f-price" type="number" step="any" value=""></jg-input></jg-field>
          <jg-button id="add">Add</jg-button>
        </div>

        <div style="overflow:auto">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th class="right">Qty</th>
                <th class="right">Cost</th>
                <th class="right">Price</th>
                <th class="right">Value</th>
                <th class="right">P&L</th>
                <th class="right">Return</th>
                <th class="right">Weight</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="rows"></tbody>
          </table>
        </div>
      </jg-card>

      <div class="hint" id="status">
        ${PROVIDERS[provider].note ?? 'Prices are whatever you enter. Nothing about this portfolio leaves the device.'}
      </div>
    </div>`);

    this.on(this.$('#provider'), 'change', (event) => {
      this.config.set('provider', event.detail.value);
      this.refresh();
    });
    this.on(this.$('#currency'), 'change', (event) => {
      this.config.set('currency', event.detail.value);
      this.#paint();
    });
    this.on(this.$('#refresh'), 'click', () => this.#refreshPrices());
    this.on(this.$('#add'), 'click', () => this.#add());
    this.on(this.$('#f-symbol'), 'keydown', (event) => {
      if (event.key === 'Enter') this.#add();
    });
    this.on(this.$('#export'), 'click', () => this.#export());
    this.on(this.$('#import'), 'click', () => this.#import());

    this.#paint();
  }

  #add() {
    const symbol = this.$('#f-symbol').value.trim().toUpperCase();
    const quantity = Number(this.$('#f-qty').value);
    const cost = Number(this.$('#f-cost').value);
    const price = Number(this.$('#f-price').value) || cost;

    if (!symbol || !quantity) {
      toast('A symbol and quantity are required', 'error');
      return;
    }

    const data = this.#data();
    const position = {
      id: this.#editing ?? uid().slice(0, 8),
      symbol,
      name: this.$('#f-name').value.trim(),
      quantity,
      cost,
      price,
    };

    data.positions = this.#editing
      ? data.positions.map((item) => (item.id === this.#editing ? position : item))
      : [...data.positions, position];

    this.#editing = null;
    this.#save(data);
    ['#f-symbol', '#f-name', '#f-qty', '#f-cost', '#f-price'].forEach((selector) => {
      this.$(selector).value = '';
    });
    this.$('#add').textContent = 'Add';
    this.#snapshot();
    this.#paint();
  }

  #snapshot() {
    const data = this.#data();
    const value = this.#rows().reduce((total, row) => total + row.value, 0);
    const today = new Date().toISOString().slice(0, 10);
    const history = data.history.filter((point) => point.date !== today);
    data.history = [...history, { date: today, value }].slice(-180);
    this.#save(data);
  }

  async #refreshPrices() {
    const provider = PROVIDERS[this.config.get('provider', 'manual')];
    if (!provider.quotes) return;

    const status = this.$('#status');
    const data = this.#data();
    if (!data.positions.length) {
      toast('Add a position first', 'error');
      return;
    }

    status.textContent = 'Fetching prices...';

    let quotes = null;
    try {
      quotes = await provider.quotes(data.positions.map((position) => position.symbol), this.#currency());
    } catch {
      status.textContent = `${provider.label} could not be reached.`;
      return;
    }

    const updated = data.positions.filter((position) => {
      const price = quotes[position.symbol];
      if (!price) return false;
      position.price = price;
      return true;
    }).length;

    this.#save(data);
    this.#snapshot();
    this.#paint();
    status.textContent = updated
      ? `Updated ${updated} of ${data.positions.length} positions from ${provider.label}.`
      : `${provider.label} returned no prices. Check the symbol format.`;
  }

  #paint() {
    const rows = this.#rows();
    const currency = this.#currency();
    const cost = rows.reduce((total, row) => total + row.cost, 0);
    const value = rows.reduce((total, row) => total + row.value, 0);
    const profit = value - cost;

    this.$('#totals').innerHTML = html`
      <div class="total"><span class="n">${money(value, currency)}</span><span class="l">Market value</span></div>
      <div class="total"><span class="n">${money(cost, currency)}</span><span class="l">Invested</span></div>
      <div class="total">
        <span class="n ${profit >= 0 ? 'up' : 'down'}">${profit >= 0 ? '+' : ''}${money(profit, currency)}</span>
        <span class="l">Profit and loss</span>
      </div>
      <div class="total">
        <span class="n ${profit >= 0 ? 'up' : 'down'}">${cost ? percent(profit / cost) : '-'}</span>
        <span class="l">Total return</span>
      </div>
      <div class="total"><span class="n">${rows.length}</span><span class="l">Positions</span></div>
    `;

    this.#paintDonut(rows, value, currency);
    this.#paintBars(rows, currency);
    this.#paintHistory();
    this.#paintRows(rows, value, currency);
  }

  #paintDonut(rows, total, currency) {
    const node = this.$('#donut');
    if (!rows.length || !total) {
      node.innerHTML = html`<span class="hint">Add a position to see the split.</span>`;
      return;
    }

    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    node.innerHTML = html`
      <svg width="180" height="180" viewBox="0 0 180 180">
        ${rows.map((row) => {
          const fraction = row.value / total;
          const dash = fraction * circumference;
          const segment = html`<circle
            cx="90" cy="90" r="${radius}"
            fill="none"
            stroke="${row.colour}"
            stroke-width="24"
            stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
            stroke-dashoffset="${(-offset).toFixed(2)}"
          ><title>${row.symbol} ${(fraction * 100).toFixed(1)}%</title></circle>`;
          offset += dash;
          return segment;
        })}
      </svg>
      <span class="middle">
        <span class="v">${money(total, currency)}</span>
        <span class="k">${rows.length} holdings</span>
      </span>
    `;
  }

  #paintBars(rows, currency) {
    const node = this.$('#bars');
    if (!rows.length) {
      node.innerHTML = html`<span class="hint">Profit and loss per position appears here.</span>`;
      return;
    }

    const peak = Math.max(...rows.map((row) => Math.abs(row.profit)), 1);

    node.innerHTML = rows
      .map((row) => {
        const width = (Math.abs(row.profit) / peak) * 50;
        const positive = row.profit >= 0;
        return html`<div class="bar">
          <span class="sym"><i class="dotmark" style="background:${row.colour}"></i>${row.symbol}</span>
          <span class="track">
            <i style="
              ${positive ? `left:50%;width:${width}%;background:var(--success)` : `right:50%;width:${width}%;background:var(--destructive)`}
            "></i>
          </span>
          <span class="val ${positive ? 'up' : 'down'}">${positive ? '+' : ''}${money(row.profit, currency)}</span>
        </div>`;
      })
      .join('');
  }

  #paintHistory() {
    const history = this.#data().history;
    const svg = this.$('#history');
    if (history.length < 2) {
      svg.innerHTML = html`<text x="8" y="50" fill="var(--muted-foreground)" font-size="12">Snapshots appear once you update prices on more than one day.</text>`;
      return;
    }

    const width = 600;
    const height = 92;
    const values = history.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    const points = history.map((point, index) => {
      const x = (index / (history.length - 1)) * width;
      const y = height - 10 - ((point.value - min) / span) * (height - 22);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const rising = values.at(-1) >= values[0];
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = html`
      <polyline
        points="${points.join(' ')}"
        fill="none"
        stroke="${rising ? 'var(--success)' : 'var(--destructive)'}"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
      <polygon
        points="0,${height} ${points.join(' ')} ${width},${height}"
        fill="${rising ? 'var(--success)' : 'var(--destructive)'}"
        opacity="0.12"
      />
    `;
  }

  #paintRows(rows, total, currency) {
    const body = this.$('#rows');
    if (!rows.length) {
      body.innerHTML = html`<tr><td colspan="9" class="hint" style="padding:14px 0">No positions yet.</td></tr>`;
      return;
    }

    body.innerHTML = rows
      .map(
        (row) => html`<tr>
          <td class="sym"><i class="dotmark" style="background:${row.colour}"></i>${row.symbol}<div class="name">${row.name}</div></td>
          <td class="right">${row.quantity}</td>
          <td class="right">${money(row.cost / (row.quantity || 1), currency)}</td>
          <td class="right">${money(row.price, currency)}</td>
          <td class="right">${money(row.value, currency)}</td>
          <td class="right ${row.profit >= 0 ? 'up' : 'down'}">${row.profit >= 0 ? '+' : ''}${money(row.profit, currency)}</td>
          <td class="right ${row.profit >= 0 ? 'up' : 'down'}">${percent(row.ratio)}</td>
          <td class="right">${total ? ((row.value / total) * 100).toFixed(1) : '0.0'}%</td>
          <td>
            <span class="row-acts">
              <jg-button size="icon-sm" variant="ghost" data-edit="${row.id}" title="Edit">✎</jg-button>
              <jg-button size="icon-sm" variant="ghost" data-del="${row.id}" title="Remove">✕</jg-button>
            </span>
          </td>
        </tr>`,
      )
      .join('');

    this.bind('[data-edit]', 'click', (event) => {
      const row = rows.find((item) => item.id === event.currentTarget.dataset.edit);
      this.#editing = row.id;
      this.$('#f-symbol').value = row.symbol;
      this.$('#f-name').value = row.name;
      this.$('#f-qty').value = row.quantity;
      this.$('#f-cost').value = row.cost / (row.quantity || 1);
      this.$('#f-price').value = row.price;
      this.$('#add').textContent = 'Save';
    });

    this.bind('[data-del]', 'click', (event) => {
      const data = this.#data();
      data.positions = data.positions.filter((item) => item.id !== event.currentTarget.dataset.del);
      this.#save(data);
      this.#paint();
    });
  }

  #export() {
    const rows = this.#rows();
    const csv = [
      'symbol,name,quantity,average_cost,price,value,profit',
      ...rows.map((row) =>
        [row.symbol, `"${row.name}"`, row.quantity, row.cost / (row.quantity || 1), row.price, row.value, row.profit].join(','),
      ),
    ].join('\n');
    download('portfolio.csv', csv, 'text/csv');
  }

  async #import() {
    const file = await pickFile('.csv,.json');
    if (!file) return;

    try {
      const data = this.#data();
      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(file.data);
        data.positions = parsed.positions ?? parsed;
      } else {
        const lines = file.data.trim().split(/\r?\n/).slice(1);
        data.positions = lines
          .map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim()))
          .filter((cells) => cells[0])
          .map((cells) => ({
            id: uid().slice(0, 8),
            symbol: cells[0].toUpperCase(),
            name: cells[1] ?? '',
            quantity: Number(cells[2]) || 0,
            cost: Number(cells[3]) || 0,
            price: Number(cells[4]) || Number(cells[3]) || 0,
          }));
      }
      this.#save(data);
      this.#paint();
      toast(`Imported ${data.positions.length} positions`, 'success');
    } catch (error) {
      toast(`Could not read that file: ${error.message}`, 'error');
    }
  }
}

define('jg-app-portfolio', Portfolio);
