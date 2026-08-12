import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .formats { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; }
  .format { display: flex; flex-direction: column; gap: 4px; }
  .widget { display: grid; gap: 3px; align-content: center; height: 100%; padding: 0 12px 12px; }
  .widget .epoch { font: 600 22px/1 var(--font-mono); letter-spacing: -0.02em; }
`;

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const relative = (date) => {
  const diff = date.getTime() - Date.now();
  const units = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms || unit === 'second') return RELATIVE.format(Math.round(diff / ms), unit);
  }
  return 'now';
};

const parseInput = (value) => {
  const text = value.trim();
  if (!text) return new Date();
  if (/^\d{1,10}$/.test(text)) return new Date(Number(text) * 1000);
  if (/^\d{11,13}$/.test(text)) return new Date(Number(text));
  if (/^\d{14,19}$/.test(text)) return new Date(Number(text) / 1000);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const weekNumber = (date) => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
};

class DateConverter extends JGApp {
  static appId = 'date-converter';
  static styles = [...JGApp.styles, sheet];

  #timer = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div class="label">Unix time</div>
        <div class="epoch" id="epoch"></div>
        <div class="hint" id="iso"></div>
      </div>
    </div>`);
    const tick = () => {
      const node = this.$('#epoch');
      if (!node) return;
      const now = new Date();
      node.textContent = Math.floor(now.getTime() / 1000);
      this.$('#iso').textContent = now.toISOString().replace('T', ' ').slice(0, 19);
    };
    tick();
    this.#timer = setInterval(tick, 1000);
    this.track(() => clearInterval(this.#timer));
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row nowrap">
        <jg-input id="input" class="grow" placeholder="1700000000, 2024-01-31T09:00:00Z, or "now""></jg-input>
        <jg-button variant="outline" id="now">Now</jg-button>
      </div>
      <div class="hint" id="status"></div>

      <div class="formats">
        <div class="format"><span class="label">Unix seconds</span><jg-output data-out="unix"></jg-output></div>
        <div class="format"><span class="label">Unix milliseconds</span><jg-output data-out="ms"></jg-output></div>
        <div class="format"><span class="label">ISO 8601</span><jg-output data-out="iso"></jg-output></div>
        <div class="format"><span class="label">UTC</span><jg-output data-out="utc"></jg-output></div>
        <div class="format"><span class="label">Local</span><jg-output data-out="local"></jg-output></div>
        <div class="format"><span class="label">Relative</span><jg-output data-out="relative"></jg-output></div>
        <div class="format"><span class="label">RFC 2822</span><jg-output data-out="rfc"></jg-output></div>
        <div class="format"><span class="label">SQL datetime</span><jg-output data-out="sql"></jg-output></div>
      </div>

      <jg-card title="Details">
        <div class="kv" id="details"></div>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 140));
    this.on(this.$('#now'), 'click', () => {
      this.$('#input').value = String(Math.floor(Date.now() / 1000));
      this.#run();
    });
    this.#run();
  }

  #run() {
    const value = this.$('#input').value;
    const date = parseInput(value);
    const status = this.$('#status');

    if (!date || Number.isNaN(date.getTime())) {
      status.innerHTML = html`<span class="error">Could not read that date.</span>`;
      this.$$('[data-out]').forEach((node) => {
        node.value = '';
      });
      return;
    }

    status.textContent = value.trim() ? `Interpreted as ${date.toString()}` : 'Showing the current time.';

    const pad = (number, size = 2) => String(number).padStart(size, '0');
    const set = (key, out) => {
      const node = this.$(`[data-out="${key}"]`);
      if (node) node.value = out;
    };

    set('unix', Math.floor(date.getTime() / 1000));
    set('ms', date.getTime());
    set('iso', date.toISOString());
    set('utc', date.toUTCString());
    set('local', date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' }));
    set('relative', relative(date));
    set('rfc', date.toUTCString().replace('GMT', '+0000'));
    set(
      'sql',
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    );

    const startOfYear = new Date(date.getFullYear(), 0, 0);
    this.$('#details').innerHTML = html`
      <div>Day of week</div><div>${date.toLocaleDateString(undefined, { weekday: 'long' })}</div>
      <div>Day of year</div><div>${Math.floor((date - startOfYear) / 86400000)}</div>
      <div>ISO week</div><div>${weekNumber(date)}</div>
      <div>Quarter</div><div>Q${Math.floor(date.getMonth() / 3) + 1}</div>
      <div>Leap year</div><div>${(date.getFullYear() % 4 === 0 && date.getFullYear() % 100 !== 0) || date.getFullYear() % 400 === 0 ? 'Yes' : 'No'}</div>
      <div>Timezone</div><div>${Intl.DateTimeFormat().resolvedOptions().timeZone} (UTC${date.getTimezoneOffset() > 0 ? '-' : '+'}${pad(Math.floor(Math.abs(date.getTimezoneOffset()) / 60))}:${pad(Math.abs(date.getTimezoneOffset()) % 60)})</div>
    `;
  }
}

define('jg-app-date', DateConverter);
