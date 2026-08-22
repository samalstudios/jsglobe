import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { uid } from '../../core/util.js';
import { HOLIDAY_SETS, holidaysFor } from '../../lib/holidays.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const HOUR = 44;

const pad = (value) => String(value).padStart(2, '0');
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseIso = (value) => new Date(`${value}T00:00:00`);
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const minutes = (time) => (time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : 0);

const DEFAULT_STATE = {
  calendars: [
    { id: 'personal', name: 'Personal', color: '#8a1c3b', visible: true },
    { id: 'work', name: 'Work', color: '#0ea5e9', visible: true },
  ],
  subscriptions: ['us-holidays'],
  events: {},
};

const VIEWS = [
  { value: 'day', label: t('calendar.day', 'Day') },
  { value: 'week', label: t('calendar.week', 'Week') },
  { value: 'month', label: t('calendar.month', 'Month') },
  { value: 'year', label: t('calendar.year', 'Year') },
];

const relativeLabel = (key) => {
  const today = iso(new Date());
  if (key === today) return 'Today';
  if (key === iso(addDays(new Date(), 1))) return 'Tomorrow';
  if (key === iso(addDays(new Date(), -1))) return 'Yesterday';
  const days = Math.round((parseIso(key) - parseIso(today)) / 86400000);
  return days > 0 ? `In ${days} days` : `${Math.abs(days)} days ago`;
};

const packLanes = (events) => {
  const sorted = [...events].sort((a, b) => minutes(a.time) - minutes(b.time));
  const lanes = [];
  const placed = sorted.map((event) => {
    const from = minutes(event.time);
    const to = event.end ? Math.max(minutes(event.end), from + 20) : from + 60;
    const index = lanes.findIndex((lane) => lane <= from);
    const lane = index === -1 ? lanes.length : index;
    lanes[lane] = to;
    return { event, from, to, lane };
  });
  return { placed, columns: Math.max(1, lanes.length) };
};

class CalendarApp extends JGApp {
  static appId = 'calendar';
  static settings = [
    { key: 'weekStart', label: t('calendar.weekStartsOn', 'Week starts on'), type: 'select', default: 'mon', options: [
      { value: 'mon', label: t('calendar.monday', 'Monday') },
      { value: 'sun', label: t('calendar.sunday', 'Sunday') },
    ] },
  ];
  static styles = [...JGApp.styles, sheet];

  #view = 'month';
  #cursor = new Date();
  #selected = iso(new Date());
  #prefill = '';
  #timer = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #data() {
    const stored = this.store.read(null);
    return stored ? { ...structuredClone(DEFAULT_STATE), ...stored } : structuredClone(DEFAULT_STATE);
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
    return this.#calendars().find((calendar) => calendar.id === id) ?? { color: 'var(--ring)', name: 'Calendar' };
  }

  #eventsFor(dateKey) {
    const data = this.#data();
    const hidden = new Set(data.calendars.filter((calendar) => !calendar.visible).map((calendar) => calendar.id));
    const own = (data.events[dateKey] ?? []).filter((event) => !hidden.has(event.calendarId));
    const year = Number(dateKey.slice(0, 4));
    const holidays = data.subscriptions.flatMap((setId) =>
      holidaysFor(setId, year).filter((holiday) => holiday.date === dateKey),
    );
    return [...holidays, ...own].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  #isWeekend(date) {
    return date.getDay() === 0 || date.getDay() === 6;
  }

  renderWidget() {
    const now = new Date();
    const today = iso(now);
    const upcoming = Array.from({ length: 21 }, (unused, index) => iso(addDays(now, index)))
      .flatMap((key) => this.#eventsFor(key).map((event) => ({ ...event, date: key })))
      .slice(0, 4);

    this.paint(html`<div class="app" style="padding:0">
      <div class="widget">
        <div>
          <div class="dow-label">${now.toLocaleDateString([], { weekday: 'long' })}</div>
          <div class="big">${now.getDate()}</div>
        </div>
        <div class="up">
          ${upcoming.length
            ? upcoming.map(
                (event) => html`<div>
                  <i style="background:${this.#calendar(event.calendarId).color}"></i>
                  <span>${event.date === today ? '' : `${parseIso(event.date).toLocaleDateString([], { day: 'numeric', month: 'short' })} `}${event.time ? `${event.time} ` : ''}${event.title}</span>
                </div>`,
              )
            : html`<div>${t('calendar.nothingScheduled', 'Nothing scheduled')}</div>`}
        </div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head">
        <jg-button-group>
          <jg-button size="icon" variant="outline" id="prev" aria-label="${t('calendar.previous', 'Previous')}">‹</jg-button>
          <jg-button variant="outline" id="today">${t('calendar.today', 'Today')}</jg-button>
          <jg-button size="icon" variant="outline" id="next" aria-label="${t('calendar.next', 'Next')}">›</jg-button>
        </jg-button-group>
        <span class="title" id="title"></span>
        <span class="grow"></span>
        <jg-tabs id="view"></jg-tabs>
        <jg-button variant="outline" id="calendars">${t('calendar.calendars', 'Calendars')}</jg-button>
      </div>

      <div class="wrap" data-side="${String(this.#view !== 'year')}">
        <div id="body"></div>
        ${this.#view === 'year' ? '' : html`<aside class="side" id="side"></aside>`}
      </div>

      <jg-sheet id="calendar-sheet" title-text="${t('calendar.calendars', 'Calendars')}" sub="${t('calendar.chooseWhatAppearsInThe', 'Choose what appears in the grid')}">
        <div id="calendar-list"></div>
      </jg-sheet>

      <jg-dialog id="event-dialog" title-text="${t('calendar.newEvent', 'New event')}">
        <jg-field label="${t('calendar.title', 'Title')}"><jg-input id="title-input" placeholder="${t('calendar.standUp', 'Stand up')}" autofocus></jg-input></jg-field>
        <div class="times">
          <jg-field label="${t('calendar.from', 'From')}"><jg-input id="from" type="time"></jg-input></jg-field>
          <jg-field label="${t('calendar.to', 'To')}"><jg-input id="to" type="time"></jg-input></jg-field>
        </div>
        <jg-field label="${t('calendar.calendar', 'Calendar')}"><jg-select id="calendar"></jg-select></jg-field>
        <jg-button slot="actions" variant="outline" id="cancel-event">${t('calendar.cancel', 'Cancel')}</jg-button>
        <jg-button slot="actions" id="add">${t('calendar.addEvent', 'Add event')}</jg-button>
      </jg-dialog>
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
    this.on(this.$('#add'), 'click', () => this.#saveEvent());
    this.on(this.$('#cancel-event'), 'click', () => this.$('#event-dialog').close());
    this.on(this.$('#title-input'), 'keydown', (event) => {
      if (event.key === 'Enter') this.#saveEvent();
    });

    this.on(this.$('#calendars'), 'click', () => {
      this.#renderCalendars();
      this.$('#calendar-sheet').open();
    });

    this.#renderTitle();
    this.#renderView();
    if (this.#view !== 'year') this.#renderSide();
  }

  #step(direction) {
    const cursor = this.#cursor;
    if (this.#view === 'day') {
      this.#cursor = addDays(cursor, direction);
      this.#selected = iso(this.#cursor);
    }
    if (this.#view === 'week') this.#cursor = addDays(cursor, direction * 7);
    if (this.#view === 'month') this.#cursor = new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
    if (this.#view === 'year') this.#cursor = new Date(cursor.getFullYear() + direction, cursor.getMonth(), 1);
    this.refresh();
  }

  #weekStart(date) {
    const offset = this.config.get('weekStart', 'mon') === 'mon' ? 1 : 0;
    return addDays(date, -((date.getDay() - offset + 7) % 7));
  }

  #dayNames(style = 'short') {
    const offset = this.config.get('weekStart', 'mon') === 'mon' ? 1 : 0;
    const base = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (unused, index) => {
      const date = addDays(base, index + offset);
      return { label: date.toLocaleDateString([], { weekday: style }), weekend: this.#isWeekend(date) };
    });
  }

  #renderTitle() {
    const cursor = this.#cursor;
    const node = this.$('#title');
    const showsToday =
      (this.#view === 'month' && cursor.getMonth() === new Date().getMonth() && cursor.getFullYear() === new Date().getFullYear()) ||
      (this.#view === 'year' && cursor.getFullYear() === new Date().getFullYear());

    let primary = '';
    let secondary = '';

    if (this.#view === 'day') {
      primary = cursor.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
      secondary = String(cursor.getFullYear());
    } else if (this.#view === 'week') {
      const start = this.#weekStart(cursor);
      const end = addDays(start, 6);
      primary = `${start.toLocaleDateString([], { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
      secondary = String(end.getFullYear());
    } else if (this.#view === 'month') {
      primary = cursor.toLocaleDateString([], { month: 'long' });
      secondary = String(cursor.getFullYear());
    } else {
      primary = String(cursor.getFullYear());
    }

    node.innerHTML = html`<span class="primary">${primary}</span>
      ${secondary ? html`<span class="secondary">${secondary}</span>` : ''}
      ${showsToday ? html`<span class="today-pill">${t('calendar.now', 'now')}</span>` : ''}`;
  }

  #chip(event) {
    const calendar = this.#calendar(event.calendarId);
    return html`<span class="chip" style="--chip:${calendar.color}" title="${event.title}">
      <i></i>${event.time ? html`<span class="at">${event.time}</span>` : ''}<span>${event.title}</span>
    </span>`;
  }

  #renderView() {
    const body = this.$('#body');
    clearInterval(this.#timer);
    if (this.#view === 'month') this.#month(body);
    if (this.#view === 'week') this.#timeGrid(body, 7);
    if (this.#view === 'day') this.#timeGrid(body, 1);
    if (this.#view === 'year') this.#year(body);
  }

  #select(key, { focusComposer = false, time = '' } = {}) {
    this.#selected = key;
    this.#prefill = time;
    const picked = parseIso(key);
    if (this.#view === 'month' && picked.getMonth() !== this.#cursor.getMonth()) this.#cursor = picked;
    this.#repaint();
    if (focusComposer) this.#openEvent(time);
  }

  #month(body) {
    const year = this.#cursor.getFullYear();
    const month = this.#cursor.getMonth();
    const start = this.#weekStart(new Date(year, month, 1));
    const today = iso(new Date());
    const weeks = Array.from({ length: 6 }, (unused, week) =>
      Array.from({ length: 7 }, (item, day) => addDays(start, week * 7 + day)),
    );

    body.innerHTML = html`
      <div class="surface">
        <div class="dows">
          ${this.#dayNames().map((day) => html`<div class="dow" data-weekend="${String(day.weekend)}">${day.label}</div>`)}
        </div>
        <div class="weeks">
          ${weeks.map(
            (week) => html`<div class="week">
              ${week.map((date) => {
                const key = iso(date);
                const events = this.#eventsFor(key);
                return html`<div
                  class="cell"
                  data-key="${key}"
                  data-outside="${String(date.getMonth() !== month)}"
                  data-weekend="${String(this.#isWeekend(date))}"
                  data-today="${String(key === today)}"
                  data-selected="${String(key === this.#selected)}"
                >
                  <span class="cell-head">
                    <span class="num">${date.getDate()}</span>
                    <button class="add" data-add="${key}" title="${t('calendar.addAnEvent', 'Add an event')}">＋</button>
                  </span>
                  ${events.slice(0, 3).map((event) => this.#chip(event))}
                  ${events.length > 3 ? html`<button class="more" data-open="${key}">+${events.length - 3} more</button>` : ''}
                </div>`;
              })}
            </div>`,
          )}
        </div>
      </div>
    `;

    this.bind('.cell', 'click', (event) => {
      if (event.target.closest('[data-add], [data-open]')) return;
      this.#select(event.currentTarget.dataset.key);
    });
    this.bind('[data-add]', 'click', (event) => {
      event.stopPropagation();
      this.#select(event.currentTarget.dataset.add, { focusComposer: true });
    });
    this.bind('[data-open]', 'click', (event) => {
      event.stopPropagation();
      this.#selected = event.currentTarget.dataset.open;
      this.#cursor = parseIso(this.#selected);
      this.#view = 'day';
      this.refresh();
    });
  }

  #timeGrid(body, days) {
    const start = days === 7 ? this.#weekStart(this.#cursor) : new Date(this.#cursor);
    const today = iso(new Date());
    const columns = Array.from({ length: days }, (unused, index) => addDays(start, index));
    const template = `56px repeat(${days}, minmax(0, 1fr))`;

    const allDay = columns.map((date) => this.#eventsFor(iso(date)).filter((event) => !event.time));
    const hasAllDay = allDay.some((list) => list.length);

    body.innerHTML = html`
      <div class="surface time-grid" style="--grid-min:${days === 7 ? 560 : 260}px">
        <div class="tg-scroll">
        <div class="tg-head" style="grid-template-columns:${template}">
          <span class="tg-corner"></span>
          ${columns.map((date) => {
            const key = iso(date);
            return html`<button class="tg-day" data-key="${key}" data-today="${String(key === today)}" data-selected="${String(key === this.#selected)}">
              <span class="d">${date.toLocaleDateString([], { weekday: 'short' })}</span>
              <span class="n">${date.getDate()}</span>
            </button>`;
          })}
        </div>

        ${hasAllDay
          ? html`<div class="allday" style="grid-template-columns:${template}">
              <span class="gutter">${t('calendar.allDay', 'all day')}</span>
              ${allDay.map((list) => html`<span class="lane">${list.map((event) => this.#chip(event))}</span>`)}
            </div>`
          : ''}

        <div class="tg-body" style="grid-template-columns:${template}">
          <div class="hours">
            ${Array.from({ length: 24 }, (unused, hour) => html`<div class="hour-label">${hour ? `${pad(hour)}:00` : ''}</div>`)}
          </div>
          <div class="daycols" style="grid-template-columns:repeat(${days}, minmax(0, 1fr));grid-column:2 / -1">
            ${columns.map((date) => {
              const key = iso(date);
              const timed = this.#eventsFor(key).filter((event) => event.time);
              const { placed, columns: lanes } = packLanes(timed);
              return html`<div
                class="col"
                data-key="${key}"
                data-today="${String(key === today)}"
                data-weekend="${String(this.#isWeekend(date))}"
                style="height:${24 * HOUR}px"
              >
                ${placed.map(({ event, from, to, lane }) => {
                  const calendar = this.#calendar(event.calendarId);
                  const width = 100 / lanes;
                  return html`<span
                    class="slot"
                    data-id="${event.id}"
                    style="--chip:${calendar.color};top:${(from / 60) * HOUR}px;height:${Math.max(18, ((to - from) / 60) * HOUR - 2)}px;left:calc(${lane * width}% + 3px);width:calc(${width}% - 6px)"
                    title="${event.title}"
                  >
                    <b>${event.title}</b>
                    <span class="at">${event.time}${event.end ? ` - ${event.end}` : ''}</span>
                  </span>`;
                })}
              </div>`;
            })}
          </div>
        </div>
        </div>
      </div>
    `;

    this.bind('.tg-day', 'click', (event) => {
      const key = event.currentTarget.dataset.key;
      if (days === 1) this.#cursor = parseIso(key);
      this.#select(key);
    });

    this.bind('.col', 'click', (event) => {
      if (event.target.closest('.slot')) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const hour = Math.floor((event.clientY - rect.top) / HOUR);
      this.#select(event.currentTarget.dataset.key, { focusComposer: true, time: `${pad(Math.min(23, hour))}:00` });
    });

    const scroller = body.querySelector('.tg-scroll');
    const header = body.querySelector('.tg-head');
    if (header) scroller.style.setProperty('--head-height', `${header.offsetHeight}px`);
    scroller.scrollTop = Math.max(0, (new Date().getHours() - 2) * HOUR);
    this.#paintNow(body, columns, today);
    this.#timer = setInterval(() => this.#paintNow(body, columns, today), 60000);
    this.track(() => clearInterval(this.#timer));
  }

  #paintNow(body, columns, today) {
    body.querySelectorAll('.now').forEach((node) => node.remove());
    const index = columns.findIndex((date) => iso(date) === today);
    if (index < 0) return;
    const column = body.querySelectorAll('.col')[index];
    if (!column) return;
    const now = new Date();
    const line = document.createElement('span');
    line.className = 'now';
    line.style.top = `${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR}px`;
    column.append(line);
  }

  #year(body) {
    const year = this.#cursor.getFullYear();
    const today = iso(new Date());
    const names = this.#dayNames('narrow');

    body.innerHTML = html`
      <div class="year">
        ${Array.from({ length: 12 }, (unused, month) => {
          const first = new Date(year, month, 1);
          const start = this.#weekStart(first);
          return html`<div class="mini">
            <h4 data-month="${month}">${first.toLocaleDateString([], { month: 'long' })}</h4>
            <div class="cells">
              ${names.map((day) => html`<span class="cell-mini head-mini">${day.label}</span>`)}
              ${Array.from({ length: 42 }, (item, index) => {
                const date = addDays(start, index);
                const key = iso(date);
                return html`<button
                  class="cell-mini"
                  data-key="${key}"
                  data-in="${String(date.getMonth() === month)}"
                  data-today="${String(key === today)}"
                  data-has="${String(this.#eventsFor(key).length > 0)}"
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

    this.bind('.cell-mini[data-key]', 'click', (event) => {
      this.#selected = event.currentTarget.dataset.key;
      this.#cursor = parseIso(this.#selected);
      this.#view = 'day';
      this.refresh();
    });
  }

  #repaint() {
    this.#renderTitle();
    this.#renderView();
    this.#renderSide();
    this.#renderCalendars();
  }

  #openEvent(prefill = '') {
    const dialog = this.$('#event-dialog');
    const data = this.#data();
    const selected = parseIso(this.#selected);
    const end = prefill ? `${pad(Math.min(23, Number(prefill.slice(0, 2)) + 1))}:00` : '';

    dialog.setAttribute('sub', selected.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }));
    this.$('#title-input').value = '';
    this.$('#from').value = prefill;
    this.$('#to').value = end;
    this.$('#calendar').options = data.calendars.map((calendar) => ({ value: calendar.id, label: calendar.name }));
    this.$('#calendar').value = data.calendars[0]?.id ?? '';
    dialog.open();
  }

  #saveEvent() {
    const title = this.$('#title-input').value.trim();
    if (!title) return;

    const next = this.#data();
    const list = next.events[this.#selected] ?? [];
    next.events[this.#selected] = [
      ...list,
      {
        id: uid().slice(0, 8),
        title,
        time: this.$('#from').value,
        end: this.$('#to').value,
        calendarId: this.$('#calendar').value,
      },
    ];

    this.#save(next);
    this.#prefill = '';
    this.$('#event-dialog').close('saved');
    this.#repaint();
  }

  #renderCalendars() {
    const data = this.#data();
    const sheet = this.$('#calendar-sheet');
    const list = this.$('#calendar-list');

    list.innerHTML = html`
      <div class="label">${t('calendar.calendars', 'Calendars')}</div>
      <div>
        ${data.calendars.map(
          (calendar) => html`<div class="cal-row">
            <span class="swatch" style="background:${calendar.color}"></span>
            <span class="cal-name">${calendar.name}</span>
            <jg-switch data-toggle="${calendar.id}" ${calendar.visible ? 'checked' : ''}></jg-switch>
            <jg-button size="icon-sm" variant="ghost" data-delcal="${calendar.id}">✕</jg-button>
          </div>`,
        )}
      </div>
      <div class="row tight nowrap">
        <jg-input id="calname" class="grow" placeholder="${t('calendar.newCalendar', 'New calendar')}"></jg-input>
        <jg-input id="calcolor" type="color" value="#f97316" style="width:52px"></jg-input>
        <jg-button size="sm" id="addcal">${t('calendar.add', 'Add')}</jg-button>
      </div>
      <div class="sep"></div>
      <div class="label">${t('calendar.subscriptions', 'Subscriptions')}</div>
      <div>
        ${HOLIDAY_SETS.map(
          (set) => html`<div class="cal-row">
            <span class="swatch" style="background:${set.color}"></span>
            <span class="cal-name">${set.name}</span>
            <jg-switch data-sub="${set.id}" ${data.subscriptions.includes(set.id) ? 'checked' : ''}></jg-switch>
          </div>`,
        )}
      </div>
    `;

    list.querySelectorAll('[data-toggle]').forEach((node) =>
      this.on(node, 'change', (event) => {
        const next = this.#data();
        next.calendars = next.calendars.map((calendar) =>
          calendar.id === node.dataset.toggle ? { ...calendar, visible: event.detail.checked } : calendar,
        );
        this.#save(next);
        this.#repaint();
      }),
    );

    list.querySelectorAll('[data-sub]').forEach((node) =>
      this.on(node, 'change', (event) => {
        const next = this.#data();
        next.subscriptions = event.detail.checked
          ? [...new Set([...next.subscriptions, node.dataset.sub])]
          : next.subscriptions.filter((item) => item !== node.dataset.sub);
        this.#save(next);
        this.#repaint();
      }),
    );
    list.querySelectorAll('[data-delcal]').forEach((node) =>
      this.on(node, 'click', () => {
        const next = this.#data();
        next.calendars = next.calendars.filter((calendar) => calendar.id !== node.dataset.delcal);
        Object.keys(next.events).forEach((key) => {
          next.events[key] = next.events[key].filter((item) => item.calendarId !== node.dataset.delcal);
          if (!next.events[key].length) delete next.events[key];
        });
        this.#save(next);
        this.#repaint();
      }),
    );
    const addCal = list.querySelector('#addcal');
    if (addCal) {
      this.on(addCal, 'click', () => {
        const name = list.querySelector('#calname').value.trim();
        if (!name) return;
        const next = this.#data();
        next.calendars = [
          ...next.calendars,
          { id: uid().slice(0, 6), name, color: list.querySelector('#calcolor').value, visible: true },
        ];
        this.#save(next);
        this.#repaint();
      });
    }
  }

  #renderSide() {
    const side = this.$('#side');
    if (!side) return;
    const data = this.#data();
    const events = this.#eventsFor(this.#selected);
    const selected = parseIso(this.#selected);

    side.innerHTML = html`
      <jg-card>
        <div class="side-head">
          <span class="day">${selected.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span class="rel">${relativeLabel(this.#selected)}</span>
        </div>

        <jg-button id="new-event" full>${t('calendar.addAnEvent', 'Add an event')}</jg-button>

        <div class="agenda">
          ${events.length
            ? events.map((event) => {
                const calendar = this.#calendar(event.calendarId);
                return html`<div class="event" style="--chip:${calendar.color}">
                  <span class="when">${event.time ? html`${event.time}${event.end ? html`<br />${event.end}` : ''}` : 'all day'}</span>
                  <span>
                    <span class="name">${event.title}</span>
                    <span class="cal">${calendar.name}</span>
                  </span>
                  ${event.readonly ? '' : html`<jg-button class="del" size="icon-sm" variant="ghost" data-remove="${event.id}">✕</jg-button>`}
                </div>`;
              })
            : html`<jg-empty glyph="▤" title="${t('calendar.nothingPlanned', 'Nothing planned')}">${t('calendar.pickATimeAboveOr', 'Pick a time above or click a slot in the week view.')}</jg-empty>`}
        </div>
      </jg-card>
    `;

    this.on(side.querySelector('#new-event'), 'click', () => this.#openEvent());

    side.querySelectorAll('[data-remove]').forEach((node) =>
      this.on(node, 'click', () => {
        const next = this.#data();
        next.events[this.#selected] = (next.events[this.#selected] ?? []).filter((item) => item.id !== node.dataset.remove);
        if (!next.events[this.#selected].length) delete next.events[this.#selected];
        this.#save(next);
        this.refresh();
      }),
    );
  }
}

define('jg-app-calendar', CalendarApp);
