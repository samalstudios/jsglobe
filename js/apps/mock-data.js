import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, download } from '../core/util.js';

const sheet = css`
  .shell { display: grid; grid-template-columns: 340px 1fr; gap: 14px; flex: 1; min-height: 0; }
  @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } }
  .fields { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  .list { display: grid; gap: 6px; overflow: auto; scrollbar-width: thin; padding-right: 4px; }
  .field { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; align-items: center; }
  .out { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
`;

const FIRST = ['Ada', 'Grace', 'Alan', 'Katherine', 'Linus', 'Barbara', 'Dennis', 'Radia', 'Ken', 'Margaret', 'Edsger', 'Hedy', 'Tim', 'Anita', 'Guido', 'Shafi', 'Bjarne', 'Frances', 'Donald', 'Jean', 'Leslie', 'Sophie', 'Omar', 'Mira', 'Yusuf', 'Nadia', 'Hugo', 'Lena', 'Marco', 'Ines'];
const LAST = ['Lovelace', 'Hopper', 'Turing', 'Johnson', 'Torvalds', 'Liskov', 'Ritchie', 'Perlman', 'Thompson', 'Hamilton', 'Dijkstra', 'Lamarr', 'Berners-Lee', 'Borg', 'Rossum', 'Goldwasser', 'Stroustrup', 'Allen', 'Knuth', 'Bartik', 'Lamport', 'Wilson', 'Haddad', 'Kovacs', 'Demir', 'Rahman', 'Moreau', 'Fischer', 'Rossi', 'Silva'];
const DOMAINS = ['example.com', 'mail.test', 'acme.dev', 'contoso.io', 'globex.net'];
const CITIES = [
  ['Berlin', 'Germany', 'DE'], ['Lisbon', 'Portugal', 'PT'], ['Toronto', 'Canada', 'CA'],
  ['Osaka', 'Japan', 'JP'], ['Nairobi', 'Kenya', 'KE'], ['Bogota', 'Colombia', 'CO'],
  ['Dublin', 'Ireland', 'IE'], ['Perth', 'Australia', 'AU'], ['Oslo', 'Norway', 'NO'],
  ['Muscat', 'Oman', 'OM'], ['Tallinn', 'Estonia', 'EE'], ['Quito', 'Ecuador', 'EC'],
];
const STREETS = ['Maple', 'Cedar', 'Harbour', 'Willow', 'Station', 'Market', 'Garden', 'Chapel', 'Bridge', 'Orchard'];
const COMPANY_A = ['North', 'Blue', 'Bright', 'Iron', 'Swift', 'Quiet', 'Solid', 'Open'];
const COMPANY_B = ['Harbor', 'Lattice', 'Signal', 'Forge', 'Atlas', 'Ridge', 'Delta', 'Field'];
const COMPANY_C = ['Labs', 'Systems', 'Works', 'Group', 'Studio', 'Collective'];
const ROLES = ['Engineer', 'Designer', 'Analyst', 'Manager', 'Researcher', 'Technician', 'Consultant', 'Architect'];
const DEPARTMENTS = ['Platform', 'Design', 'Data', 'Support', 'Finance', 'Security', 'Research'];
const PRODUCTS = ['Keyboard', 'Monitor', 'Lamp', 'Notebook', 'Backpack', 'Mug', 'Charger', 'Headphones', 'Desk', 'Chair'];
const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo'.split(' ');
const STATUSES = ['active', 'pending', 'archived', 'suspended'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY'];

const mulberry = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (text) => {
  let hash = 2166136261;
  for (const character of String(text)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const TYPES = {
  id: { label: 'Row number', make: (random, index) => index + 1 },
  uuid: {
    label: 'UUID v4',
    make: (random) => {
      const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
      hex[12] = '4';
      hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
      const text = hex.join('');
      return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
    },
  },
  firstName: { label: 'First name', make: (random) => FIRST[Math.floor(random() * FIRST.length)] },
  lastName: { label: 'Last name', make: (random) => LAST[Math.floor(random() * LAST.length)] },
  fullName: { label: 'Full name', make: (random) => `${FIRST[Math.floor(random() * FIRST.length)]} ${LAST[Math.floor(random() * LAST.length)]}` },
  email: {
    label: 'Email',
    make: (random) =>
      `${slug(FIRST[Math.floor(random() * FIRST.length)])}.${slug(LAST[Math.floor(random() * LAST.length)])}@${DOMAINS[Math.floor(random() * DOMAINS.length)]}`,
  },
  username: {
    label: 'Username',
    make: (random) => `${slug(FIRST[Math.floor(random() * FIRST.length)])}${Math.floor(random() * 900 + 100)}`,
  },
  phone: { label: 'Phone', make: (random) => `+${Math.floor(random() * 60 + 20)} ${Math.floor(random() * 900 + 100)} ${Math.floor(random() * 9000 + 1000)}` },
  company: {
    label: 'Company',
    make: (random) =>
      `${COMPANY_A[Math.floor(random() * COMPANY_A.length)]}${COMPANY_B[Math.floor(random() * COMPANY_B.length)]} ${COMPANY_C[Math.floor(random() * COMPANY_C.length)]}`,
  },
  role: { label: 'Job title', make: (random) => `${DEPARTMENTS[Math.floor(random() * DEPARTMENTS.length)]} ${ROLES[Math.floor(random() * ROLES.length)]}` },
  department: { label: 'Department', make: (random) => DEPARTMENTS[Math.floor(random() * DEPARTMENTS.length)] },
  product: { label: 'Product', make: (random) => PRODUCTS[Math.floor(random() * PRODUCTS.length)] },
  street: { label: 'Street address', make: (random) => `${Math.floor(random() * 200 + 1)} ${STREETS[Math.floor(random() * STREETS.length)]} Street` },
  city: { label: 'City', make: (random) => CITIES[Math.floor(random() * CITIES.length)][0] },
  country: { label: 'Country', make: (random) => CITIES[Math.floor(random() * CITIES.length)][1] },
  countryCode: { label: 'Country code', make: (random) => CITIES[Math.floor(random() * CITIES.length)][2] },
  postcode: { label: 'Post code', make: (random) => String(Math.floor(random() * 90000 + 10000)) },
  latitude: { label: 'Latitude', make: (random) => Number((random() * 180 - 90).toFixed(5)) },
  longitude: { label: 'Longitude', make: (random) => Number((random() * 360 - 180).toFixed(5)) },
  integer: { label: 'Integer', make: (random) => Math.floor(random() * 1000) },
  price: { label: 'Price', make: (random) => Number((random() * 400 + 5).toFixed(2)) },
  currency: { label: 'Currency', make: (random) => CURRENCIES[Math.floor(random() * CURRENCIES.length)] },
  boolean: { label: 'Boolean', make: (random) => random() > 0.5 },
  status: { label: 'Status', make: (random) => STATUSES[Math.floor(random() * STATUSES.length)] },
  date: {
    label: 'Date',
    make: (random) => new Date(Date.UTC(2020 + Math.floor(random() * 6), Math.floor(random() * 12), Math.floor(random() * 28) + 1)).toISOString().slice(0, 10),
  },
  datetime: {
    label: 'Date and time',
    make: (random) => new Date(Date.UTC(2020 + Math.floor(random() * 6), Math.floor(random() * 12), Math.floor(random() * 28) + 1, Math.floor(random() * 24), Math.floor(random() * 60))).toISOString(),
  },
  sentence: {
    label: 'Sentence',
    make: (random) => {
      const length = Math.floor(random() * 8) + 5;
      const words = Array.from({ length }, () => WORDS[Math.floor(random() * WORDS.length)]);
      return `${words[0][0].toUpperCase()}${words[0].slice(1)} ${words.slice(1).join(' ')}.`;
    },
  },
  paragraph: {
    label: 'Paragraph',
    make: (random) => {
      const sentences = Math.floor(random() * 3) + 2;
      return Array.from({ length: sentences }, () => {
        const length = Math.floor(random() * 8) + 6;
        const words = Array.from({ length }, () => WORDS[Math.floor(random() * WORDS.length)]);
        return `${words[0][0].toUpperCase()}${words[0].slice(1)} ${words.slice(1).join(' ')}.`;
      }).join(' ');
    },
  },
  url: { label: 'URL', make: (random) => `https://${DOMAINS[Math.floor(random() * DOMAINS.length)]}/${slug(PRODUCTS[Math.floor(random() * PRODUCTS.length)])}` },
  ipv4: { label: 'IPv4', make: (random) => Array.from({ length: 4 }, () => Math.floor(random() * 254) + 1).join('.') },
  colour: { label: 'Hex colour', make: (random) => `#${Math.floor(random() * 0xffffff).toString(16).padStart(6, '0')}` },
};

const DEFAULT_FIELDS = [
  { name: 'id', type: 'uuid' },
  { name: 'name', type: 'fullName' },
  { name: 'email', type: 'email' },
  { name: 'company', type: 'company' },
  { name: 'city', type: 'city' },
  { name: 'signedUp', type: 'date' },
  { name: 'active', type: 'boolean' },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const toCsv = (rows, headers) =>
  [headers.join(','), ...rows.map((row) => headers.map((header) => {
    const value = String(row[header] ?? '');
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(','))].join('\n');

const sqlValue = (value) => {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
};

class MockData extends JGApp {
  static appId = 'mock-data';
  static styles = [...JGApp.styles, sheet];

  #fields = [];
  #format = 'json';

  renderApp() {
    const saved = this.store.read({ fields: null, count: 25, seed: 'toolbox', format: 'json' });
    this.#fields = (saved.fields ?? DEFAULT_FIELDS).map((field) => ({ id: uid(), ...field }));
    this.#format = saved.format ?? 'json';

    this.paint(html`<div class="app">
      <div class="shell">
        <div class="fields">
          <div class="row">
            <jg-field label="Rows" style="flex:1"><jg-input id="count" type="number" min="1" max="5000" value="${saved.count}"></jg-input></jg-field>
            <jg-field label="Seed" style="flex:1"><jg-input id="seed" mono value="${saved.seed}"></jg-input></jg-field>
          </div>
          <div class="row">
            <jg-switch id="table-name-on" checked></jg-switch><span class="hint">Wrap JSON in an array</span>
          </div>
          <span class="label">Fields</span>
          <div class="list" id="list"></div>
          <jg-button size="sm" variant="outline" id="add">Add field</jg-button>
        </div>

        <div class="out">
          <jg-code id="out" grow gutter language="json" readonly></jg-code>
          <div class="row">
            <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
            <jg-button size="sm" variant="ghost" id="download">Download</jg-button>
            <span class="grow"></span>
            <span class="hint" id="stats"></span>
          </div>
        </div>
      </div>
    </div>`);

    this.setActions([
      ...['json', 'jsonl', 'csv', 'sql'].map((format) => ({
        id: format,
        label: { json: 'JSON', jsonl: 'JSON lines', csv: 'CSV', sql: 'SQL' }[format],
        icon: { json: 'braces', jsonl: 'code', csv: 'list', sql: 'database' }[format],
        select: true,
        action: () => this.#format_set(format),
      })),
      { separator: true },
      {
        id: 'shuffle',
        label: 'New seed',
        icon: 'undo',
        action: () => {
          this.$('#seed').value = Math.random().toString(36).slice(2, 8);
          this.#run();
        },
      },
    ]);
    this.setActiveAction(this.#format);

    const run = debounce(() => this.#run(), 200);
    this.on(this.$('#count'), 'input', run);
    this.on(this.$('#seed'), 'input', run);
    this.on(this.$('#table-name-on'), 'change', run);
    this.on(this.$('#add'), 'click', () => {
      this.#fields = [...this.#fields, { id: uid(), name: `field${this.#fields.length + 1}`, type: 'sentence' }];
      this.#paintFields();
      this.#run();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#out').value));
    this.on(this.$('#download'), 'click', () => {
      const extensions = { json: 'json', jsonl: 'jsonl', csv: 'csv', sql: 'sql' };
      download(`mock-data.${extensions[this.#format]}`, this.$('#out').value, 'text/plain');
    });

    this.#paintFields();
    this.#run();
  }

  #format_set(format) {
    this.#format = format;
    this.setActiveAction(format);
    this.$('#out').language = { json: 'json', jsonl: 'json', csv: 'plain', sql: 'sql' }[format];
    this.#run();
  }

  #paintFields() {
    this.$('#list').innerHTML = this.#fields
      .map(
        (field) => html`<div class="field">
          <jg-input size="sm" mono value="${field.name}" data-name="${field.id}"></jg-input>
          <jg-select size="sm" value="${field.type}" data-type="${field.id}">
            ${Object.entries(TYPES).map(([value, type]) => html`<option value="${value}">${type.label}</option>`)}
          </jg-select>
          <jg-button size="icon-sm" variant="ghost" data-drop="${field.id}">✕</jg-button>
        </div>`,
      )
      .join('');

    this.bind('[data-name]', 'input', (event) => {
      const field = this.#fields.find((item) => item.id === event.currentTarget.dataset.name);
      if (field) field.name = event.currentTarget.value;
      this.#run();
    });
    this.bind('[data-type]', 'change', (event) => {
      const field = this.#fields.find((item) => item.id === event.currentTarget.dataset.type);
      if (field) field.type = event.detail.value;
      this.#run();
    });
    this.bind('[data-drop]', 'click', (event) => {
      this.#fields = this.#fields.filter((item) => item.id !== event.currentTarget.dataset.drop);
      this.#paintFields();
      this.#run();
    });
  }

  #run() {
    const count = Math.min(5000, Math.max(1, Number(this.$('#count').value) || 1));
    const seed = this.$('#seed').value;
    const random = mulberry(hashSeed(seed || 'toolbox'));
    const fields = this.#fields.filter((field) => field.name.trim());

    const rows = Array.from({ length: count }, (item, index) =>
      Object.fromEntries(fields.map((field) => [field.name, (TYPES[field.type] ?? TYPES.sentence).make(random, index)])),
    );

    const headers = fields.map((field) => field.name);
    const output = this.$('#out');

    if (this.#format === 'json') {
      output.value = this.$('#table-name-on').checked ? JSON.stringify(rows, null, 2) : rows.map((row) => JSON.stringify(row, null, 2)).join('\n');
    } else if (this.#format === 'jsonl') {
      output.value = rows.map((row) => JSON.stringify(row)).join('\n');
    } else if (this.#format === 'csv') {
      output.value = toCsv(rows, headers);
    } else {
      const columns = headers.map((header) => header.replace(/[^\w]+/g, '_').toLowerCase());
      output.value = rows
        .map((row) => `INSERT INTO mock_data (${columns.join(', ')}) VALUES (${headers.map((header) => sqlValue(row[header])).join(', ')});`)
        .join('\n');
    }

    this.$('#stats').textContent = `${count} rows - ${fields.length} fields - seed "${seed}"`;
    this.store.write({ fields: fields.map(({ name, type }) => ({ name, type })), count, seed, format: this.#format });
  }
}

define('jg-app-mock-data', MockData);
