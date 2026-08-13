import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .meter { height: 8px; border-radius: 999px; background: var(--muted); overflow: hidden; }
  .meter i { display: block; height: 100%; transition: width 0.25s ease, background 0.25s ease; }
  .verdict { font: 600 20px/1.2 var(--font-sans); letter-spacing: -0.02em; }
  .checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px; }
  .check { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
  .check .mark { width: 16px; text-align: center; }
  .check[data-pass="true"] .mark { color: var(--success); }
  .check[data-pass="false"] .mark { color: var(--muted-foreground); }
  .check[data-pass="false"] span { color: var(--muted-foreground); }
`;

const COMMON = [
  'password', 'passw0rd', '123456', '12345678', 'qwerty', 'abc123', 'letmein', 'monkey', 'dragon',
  'football', 'iloveyou', 'admin', 'welcome', 'login', 'starwars', 'master', 'sunshine', 'princess',
  'azerty', 'trustno1', 'baseball', 'shadow', 'superman', 'batman',
];

const SPEEDS = [
  ['Online, rate limited (100/s)', 100],
  ['Online, no limit (10k/s)', 1e4],
  ['Offline, slow hash (10M/s)', 1e7],
  ['Offline, fast hash (100B/s)', 1e11],
];

const humanTime = (seconds) => {
  if (!Number.isFinite(seconds)) return 'centuries';
  const units = [
    ['second', 1], ['minute', 60], ['hour', 3600], ['day', 86400],
    ['month', 2592000], ['year', 31536000], ['century', 3153600000],
  ];
  if (seconds < 1) return 'instantly';
  let chosen = units[0];
  for (const unit of units) if (seconds >= unit[1]) chosen = unit;
  const value = seconds / chosen[1];
  if (value > 1000) return `${Math.round(value).toLocaleString()} ${chosen[0]}s`;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${chosen[0]}${value >= 2 ? 's' : ''}`;
};

const analyse = (password) => {
  const sets = [
    { name: 'Lowercase letters', size: 26, test: /[a-z]/ },
    { name: 'Uppercase letters', size: 26, test: /[A-Z]/ },
    { name: 'Digits', size: 10, test: /\d/ },
    { name: 'Symbols', size: 33, test: /[^\w\s]/ },
    { name: 'Spaces', size: 1, test: /\s/ },
  ];

  const used = sets.filter((set) => set.test.test(password));
  const alphabet = used.reduce((total, set) => total + set.size, 0) || 1;
  const unique = new Set(password).size;
  const lower = password.toLowerCase();

  const penalties = [];
  if (COMMON.some((word) => lower.includes(word))) penalties.push('Contains a very common password');
  if (/(.)\1{2,}/.test(password)) penalties.push('Repeats the same character');
  if (/^(?:\d+|[a-z]+)$/i.test(password)) penalties.push('Uses a single character class');
  if (/(?:abc|bcd|cde|123|234|345|456|567|678|789|qwe|asd|zxc)/i.test(password)) penalties.push('Contains a keyboard or alphabet run');
  if (password.length && unique / password.length < 0.5) penalties.push('Low character variety');

  const raw = password.length * Math.log2(alphabet);
  const bits = Math.max(0, raw - penalties.length * 8);

  return { bits, alphabet, unique, used, penalties, sets };
};

const grade = (bits) => {
  if (bits < 28) return { label: 'Very weak', color: 'var(--destructive)', ratio: 0.15 };
  if (bits < 40) return { label: 'Weak', color: 'var(--destructive)', ratio: 0.32 };
  if (bits < 60) return { label: 'Reasonable', color: 'var(--warning)', ratio: 0.55 };
  if (bits < 90) return { label: 'Strong', color: 'var(--success)', ratio: 0.78 };
  return { label: 'Very strong', color: 'var(--success)', ratio: 1 };
};

class PasswordStrength extends JGApp {
  static appId = 'password-strength';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Password" hint="Checked entirely on this device, nothing is sent anywhere">
        <div class="row nowrap">
          <jg-input id="input" type="password" class="grow" placeholder="Type or paste a password"></jg-input>
          <jg-button size="sm" variant="outline" id="reveal">Show</jg-button>
        </div>
      </jg-field>

      <jg-card title="Strength">
        <div class="spread">
          <span class="verdict" id="verdict">-</span>
          <jg-badge id="entropy">0 bits</jg-badge>
        </div>
        <div class="meter"><i id="bar"></i></div>
        <div class="hint" id="summary"></div>
      </jg-card>

      <jg-card title="Composition">
        <div class="checks" id="checks"></div>
      </jg-card>

      <jg-card title="Time to crack" sub="Assuming the attacker knows the character set">
        <div class="kv" id="times"></div>
      </jg-card>

      <jg-card title="Weaknesses" id="issuescard" hidden>
        <ul class="stack tight" id="issues"></ul>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 120));
    this.on(this.$('#reveal'), 'click', () => {
      const input = this.$('#input');
      const hidden = input.getAttribute('type') === 'password';
      input.setAttribute('type', hidden ? 'text' : 'password');
      this.$('#reveal').textContent = hidden ? 'Hide' : 'Show';
    });
    this.#run();
  }

  #run() {
    const password = this.$('#input').value;
    const report = analyse(password);
    const rating = grade(report.bits);

    this.$('#verdict').textContent = password ? rating.label : '-';
    this.$('#verdict').style.color = password ? rating.color : '';
    this.$('#entropy').textContent = `${Math.round(report.bits)} bits`;
    const bar = this.$('#bar');
    bar.style.width = `${password ? rating.ratio * 100 : 0}%`;
    bar.style.background = rating.color;

    this.$('#summary').textContent = password
      ? `${password.length} characters, ${report.unique} unique, alphabet of ${report.alphabet} symbols`
      : 'Enter a password to see how it holds up.';

    this.$('#checks').innerHTML = [
      ...report.sets.map(
        (set) => html`<div class="check" data-pass="${String(set.test.test(password))}">
          <span class="mark">${set.test.test(password) ? '✓' : '○'}</span><span>${set.name}</span>
        </div>`,
      ),
      html`<div class="check" data-pass="${String(password.length >= 12)}">
        <span class="mark">${password.length >= 12 ? '✓' : '○'}</span><span>At least 12 characters</span>
      </div>`,
      html`<div class="check" data-pass="${String(password.length >= 16)}">
        <span class="mark">${password.length >= 16 ? '✓' : '○'}</span><span>At least 16 characters</span>
      </div>`,
    ].join('');

    const combinations = 2 ** report.bits;
    this.$('#times').innerHTML = SPEEDS.map(
      ([label, rate]) => html`<div>${label}</div><div class="mono">${password ? humanTime(combinations / 2 / rate) : '-'}</div>`,
    ).join('');

    this.$('#issuescard').hidden = !report.penalties.length;
    this.$('#issues').innerHTML = report.penalties.map((issue) => html`<li class="hint">- ${issue}</li>`).join('');
  }
}

define('jg-app-password-strength', PasswordStrength);
