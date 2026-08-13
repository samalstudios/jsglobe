import { JGApp, define, html, css } from '../core/app.js';
import { debounce } from '../core/util.js';

const sheet = css`
  .expr { font: 600 clamp(20px, 5vw, 30px)/1.2 var(--font-mono); letter-spacing: 0.06em; text-align: center; padding: 6px 0; }
  .fields { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  @media (max-width: 620px) { .fields { grid-template-columns: repeat(2, 1fr); } }
  .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px; }
  .preset {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }
  .preset:hover { border-color: var(--border-strong); }
  .preset code { font-family: var(--font-mono); color: var(--muted-foreground); }
`;

const FIELDS = [
  { name: 'Minute', min: 0, max: 59 },
  { name: 'Hour', min: 0, max: 23 },
  { name: 'Day of month', min: 1, max: 31 },
  { name: 'Month', min: 1, max: 12 },
  { name: 'Day of week', min: 0, max: 6 },
];

const PRESETS = [
  ['Every minute', '* * * * *'],
  ['Every 5 minutes', '*/5 * * * *'],
  ['Every 15 minutes', '*/15 * * * *'],
  ['Hourly', '0 * * * *'],
  ['Every 6 hours', '0 */6 * * *'],
  ['Daily at midnight', '0 0 * * *'],
  ['Daily at 09:00', '0 9 * * *'],
  ['Weekdays at 08:30', '30 8 * * 1-5'],
  ['Every Monday', '0 0 * * 1'],
  ['First of month', '0 0 1 * *'],
  ['Quarterly', '0 0 1 */3 *'],
  ['Yearly', '0 0 1 1 *'],
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const expand = (field, { min, max }) => {
  const values = new Set();
  for (const part of field.split(',')) {
    const [range, stepText] = part.split('/');
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isFinite(step) || step < 1) throw new Error(`Invalid step in "${part}"`);
    let start = min;
    let end = max;
    if (range !== '*') {
      const bounds = range.split('-').map(Number);
      if (bounds.some(Number.isNaN)) throw new Error(`Invalid value "${range}"`);
      start = bounds[0];
      end = bounds.length > 1 ? bounds[1] : bounds[0];
      if (stepText && bounds.length === 1) end = max;
    }
    if (start < min || end > max) throw new Error(`Value out of range in "${part}"`);
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return [...values].sort((a, b) => a - b);
};

const describeField = (field, index) => {
  const spec = FIELDS[index];
  if (field === '*') return null;
  const values = expand(field, spec);
  const names = index === 3 ? values.map((value) => MONTHS[value - 1]) : index === 4 ? values.map((value) => DAYS[value % 7]) : values;
  const list = names.length > 6 ? `${names.slice(0, 5).join(', ')} and ${names.length - 5} more` : names.join(', ');
  return { spec, values, list, stepped: field.includes('/') };
};

const describe = (parts) => {
  const [minute, hour, dom, month, dow] = parts;
  const pieces = [];

  if (minute === '*' && hour === '*') pieces.push('Every minute');
  else if (minute.startsWith('*/') && hour === '*') pieces.push(`Every ${minute.slice(2)} minutes`);
  else if (hour === '*') pieces.push(`At minute ${expand(minute, FIELDS[0]).join(', ')} of every hour`);
  else {
    const hours = expand(hour, FIELDS[1]);
    const minutes = expand(minute, FIELDS[0]);
    const times = hours.flatMap((h) => minutes.map((m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`));
    pieces.push(times.length > 6 ? `At ${times.slice(0, 5).join(', ')} and ${times.length - 5} more times` : `At ${times.join(', ')}`);
  }

  const domInfo = describeField(dom, 2);
  const monthInfo = describeField(month, 3);
  const dowInfo = describeField(dow, 4);

  if (dowInfo) pieces.push(`on ${dowInfo.list}`);
  if (domInfo) pieces.push(`on day ${domInfo.list} of the month`);
  if (monthInfo) pieces.push(`in ${monthInfo.list}`);

  return `${pieces.join(' ')}.`;
};

const nextRuns = (parts, count = 5) => {
  const sets = parts.map((field, index) => new Set(expand(field, FIELDS[index])));
  const runs = [];
  const cursor = new Date();
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  for (let i = 0; i < 527040 && runs.length < count; i += 1) {
    const matchesDom = sets[2].has(cursor.getDate());
    const matchesDow = sets[4].has(cursor.getDay());
    const domRestricted = parts[2] !== '*';
    const dowRestricted = parts[4] !== '*';
    const dayMatches =
      domRestricted && dowRestricted ? matchesDom || matchesDow : domRestricted ? matchesDom : dowRestricted ? matchesDow : true;

    if (sets[0].has(cursor.getMinutes()) && sets[1].has(cursor.getHours()) && dayMatches && sets[3].has(cursor.getMonth() + 1)) {
      runs.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return runs;
};

class CrontabGenerator extends JGApp {
  static appId = 'crontab-generator';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <jg-field label="Cron expression">
        <jg-input id="input" mono value="30 8 * * 1-5"></jg-input>
      </jg-field>

      <div class="fields">
        ${FIELDS.map(
          (field, index) => html`<div class="stack tight">
            <span class="label">${field.name}</span>
            <jg-input data-part="${index}" size="sm" mono></jg-input>
            <span class="hint tiny">${field.min}-${field.max}</span>
          </div>`,
        )}
      </div>

      <jg-card title="Meaning">
        <div class="expr" id="expr"></div>
        <div id="description" class="center"></div>
      </jg-card>

      <jg-card title="Next runs" sub="Based on this machine's clock and timezone">
        <div class="kv" id="runs"></div>
      </jg-card>

      <jg-card title="Presets">
        <div class="presets">
          ${PRESETS.map(
            (preset) => html`<button class="preset" data-cron="${preset[1]}"><span>${preset[0]}</span><code>${preset[1]}</code></button>`,
          )}
        </div>
      </jg-card>
    </div>`);

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 160));
    this.bind('[data-part]', 'input', debounce(() => {
      this.$('#input').value = this.$$('[data-part]').map((node) => node.value.trim() || '*').join(' ');
      this.#run(false);
    }, 200));
    this.bind('[data-cron]', 'click', (event) => {
      this.$('#input').value = event.currentTarget.dataset.cron;
      this.#run();
    });
    this.#run();
  }

  #run(syncFields = true) {
    const value = this.$('#input').value.trim().replace(/\s+/g, ' ');
    const parts = value.split(' ');
    const description = this.$('#description');
    this.$('#expr').textContent = value;

    if (syncFields) {
      this.$$('[data-part]').forEach((node, index) => {
        node.value = parts[index] ?? '*';
      });
    }

    if (parts.length !== 5) {
      description.innerHTML = html`<span class="error">A cron expression needs five fields.</span>`;
      this.$('#runs').innerHTML = '';
      return;
    }

    try {
      description.innerHTML = html`<span>${describe(parts)}</span>`;
      const runs = nextRuns(parts);
      this.$('#runs').innerHTML = runs.length
        ? runs
            .map(
              (date, index) =>
                html`<div>Run ${index + 1}</div><div class="mono">${date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>`,
            )
            .join('')
        : html`<div>Next run</div><div>No match within the next year</div>`;
    } catch (error) {
      description.innerHTML = html`<span class="error">${error.message}</span>`;
      this.$('#runs').innerHTML = '';
    }
  }
}

define('jg-app-crontab', CrontabGenerator);
