import { JGApp, define, html, css } from '../core/app.js';

const sheet = css`
  .face { display: grid; gap: 4px; justify-items: center; padding: 6px 0 2px; }
  .time { font: 600 clamp(30px, 8vw, 54px)/1 var(--font-sans); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .sub { font-size: 13px; color: var(--muted-foreground); }
  .zones { display: grid; gap: 8px; }
  .zone {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--card);
  }
  .zone .city { font-size: 13.5px; font-weight: 500; }
  .zone .offset { font-size: 11.5px; color: var(--muted-foreground); }
  .zone .t { margin-left: auto; font: 600 17px/1 var(--font-mono); font-variant-numeric: tabular-nums; }
  .zone .del { opacity: 0; }
  .zone:hover .del { opacity: 1; }
  .digits { font: 600 clamp(28px, 7vw, 46px)/1 var(--font-mono); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .laps { max-height: 190px; overflow: auto; }
  .lap { display: flex; justify-content: space-between; padding: 6px 8px; border-bottom: 1px solid var(--border); font-family: var(--font-mono); font-size: 12.5px; }
  .widget-face { display: grid; gap: 2px; align-content: center; height: 100%; padding: 0 12px 12px; }
  .widget-time { font: 600 30px/1 var(--font-sans); letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .ring { display: grid; place-items: center; }
`;

const ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tehran',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const pad = (value, size = 2) => String(value).padStart(size, '0');

const formatDuration = (ms) => {
  const total = Math.max(0, Math.floor(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const centis = Math.floor((total % 1000) / 10);
  return `${hours ? `${pad(hours)}:` : ''}${pad(minutes)}:${pad(seconds)}.${pad(centis)}`;
};

const offsetLabel = (zone) => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(now);
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
};

class ClockApp extends JGApp {
  static appId = 'clock';
  static styles = [...JGApp.styles, sheet];

  #tab = 'world';
  #timer = null;
  #watch = { running: false, elapsed: 0, since: 0, laps: [] };
  #timerState = { running: false, remaining: 0, endsAt: 0, duration: 300000 };

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.#timer);
  }

  #options() {
    return {
      hour12: this.config.get('hour12', false),
      hour: '2-digit',
      minute: '2-digit',
      ...(this.config.get('seconds', true) ? { second: '2-digit' } : {}),
    };
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:0">
      <div class="widget-face">
        <div class="widget-time" id="wt"></div>
        <div class="sub" id="wd"></div>
      </div>
    </div>`);
    const tick = () => {
      const now = new Date();
      const time = this.$('#wt');
      if (!time) return;
      time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: this.config.get('hour12', false) });
      this.$('#wd').textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    };
    tick();
    clearInterval(this.#timer);
    this.#timer = setInterval(tick, 1000);
    this.track(() => clearInterval(this.#timer));
  }

  renderApp() {
    this.paint(html`<div class="app">
      <jg-tabs id="tabs" full></jg-tabs>
      <div id="body" class="fill"></div>
    </div>`);
    this.$('#tabs').items = [
      { value: 'world', label: 'World Clock' },
      { value: 'stopwatch', label: 'Stopwatch' },
      { value: 'timer', label: 'Timer' },
    ];
    this.$('#tabs').value = this.#tab;
    this.on(this.$('#tabs'), 'change', (event) => {
      this.#tab = event.detail.value;
      this.#renderTab();
    });
    this.#renderTab();
  }

  #renderTab() {
    clearInterval(this.#timer);
    const body = this.$('#body');
    if (this.#tab === 'world') this.#world(body);
    if (this.#tab === 'stopwatch') this.#stopwatch(body);
    if (this.#tab === 'timer') this.#countdown(body);
  }

  #saved() {
    return this.store.read({ zones: ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'] });
  }

  #world(body) {
    const state = this.#saved();
    body.innerHTML = html`
      <div class="face">
        <div class="time" id="local"></div>
        <div class="sub" id="localdate"></div>
      </div>
      <div class="row nowrap">
        <jg-select id="zone" class="grow">
          ${ZONES.map((zone) => html`<option value="${zone}">${zone.replace(/_/g, ' ')}</option>`)}
        </jg-select>
        <jg-button id="add" variant="secondary">Add</jg-button>
      </div>
      <div class="zones" id="zones"></div>
    `;
    this.on(body.querySelector('#add'), 'click', () => {
      const zone = body.querySelector('#zone').value;
      const next = [...new Set([...state.zones, zone])];
      this.store.write({ zones: next });
      this.#renderTab();
    });

    const paint = () => {
      const now = new Date();
      const local = body.querySelector('#local');
      if (!local) return;
      local.textContent = now.toLocaleTimeString([], this.#options());
      body.querySelector('#localdate').textContent = `${now.toLocaleDateString([], {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
      body.querySelector('#zones').innerHTML = html`
        ${state.zones.map((zone) => {
          const time = now.toLocaleTimeString([], { ...this.#options(), timeZone: zone });
          const day = now.toLocaleDateString([], { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short' });
          return html`<div class="zone">
            <div>
              <div class="city">${zone.split('/').pop().replace(/_/g, ' ')}</div>
              <div class="offset">${day} · ${offsetLabel(zone)}</div>
            </div>
            <div class="t">${time}</div>
            <jg-button class="del" size="icon-sm" variant="ghost" data-zone="${zone}">✕</jg-button>
          </div>`;
        })}
      `;
      body.querySelectorAll('[data-zone]').forEach((node) =>
        node.addEventListener('click', () => {
          this.store.write({ zones: state.zones.filter((zone) => zone !== node.dataset.zone) });
          this.#renderTab();
        }),
      );
    };
    paint();
    this.#timer = setInterval(paint, 1000);
    this.track(() => clearInterval(this.#timer));
  }

  #stopwatch(body) {
    body.innerHTML = html`
      <div class="face"><div class="digits" id="digits">00:00.00</div></div>
      <div class="row" style="justify-content:center">
        <jg-button id="toggle">${this.#watch.running ? 'Pause' : 'Start'}</jg-button>
        <jg-button id="lap" variant="secondary">Lap</jg-button>
        <jg-button id="reset" variant="outline">Reset</jg-button>
      </div>
      <div class="laps panel flush" id="laps"></div>
    `;

    const total = () => this.#watch.elapsed + (this.#watch.running ? Date.now() - this.#watch.since : 0);
    const paint = () => {
      const digits = body.querySelector('#digits');
      if (digits) digits.textContent = formatDuration(total());
    };
    const paintLaps = () => {
      body.querySelector('#laps').innerHTML = this.#watch.laps.length
        ? this.#watch.laps
            .map((lap, index) => html`<div class="lap"><span>Lap ${this.#watch.laps.length - index}</span><span>${formatDuration(lap)}</span></div>`)
            .join('')
        : html`<div class="lap muted"><span>No laps recorded</span></div>`;
    };

    this.on(body.querySelector('#toggle'), 'click', () => {
      if (this.#watch.running) {
        this.#watch.elapsed = total();
        this.#watch.running = false;
      } else {
        this.#watch.since = Date.now();
        this.#watch.running = true;
      }
      this.#renderTab();
    });
    this.on(body.querySelector('#lap'), 'click', () => {
      this.#watch.laps = [total(), ...this.#watch.laps].slice(0, 50);
      paintLaps();
    });
    this.on(body.querySelector('#reset'), 'click', () => {
      this.#watch = { running: false, elapsed: 0, since: 0, laps: [] };
      this.#renderTab();
    });

    paint();
    paintLaps();
    this.#timer = setInterval(paint, 33);
    this.track(() => clearInterval(this.#timer));
  }

  #countdown(body) {
    const remaining = () =>
      this.#timerState.running ? Math.max(0, this.#timerState.endsAt - Date.now()) : this.#timerState.remaining;

    body.innerHTML = html`
      <div class="face"><div class="digits" id="digits">${formatDuration(remaining())}</div></div>
      <div class="row" style="justify-content:center">
        ${[1, 5, 10, 25].map((minutes) => html`<jg-button size="sm" variant="outline" data-minutes="${minutes}">${minutes}m</jg-button>`)}
      </div>
      <div class="row nowrap">
        <jg-input id="mins" type="number" min="0" max="600" value="${Math.round(this.#timerState.duration / 60000)}" suffix="min" class="grow"></jg-input>
        <jg-button id="toggle">${this.#timerState.running ? 'Pause' : 'Start'}</jg-button>
        <jg-button id="reset" variant="outline">Reset</jg-button>
      </div>
      <div class="hint">The timer keeps running while other apps are open.</div>
    `;

    body.querySelectorAll('[data-minutes]').forEach((node) =>
      this.on(node, 'click', () => {
        this.#timerState = {
          running: true,
          duration: Number(node.dataset.minutes) * 60000,
          remaining: Number(node.dataset.minutes) * 60000,
          endsAt: Date.now() + Number(node.dataset.minutes) * 60000,
        };
        this.#renderTab();
      }),
    );

    this.on(body.querySelector('#toggle'), 'click', () => {
      if (this.#timerState.running) {
        this.#timerState = { ...this.#timerState, running: false, remaining: remaining() };
      } else {
        const minutes = Number(body.querySelector('#mins').value) || 0;
        const span = this.#timerState.remaining || minutes * 60000;
        this.#timerState = { ...this.#timerState, running: true, remaining: span, endsAt: Date.now() + span };
      }
      this.#renderTab();
    });

    this.on(body.querySelector('#reset'), 'click', () => {
      const minutes = Number(body.querySelector('#mins').value) || 5;
      this.#timerState = { running: false, remaining: minutes * 60000, endsAt: 0, duration: minutes * 60000 };
      this.#renderTab();
    });

    const paint = () => {
      const digits = body.querySelector('#digits');
      if (!digits) return;
      const value = remaining();
      digits.textContent = formatDuration(value);
      if (this.#timerState.running && value === 0) {
        this.#timerState = { ...this.#timerState, running: false, remaining: 0 };
        this.#renderTab();
      }
    };
    paint();
    this.#timer = setInterval(paint, 100);
    this.track(() => clearInterval(this.#timer));
  }
}

define('jg-app-clock', ClockApp);
