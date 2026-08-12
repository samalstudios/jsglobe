import { JGApp, define, html, css } from '../core/app.js';
import { uid } from '../core/util.js';
import { HOLIDAY_SETS, holidaysFor } from '../lib/holidays.js';

const sheet = css`
  .bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .title { font-size: 17px; font-weight: 650; letter-spacing: -0.02em; }
  .nav { display: flex; gap: 4px; align-items: center; }

  .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .dow {
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding-bottom: 2px;
  }
  .day {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    min-height: 74px;
    padding: 5px 5px 4px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 45%, transparent);
    color: var(--foreground);
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
    overflow: hidden;
  }
  .day:hover { border-color: var(--border-strong); }
  .day[data-outside="true"] { opacity: 0.45; }
  .day[data-today="true"] .num {
    background: var(--ring);
    color: #fff;
    border-radius: 999px;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
  }
  .day[data-selected="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 14%, transparent); }
  .num { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 12px; }
  .chip {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 4px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--chip) 22%, transparent);
    color: var(--foreground);
    font-size: 10.5px;
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chip i { width: 5px; height: 5px; border-radius: 999px; background: var(--chip); flex: none; }
  .more { font-size: 10px; color: var(--muted-foreground); padding-left: 2px; }

  .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .wcol { display: flex; flex-direction: column; gap: 5px; min-height: 260px; }
  .whead {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 5px 0;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--muted) 50%, transparent);
    cursor: pointer;
  }
  .whead[data-today="true"] { background: color-mix(in srgb, var(--ring) 18%, transparent); }
  .whead .d { font-size: 10.5px; color: var(--muted-foreground); text-transform: uppercase; }
  .whead .n { font-size: 15px; font-weight: 650; }

  .hours { display: flex; flex-direction: column; }
  .hour { display: grid; grid-template-columns: 56px 1fr; gap: 10px; align-items: start; padding: 5px 0; border-top: 1px solid var(--border); }
  .hour .t { font-size: 11px; color: var(--muted-foreground); font-family: var(--font-mono); padding-top: 2px; }
  .hour .slot { display: flex; flex-direction: column; gap: 4px; min-height: 20px; }

  .year { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
  .mini { display: flex; flex-direction: column; gap: 5px; }
  .mini h4 { margin: 0; font-size: 12.5px; font-weight: 600; cursor: pointer; }
  .mini .cells { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .mini .cell {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    font-size: 9.5px;
    border-radius: 4px;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    position: relative;
  }
  .mini .cell[data-in="true"] { color: var(--foreground); }
  .mini .cell[data-today="true"] { background: var(--ring); color: #fff; }
  .mini .cell[data-has="true"]::after {
    content: "";
    position: absolute;
    bottom: 1px;
    width: 3px;
    height: 3px;
    border-radius: 999px;
    background: var(--ring);
  }

  .event {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-left: 3px solid var(--chip, var(--ring));
    border-radius: var(--radius-sm);
    background: var(--card);
    font-size: 12.5px;
  }
  .event .time { font: 600 11.5px/1 var(--font-mono); color: var(--muted-foreground); min-width: 42px; }
  .event .del { opacity: 0; }
  .event:hover .del { opacity: 1; }

  .cal-row { display: flex; align-items: center; gap: 9px; padding: 7px 2px; border-bottom: 1px solid var(--border); }
  .swatch { width: 11px; height: 11px; border-radius: 999px; flex: none; }

  .widget { display: grid; grid-template-rows: auto 1fr; gap: 6px; height: 100%; padding: 0 12px 12px; }
  .widget .dow-label { font-size: 11.5px; font-weight: 600; color: var(--destructive); text-transform: uppercase; }
  .widget .big { font: 600 38px/1 var(--font-sans); letter-spacing: -0.04em; }
  .widget .up { font-size: 11.5px; color: var(--muted-foreground); overflow: hidden; display: flex; flex-direction: column; gap: 2px; }
`;

const pad = (value) => String(value).padStart(2, '0');
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseIso = (value) => new Date(`${value}T00:00:00`);
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const DEFAULT_STATE = {
  calendars: [
    { id: 'personal', name: 'Personal', color: '#6f7cff', visible: true },
    { id: 'work', name: 'Work', color: '#22c55e', visible: true },
  ],
  subscriptions: ['us-holidays'],
  events: {},
};

const VIEWS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

class CalendarApp extends JGApp {
  static appId = 'calendar';
  static styles = [...JGApp.styles, sheet];

  #view = 'month';
  #cursor = new Date();
  #selected = iso(new Date());
  #panel = false;

  #data() {
    const stored = this.store.read(null);
    return stored ? { ...DEFAULT_STATE, ...stored } : structuredClone(DEFAULT_STATE);
  }

  #save(next) {
    this.store.write(next);
  }

  #calendars() {
    const data = this.#data();
    return [
      ...data.calendars,
      ...data.subscriptions
        .map((id) => HOLIDAY_SETS.find((set) => set.id === id))
        .filter(Boolean)
        .map((set) => ({ id: set.id, name: set.name, color: set.color, visible: true, readonly: true })),
    ];
  }

  #calendar(id) {
    return this.#calendars().find((calendar) => calendar.id === id) ?? { color: 'var(--ring)', name: 'Unknown' };
  }

  #eventsFor(dateKey) {
    const data = this.#data();
    const hidden = new Set(data.calendars.filter((calendar) => !calendar.visible).map((calendar) => calendar.id));
    const own = (data.events[dateKey] ?? []).filter((event) => !hidden.has(event.calendarId));
    const year = Number(dateKey.slice(0, 4));
    const holidays = data.subscriptions.flatMap((setId) =>
      holidaysFor(setId, year).filter((holiday) => holiday.date === dateKey),
    );
    return [...holidays, ...own].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  #hasEvents(dateKey) {
    return this.#eventsFor(dateKey).length > 0;
  }

  renderWidget() {
    const now = new Date();
    const today = iso(now);
    const upcoming = Array.from({ length: 14 }, (unused, index) => iso(addDays(now, index)))
      .flatMap((key) => this.#eventsFor(key).map((event) => ({ ...event, date: key })))
      .slice(0, 3);

    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div>
          <div class="dow-label">${now.toLocaleDateString([], { weekday: 'long' })}</div>
          <div class="big">${now.getDate()}</div>
        </div>
        <div class="up">
          ${upcoming.length
            ? upcoming.map(
                (event) => html`<div>${event.date === today ? '' : `${parseIso(event.date).toLocaleDateString([], { day: 'numeric', month: 'short' })} · `}${event.time ? `${event.time} ` : ''}${event.title}</div>`,
              )
            : html`<div>Nothing scheduled</div>`}
        </div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="bar">
        <div class="nav">
          <jg-button size="icon" variant="outline" id="prev">‹</jg-button>
          <jg-button size="sm" variant="outline" id="today">Today</jg-button>
          <jg-button size="icon" variant="outline" id="next">›</jg-button>
        </div>
        <span class="title" id="title"></span>
        <span class="grow"></span>
        <jg-tabs id="view"></jg-tabs>
        <jg-button size="sm" variant="${this.#panel ? 'secondary' : 'outline'}" id="calendars">Calendars</jg-button>
      </div>

      <div id="panel"></div>
      <div id="body" class="fill"></div>
      <div id="agenda"></div>
    </div>`);

    this.$('#view').items = VIEWS;
    this.$('#view').value = this.#view;
    this.on(this.$('#view'), 'change', (event) => {
      this.#view = event.detail.value;
      this.refresh();
    });

    this.on(this.$('#prev'), 'click', () => this.#step(-1));
    this.on(this.$('#next'), 'click', () => this.#step(1));
    this.on(this.$('#today'), 'click', () => {
      this.#cursor = new Date();
      this.#selected = iso(new Date());
      this.refresh();
    });
    this.on(this.$('#calendars'), 'click', () => {
      this.#panel = !this.#panel;
      this.refresh();
    });

    this.#renderTitle();
    if (this.#panel) this.#renderPanel();
    this.#renderView();
    if (this.#view !== 'year') this.#renderAgenda();
  }

  #step(direction) {
    const cursor = this.#cursor;
    if (this.#view === 'day') this.#cursor = addDays(cursor, direction);
    if (this.#view === 'week') this.#cursor = addDays(cursor, direction * 7);
    if (this.#view === 'month') this.#cursor = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
    if (this.#view === 'year') this.#cursor = new Date(cursor.getFullYear() + direction, cursor.getMonth(), 1);
    if (this.#view === 'day') this.#selected = iso(this.#cursor);
    this.refresh();
  }

  #weekStart(date) {
    const offset = this.config.get('weekStart', 'mon') === 'mon' ? 1 : 0;
    const lead = (date.getDay() - offset + 7) % 7;
    return addDays(date, -lead);
  }

  #dayNames() {
    const offset = this.config.get('weekStart', 'mon') === 'mon' ? 1 : 0;
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return [...names.slice(offset), ...names.slice(0, offset)];
  }

  #renderTitle() {
    const cursor = this.#cursor;
    const node = this.$('#title');
    if (this.#view === 'day') node.textContent = cursor.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    else if (this.#view === 'week') {
      const start = this.#weekStart(cursor);
      const end = addDays(start, 6);
      node.textContent = `${start.toLocaleDateString([], { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (this.#view === 'month') node.textContent = cursor.toLocaleDateString([], { month: 'long', year: 'numeric' });
    else node.textContent = String(cursor.getFullYear());
  }

  #renderPanel() {
    const data = this.#data();
    this.$('#panel').innerHTML = html`
      <jg-card title="Calendars" sub="Toggle visibility, add your own or subscribe to holidays">
        <div>
          ${data.calendars.map(
            (calendar) => html`<div class="cal-row">
              <span class="swatch" style="background:${calendar.color}"></span>
              <span class="grow">${calendar.name}</span>
              <jg-switch data-toggle="${calendar.id}" ${calendar.visible ? 'checked' : ''}></jg-switch>
              <jg-button size="icon-sm" variant="ghost" data-delcal="${calendar.id}">✕</jg-button>
            </div>`,
          )}
        </div>
        <div class="row nowrap">
          <jg-input id="calname" class="grow" placeholder="New calendar name"></jg-input>
          <jg-input id="calcolor" type="color" value="#f97316" style="width:56px"></jg-input>
          <jg-button size="sm" id="addcal">Add</jg-button>
        </div>
        <div class="sep"></div>
        <div class="label">Holiday calendars</div>
        <div>
          ${HOLIDAY_SETS.map(
            (set) => html`<div class="cal-row">
              <span class="swatch" style="background:${set.color}"></span>
              <span class="grow">${set.name}</span>
              <jg-switch data-sub="${set.id}" ${data.subscriptions.includes(set.id) ? 'checked' : ''}></jg-switch>
            </div>`,
          )}
        </div>
      </jg-card>
    `;

    this.bind('[data-toggle]', 'change', (event) => {
      const id = event.currentTarget.dataset.toggle;
      const next = this.#data();
      next.calendars = next.calendars.map((calendar) =>
        calendar.id === id ? { ...calendar, visible: event.detail.checked } : calendar,
      );
      this.#save(next);
      this.refresh();
    });

    this.bind('[data-sub]', 'change', (event) => {
      const id = event.currentTarget.dataset.sub;
      const next = this.#data();
      next.subscriptions = event.detail.checked
        ? [...new Set([...next.subscriptions, id])]
        : next.subscriptions.filter((item) => item !== id);
      this.#save(next);
      this.refresh();
    });

    this.bind('[data-delcal]', 'click', (event) => {
      const id = event.currentTarget.dataset.delcal;
      const next = this.#data();
      next.calendars = next.calendars.filter((calendar) => calendar.id !== id);
      Object.keys(next.events).forEach((key) => {
        next.events[key] = next.events[key].filter((item) => item.calendarId !== id);
        if (!next.events[key].length) delete next.events[key];
      });
      this.#save(next);
      this.refresh();
    });

    this.on(this.$('#addcal'), 'click', () => {
      const name = this.$('#calname').value.trim();
      if (!name) return;
      const next = this.#data();
      next.calendars = [...next.calendars, { id: uid().slice(0, 6), name, color: this.$('#calcolor').value, visible: true }];
      this.#save(next);
      this.refresh();
    });
  }

  #renderView() {
    const body = this.$('#body');
    if (this.#view === 'month') this.#month(body);
    if (this.#view === 'week') this.#week(body);
    if (this.#view === 'day') this.#day(body);
    if (this.#view === 'year') this.#year(body);
  }

  #chip(event) {
    const calendar = this.#calendar(event.calendarId);
    return html`<span class="chip" style="--chip:${calendar.color}" title="${event.title}">
      <i></i>${event.time ? `${event.time} ` : ''}${event.title}
    </span>`;
  }

  #month(body) {
    const year = this.#cursor.getFullYear();
    const month = this.#cursor.getMonth();
    const start = this.#weekStart(new Date(year, month, 1));
    const today = iso(new Date());

    const cells = Array.from({ length: 42 }, (unused, index) => {
      const date = addDays(start, index);
      return { date, key: iso(date), outside: date.getMonth() !== month };
    });

    body.innerHTML = html`
      <div class="grid">
        ${this.#dayNames().map((name) => html`<div class="dow">${name}</div>`)}
        ${cells.map((cell) => {
          const events = this.#eventsFor(cell.key);
          return html`<button
            class="day"
            data-key="${cell.key}"
            data-outside="${String(cell.outside)}"
            data-today="${String(cell.key === today)}"
            data-selected="${String(cell.key === this.#selected)}"
          >
            <span class="num">${cell.date.getDate()}</span>
            ${events.slice(0, 2).map((event) => this.#chip(event))}
            ${events.length > 2 ? html`<span class="more">+${events.length - 2} more</span>` : ''}
          </button>`;
        })}
      </div>
    `;

    this.bind('.day', 'click', (event) => {
      this.#selected = event.currentTarget.dataset.key;
      const picked = parseIso(this.#selected);
      if (picked.getMonth() !== month) this.#cursor = picked;
      this.refresh();
    });
  }

  #week(body) {
    const start = this.#weekStart(this.#cursor);
    const today = iso(new Date());

    body.innerHTML = html`
      <div class="week">
        ${Array.from({ length: 7 }, (unused, index) => {
          const date = addDays(start, index);
          const key = iso(date);
          const events = this.#eventsFor(key);
          return html`<div class="wcol">
            <button class="whead" data-key="${key}" data-today="${String(key === today)}">
              <span class="d">${date.toLocaleDateString([], { weekday: 'short' })}</span>
              <span class="n">${date.getDate()}</span>
            </button>
            ${events.length
              ? events.map((event) => this.#chip(event))
              : html`<span class="hint tiny" style="text-align:center">-</span>`}
          </div>`;
        })}
      </div>
    `;

    this.bind('.whead', 'click', (event) => {
      this.#selected = event.currentTarget.dataset.key;
      this.refresh();
    });
  }

  #day(body) {
    const key = iso(this.#cursor);
    this.#selected = key;
    const events = this.#eventsFor(key);
    const allDay = events.filter((event) => !event.time);
    const timed = events.filter((event) => event.time);

    body.innerHTML = html`
      ${allDay.length ? html`<div class="stack tight">${allDay.map((event) => this.#chip(event))}</div>` : ''}
      <div class="hours">
        ${Array.from({ length: 24 }, (unused, hour) => {
          const slot = timed.filter((event) => Number(event.time.slice(0, 2)) === hour);
          return html`<div class="hour">
            <span class="t">${pad(hour)}:00</span>
            <span class="slot">
              ${slot.map((event) => {
                const calendar = this.#calendar(event.calendarId);
                return html`<span class="event" style="--chip:${calendar.color}">
                  <span class="time">${event.time}</span>
                  <span class="grow">${event.title}</span>
                </span>`;
              })}
            </span>
          </div>`;
        })}
      </div>
    `;
  }

  #year(body) {
    const year = this.#cursor.getFullYear();
    const today = iso(new Date());

    body.innerHTML = html`
      <div class="year">
        ${Array.from({ length: 12 }, (unused, month) => {
          const first = new Date(year, month, 1);
          const start = this.#weekStart(first);
          return html`<div class="mini">
            <h4 data-month="${month}">${first.toLocaleDateString([], { month: 'long' })}</h4>
            <div class="cells">
              ${this.#dayNames().map((name) => html`<span class="cell" style="opacity:.5">${name[0]}</span>`)}
              ${Array.from({ length: 42 }, (item, index) => {
                const date = addDays(start, index);
                const key = iso(date);
                return html`<button
                  class="cell"
                  data-key="${key}"
                  data-in="${String(date.getMonth() === month)}"
                  data-today="${String(key === today)}"
                  data-has="${String(this.#hasEvents(key))}"
                >${date.getDate()}</button>`;
              })}
            </div>
          </div>`;
        })}
      </div>
    `;

    this.bind('[data-month]', 'click', (event) => {
      this.#cursor = new Date(year, Number(event.currentTarget.dataset.month), 1);
      this.#view = 'month';
      this.refresh();
    });

    this.bind('.cell[data-key]', 'click', (event) => {
      this.#selected = event.currentTarget.dataset.key;
      this.#cursor = parseIso(this.#selected);
      this.#view = 'day';
      this.refresh();
    });
  }

  #renderAgenda() {
    const data = this.#data();
    const events = this.#eventsFor(this.#selected);

    this.$('#agenda').innerHTML = html`
      <jg-card title="${parseIso(this.#selected).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}" sub="${events.length} event${events.length === 1 ? '' : 's'}">
        <div class="row nowrap">
          <jg-input id="title" class="grow" placeholder="Add an event..."></jg-input>
          <jg-input id="time" type="time" style="width:118px"></jg-input>
          <jg-select id="calendar" style="width:150px">
            ${data.calendars.map((calendar) => html`<option value="${calendar.id}">${calendar.name}</option>`)}
          </jg-select>
          <jg-button id="add">Add</jg-button>
        </div>
        <div class="stack tight">
          ${events.length
            ? events.map((event) => {
                const calendar = this.#calendar(event.calendarId);
                return html`<div class="event" style="--chip:${calendar.color}">
                  <span class="time">${event.time || 'all day'}</span>
                  <span class="grow">${event.title}</span>
                  <jg-badge>${calendar.name}</jg-badge>
                  ${event.readonly ? '' : html`<jg-button class="del" size="icon-sm" variant="ghost" data-remove="${event.id}">✕</jg-button>`}
                </div>`;
              })
            : html`<jg-empty glyph="▤" title="Nothing planned">Add an event or switch calendars above.</jg-empty>`}
        </div>
      </jg-card>
    `;

    const add = () => {
      const title = this.$('#title').value.trim();
      if (!title) return;
      const next = this.#data();
      const list = next.events[this.#selected] ?? [];
      next.events[this.#selected] = [
        ...list,
        { id: uid().slice(0, 8), title, time: this.$('#time').value, calendarId: this.$('#calendar').value },
      ];
      this.#save(next);
      this.refresh();
    };

    this.on(this.$('#add'), 'click', add);
    this.on(this.$('#title'), 'keydown', (event) => {
      if (event.key === 'Enter') add();
    });

    this.bind('[data-remove]', 'click', (event) => {
      const id = event.currentTarget.dataset.remove;
      const next = this.#data();
      next.events[this.#selected] = (next.events[this.#selected] ?? []).filter((item) => item.id !== id);
      if (!next.events[this.#selected].length) delete next.events[this.#selected];
      this.#save(next);
      this.refresh();
    });
  }
}

define('jg-app-calendar', CalendarApp);
