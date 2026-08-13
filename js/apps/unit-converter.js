import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .row-convert { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: end; }
  @media (max-width: 640px) { .row-convert { grid-template-columns: 1fr; } }
  .swap { align-self: center; }
  .all { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px; }
  .unit {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    font-size: 12.5px;
  }
  .unit .v { font-family: var(--font-mono); }
`;

const CATEGORIES = {
  length: {
    name: 'Length',
    units: {
      mm: ['Millimetre', 0.001], cm: ['Centimetre', 0.01], m: ['Metre', 1], km: ['Kilometre', 1000],
      in: ['Inch', 0.0254], ft: ['Foot', 0.3048], yd: ['Yard', 0.9144], mi: ['Mile', 1609.344],
      nmi: ['Nautical mile', 1852],
    },
  },
  mass: {
    name: 'Mass',
    units: {
      mg: ['Milligram', 0.000001], g: ['Gram', 0.001], kg: ['Kilogram', 1], t: ['Tonne', 1000],
      oz: ['Ounce', 0.0283495], lb: ['Pound', 0.453592], st: ['Stone', 6.35029],
    },
  },
  data: {
    name: 'Data',
    units: {
      b: ['Byte', 1], kb: ['Kilobyte', 1000], kib: ['Kibibyte', 1024], mb: ['Megabyte', 1e6],
      mib: ['Mebibyte', 1024 ** 2], gb: ['Gigabyte', 1e9], gib: ['Gibibyte', 1024 ** 3],
      tb: ['Terabyte', 1e12], tib: ['Tebibyte', 1024 ** 4],
    },
  },
  time: {
    name: 'Time',
    units: {
      ms: ['Millisecond', 0.001], s: ['Second', 1], min: ['Minute', 60], h: ['Hour', 3600],
      d: ['Day', 86400], wk: ['Week', 604800], mo: ['Month (30d)', 2592000], yr: ['Year (365d)', 31536000],
    },
  },
  speed: {
    name: 'Speed',
    units: {
      'm/s': ['Metres per second', 1], 'km/h': ['Kilometres per hour', 0.277778],
      mph: ['Miles per hour', 0.44704], kn: ['Knot', 0.514444],
    },
  },
  area: {
    name: 'Area',
    units: {
      'm²': ['Square metre', 1], 'km²': ['Square kilometre', 1e6], ha: ['Hectare', 10000],
      'ft²': ['Square foot', 0.092903], ac: ['Acre', 4046.86],
    },
  },
  volume: {
    name: 'Volume',
    units: {
      ml: ['Millilitre', 0.001], l: ['Litre', 1], 'm³': ['Cubic metre', 1000],
      gal: ['US gallon', 3.78541], qt: ['US quart', 0.946353], cup: ['US cup', 0.236588],
    },
  },
  temperature: {
    name: 'Temperature',
    special: true,
    units: { c: ['Celsius'], f: ['Fahrenheit'], k: ['Kelvin'] },
  },
};

const toCelsius = { c: (value) => value, f: (value) => (value - 32) / 1.8, k: (value) => value - 273.15 };
const fromCelsius = { c: (value) => value, f: (value) => value * 1.8 + 32, k: (value) => value + 273.15 };

const format = (value) => {
  if (!Number.isFinite(value)) return '-';
  if (value !== 0 && (Math.abs(value) < 0.0001 || Math.abs(value) >= 1e12)) return value.toExponential(6);
  return Number(value.toPrecision(10)).toLocaleString(undefined, { maximumFractionDigits: 10 });
};

class UnitConverter extends JGApp {
  static appId = 'unit-converter';
  static styles = [...JGApp.styles, sheet];

  #category = 'length';

  renderApp() {
    this.paint(html`<div class="app">
      <jg-tabs id="category" full></jg-tabs>

      <div class="row-convert">
        <jg-field label="From">
          <jg-input id="value" type="number" value="1"></jg-input>
          <jg-select id="from"></jg-select>
        </jg-field>
        <jg-button class="swap" variant="outline" size="icon" id="swap">⇄</jg-button>
        <jg-field label="To">
          <jg-output id="result"></jg-output>
          <jg-select id="to"></jg-select>
        </jg-field>
      </div>

      <jg-card title="All units">
        <div class="all" id="all"></div>
      </jg-card>
    </div>`);

    this.$('#category').items = Object.entries(CATEGORIES).map(([id, group]) => ({ value: id, label: group.name }));
    this.$('#category').value = this.#category;
    this.on(this.$('#category'), 'change', (event) => {
      this.#category = event.detail.value;
      this.#fillUnits();
      this.#run();
    });

    this.on(this.$('#value'), 'input', debounce(() => this.#run(), 120));
    this.on(this.$('#from'), 'change', () => this.#run());
    this.on(this.$('#to'), 'change', () => this.#run());
    this.on(this.$('#swap'), 'click', () => {
      const from = this.$('#from').value;
      this.$('#from').value = this.$('#to').value;
      this.$('#to').value = from;
      this.#run();
    });

    this.#fillUnits();
    this.#run();
  }

  #fillUnits() {
    const group = CATEGORIES[this.#category];
    const options = Object.entries(group.units).map(([id, unit]) => ({ value: id, label: `${unit[0]} (${id})` }));
    this.$('#from').options = options;
    this.$('#to').options = options;
    this.$('#from').value = options[0].value;
    this.$('#to').value = options[Math.min(2, options.length - 1)].value;
  }

  #convert(value, from, to) {
    const group = CATEGORIES[this.#category];
    if (group.special) return fromCelsius[to](toCelsius[from](value));
    return (value * group.units[from][1]) / group.units[to][1];
  }

  #run() {
    const group = CATEGORIES[this.#category];
    const value = Number(this.$('#value').value);
    const from = this.$('#from').value;
    const to = this.$('#to').value;
    if (!from || !to) return;

    this.$('#result').value = Number.isFinite(value) ? format(this.#convert(value, from, to)) : '-';

    this.$('#all').innerHTML = Object.entries(group.units)
      .map(
        ([id, unit]) => html`<div class="unit">
          <span class="muted">${unit[0]}</span>
          <span class="v">${format(this.#convert(value, from, id))} ${id}</span>
        </div>`,
      )
      .join('');
  }
}

define('jg-app-units', UnitConverter);
