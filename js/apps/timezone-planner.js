import { JGApp, define, html, css } from '../core/app.js';
import { copyText, toast } from '../core/util.js';

const sheet = css`
  .rows { display: grid; gap: 6px; }
  .zone {
    display: grid;
    grid-template-columns: 190px 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 7px 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  @media (max-width: 760px) { .zone { grid-template-columns: 1fr; } }
  .zone[data-home="true"] { border-color: color-mix(in srgb, var(--ring) 45%, transparent); background: color-mix(in srgb, var(--ring) 7%, transparent); }
  .label { display: grid; gap: 1px; min-width: 0; }
  .label .city { font-size: 13px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .label .meta { font-family: var(--font-mono); font-size: 10.5px; color: var(--muted-foreground); }
  .strip { display: grid; grid-template-columns: repeat(24, 1fr); gap: 1px; }
  .hour {
    position: relative;
    height: 30px;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 9.5px;
    color: var(--muted-foreground);
    background: color-mix(in srgb, var(--muted) 60%, transparent);
    border-radius: 2px;
  }
  .hour[data-work="true"] { background: color-mix(in srgb, var(--success) 26%, transparent); color: var(--foreground); }
  .hour[data-edge="true"] { background: color-mix(in srgb, var(--warning) 26%, transparent); color: var(--foreground); }
  .hour[data-now="true"] { box-shadow: inset 0 0 0 2px var(--ring); }
  .hour[data-selected="true"] { outline: 2px solid var(--foreground); outline-offset: -2px; }
  .scale { display: grid; grid-template-columns: repeat(24, 1fr); gap: 1px; font-family: var(--font-mono); font-size: 9px; color: var(--muted-foreground); }
  .scale span { text-align: center; }
  .best { display: flex; flex-wrap: wrap; gap: 6px; }
`;

const SUGGESTIONS = [
  'Europe/Berlin', 'Europe/London', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris', 'Europe/Amsterdam',
  'Europe/Zurich', 'Europe/Stockholm', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Moscow', 'Europe/Dublin',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto',
  'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo', 'America/Bogota', 'America/Argentina/Buenos_Aires',
  'Asia/Dubai', 'Asia/Tehran', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Manila',
  'Australia/Perth', 'Australia/Sydney', 'Australia/Brisbane', 'Pacific/Auckland', 'Africa/Cairo',
  'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg', 'UTC',
];

const cityName = (zone) => zone.split('/').pop().replace(/_/g, ' ');

const offsetMinutes = (zone, date) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
};

const abbreviation = (zone, date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(date);
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
};

const formatOffset = (minutes) => {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
};

class TimezonePlanner extends JGApp {
  static appId = 'timezone-planner';
  static styles = [...JGApp.styles, sheet];

  #zones = [];
  #home = '';
  #selected = null;
  #timer = null;

  renderApp() {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const saved = this.store.read({ zones: null, home: null, work: [9, 18] });

    this.#home = saved.home ?? local;
    this.#zones = saved.zones ?? [local, 'America/New_York', 'Asia/Tokyo'].filter((zone, index, list) => list.indexOf(zone) === index);

    this.paint(html`<div class="app">
      <div class="row">
        <jg-select id="picker" size="sm" style="flex:1;min-width:200px">
          <option value="">Add a city</option>
          ${SUGGESTIONS.map((zone) => html`<option value="${zone}">${cityName(zone)} - ${zone}</option>`)}
        </jg-select>
        <jg-input id="date" type="date" size="sm" style="width:170px"></jg-input>
        <jg-button size="sm" variant="ghost" id="today">Today</jg-button>
      </div>

      <div class="row">
        <span class="hint">Working hours</span>
        <jg-input id="from" type="number" min="0" max="23" size="sm" style="width:80px" value="${saved.work[0]}"></jg-input>
        <span class="hint">to</span>
        <jg-input id="to" type="number" min="1" max="24" size="sm" style="width:80px" value="${saved.work[1]}"></jg-input>
        <span class="grow"></span>
        <jg-button size="sm" variant="ghost" id="copy">Copy plan</jg-button>
      </div>

      <div class="scale" id="scale"></div>
      <div class="rows" id="rows"></div>

      <jg-card title="Overlapping hours" sub="Slots that fall inside working hours everywhere">
        <div class="best" id="best"></div>
      </jg-card>

      <div class="hint">
        Click any hour to line the cities up against it. Offsets come from the browser's time zone database, so
        daylight saving is handled for the date you pick.
      </div>
    </div>`);

    this.$('#date').value = new Date().toISOString().slice(0, 10);

    this.on(this.$('#picker'), 'change', (event) => {
      const zone = event.detail.value;
      if (!zone) return;
      if (!this.#zones.includes(zone)) this.#zones = [...this.#zones, zone];
      this.$('#picker').value = '';
      this.#paint();
    });

    this.on(this.$('#date'), 'change', () => this.#paint());
    this.on(this.$('#today'), 'click', () => {
      this.$('#date').value = new Date().toISOString().slice(0, 10);
      this.#selected = null;
      this.#paint();
    });
    ['#from', '#to'].forEach((selector) => this.on(this.$(selector), 'input', () => this.#paint()));
    this.on(this.$('#copy'), 'click', () => copyText(this.#plan()));

    this.#paint();
    this.#timer = setInterval(() => this.#paint(), 60000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #work() {
    const from = Math.max(0, Math.min(23, Number(this.$('#from').value) || 0));
    const to = Math.max(from + 1, Math.min(24, Number(this.$('#to').value) || 24));
    return [from, to];
  }

  #base() {
    const value = this.$('#date').value || new Date().toISOString().slice(0, 10);
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12));
  }

  #rows() {
    const base = this.#base();
    const homeOffset = offsetMinutes(this.#home, base);

    return this.#zones.map((zone) => {
      const offset = offsetMinutes(zone, base);
      const shift = (offset - homeOffset) / 60;
      return { zone, offset, shift, abbreviation: abbreviation(zone, base) };
    });
  }

  #plan() {
    const [from, to] = this.#work();
    const rows = this.#rows();
    const date = this.$('#date').value;
    const hour = this.#selected ?? from;

    return [
      `Plan for ${date}`,
      ...rows.map((row) => {
        const local = (hour + row.shift + 24) % 24;
        const whole = Math.floor(local);
        const minutes = Math.round((local - whole) * 60);
        return `${cityName(row.zone).padEnd(16)} ${String(whole).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${row.abbreviation} (${formatOffset(row.offset)})`;
      }),
      `Working hours used: ${from}:00 to ${to}:00`,
    ].join('\n');
  }

  #paint() {
    const [from, to] = this.#work();
    const base = this.#base();
    const rows = this.#rows();
    const now = new Date();
    const homeNow = (now.getTime() + offsetMinutes(this.#home, now) * 60000) / 3600000;
    const nowHour = Math.floor(homeNow % 24);
    const sameDay = this.$('#date').value === new Date().toISOString().slice(0, 10);

    this.store.write({ zones: this.#zones, home: this.#home, work: [from, to] });

    this.$('#scale').innerHTML = Array.from({ length: 24 }, (item, hour) => html`<span>${hour % 3 === 0 ? hour : ''}</span>`).join('');

    this.$('#rows').innerHTML = rows
      .map((row) => {
        const cells = Array.from({ length: 24 }, (item, hour) => {
          const local = (hour + row.shift + 24) % 24;
          const whole = Math.floor(local);
          const inside = whole >= from && whole < to;
          const edge = !inside && (whole === from - 1 || whole === to);
          return html`<span
            class="hour"
            data-hour="${hour}"
            data-work="${String(inside)}"
            data-edge="${String(edge)}"
            data-now="${String(sameDay && hour === nowHour)}"
            data-selected="${String(this.#selected === hour)}"
            title="${cityName(row.zone)} ${String(whole).padStart(2, '0')}:00"
          >${whole}</span>`;
        });

        return html`<div class="zone" data-home="${String(row.zone === this.#home)}">
          <span class="label">
            <span class="city">${cityName(row.zone)}</span>
            <span class="meta">${row.abbreviation} ${formatOffset(row.offset)}${row.shift ? ` (${row.shift > 0 ? '+' : ''}${row.shift}h)` : ' (home)'}</span>
          </span>
          <span class="strip">${cells}</span>
          <span class="row tight">
            <jg-button size="icon-sm" variant="ghost" data-home-set="${row.zone}" title="Make this the reference">◎</jg-button>
            <jg-button size="icon-sm" variant="ghost" data-drop="${row.zone}" title="Remove">✕</jg-button>
          </span>
        </div>`;
      })
      .join('');

    this.bind('[data-hour]', 'click', (event) => {
      const hour = Number(event.currentTarget.dataset.hour);
      this.#selected = this.#selected === hour ? null : hour;
      this.#paint();
    });
    this.bind('[data-home-set]', 'click', (event) => {
      this.#home = event.currentTarget.dataset.homeSet;
      this.#paint();
    });
    this.bind('[data-drop]', 'click', (event) => {
      if (this.#zones.length === 1) {
        toast('Keep at least one city', 'error');
        return;
      }
      this.#zones = this.#zones.filter((zone) => zone !== event.currentTarget.dataset.drop);
      if (!this.#zones.includes(this.#home)) this.#home = this.#zones[0];
      this.#paint();
    });

    const overlaps = Array.from({ length: 24 }, (item, hour) => hour).filter((hour) =>
      rows.every((row) => {
        const local = Math.floor((hour + row.shift + 24) % 24);
        return local >= from && local < to;
      }),
    );

    this.$('#best').innerHTML = overlaps.length
      ? overlaps
          .map(
            (hour) => html`<jg-badge mono tone="success">${String(hour).padStart(2, '0')}:00 ${cityName(this.#home)}</jg-badge>`,
          )
          .join('')
      : html`<span class="hint">No hour works for everyone. Widen the working hours or drop a city.</span>`;
  }
}

define('jg-app-timezone-planner', TimezonePlanner);
