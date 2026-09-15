import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { uid } from '../../core/util.js';
import { compareSpeeds, averageSpeed, travelTime, speedFor, formatHours, parseDuration } from '../../lib/journey.js';

const t = await appWords('journey-speed', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const DEFAULTS = {
  tab: 'compare',
  unit: 'km',
  distance: 300,
  from: 110,
  to: 130,
  breaks: 0,
  leave: '08:00',
  legs: [
    { id: 'a', distance: 40, mode: 'time', value: '0:45' },
    { id: 'b', distance: 220, mode: 'speed', value: '120' },
    { id: 'c', distance: 25, mode: 'time', value: '0:35' },
  ],
  legBreaks: 20,
  remaining: 180,
  available: '2:00',
};

const number = (value, digits = 0) => new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
const percent = (value) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value) * 100, Math.abs(value) < 0.1 ? 1 : 0)}%`;

const arrival = (leave, hours) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(leave ?? '');
  if (!match || !Number.isFinite(hours)) return '';
  const minutes = Number(match[1]) * 60 + Number(match[2]) + Math.round(hours * 60);
  const day = Math.floor(minutes / 1440);
  const clock = `${String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')}:${String((minutes % 1440) % 60).padStart(2, '0')}`;
  return day ? `${clock} +${day}` : clock;
};

class JourneySpeed extends JGApp {
  static appId = 'journey-speed';
  static styles = [...JGApp.styles, sheet];

  #state = null;

  get #speedUnit() {
    return this.#state.unit === 'mi' ? t('journey-speed.mph', 'mph') : t('journey-speed.kmh', 'km/h');
  }

  get #distanceUnit() {
    return this.#state.unit === 'mi' ? t('journey-speed.mi', 'mi') : t('journey-speed.km', 'km');
  }

  renderApp() {
    this.#state = { ...DEFAULTS, ...this.store.read({}) };
    const state = this.#state;
    this.paint(html`<div class="app">
      <div class="top">
        <jg-tabs id="tab" value="${state.tab}">
          <option value="compare">${t('journey-speed.compareSpeeds', 'Compare speeds')}</option>
          <option value="average">${t('journey-speed.averageSpeed', 'Average speed')}</option>
        </jg-tabs>
        <jg-tabs id="unit" value="${state.unit}">
          <option value="km">${t('journey-speed.kilometres', 'Kilometres')}</option>
          <option value="mi">${t('journey-speed.miles', 'Miles')}</option>
        </jg-tabs>
      </div>
      <div id="page"></div>
    </div>`);
    this.on(this.$('#tab'), 'change', (event) => {
      this.#save({ tab: event.detail.value });
      this.#paintPage();
    });
    this.on(this.$('#unit'), 'change', (event) => {
      this.#save({ unit: event.detail.value });
      this.#paintPage();
    });
    this.#paintPage();
  }

  #save(patch) {
    Object.assign(this.#state, patch);
    this.store.write(this.#state);
  }

  #paintPage() {
    if (this.#state.tab === 'average') this.#paintAverage();
    else this.#paintCompare();
  }

  // ---- compare ---------------------------------------------------------

  #paintCompare() {
    const state = this.#state;
    const speed = this.#speedUnit;
    this.$('#page').innerHTML = html`<div class="stack page">
      <div class="inputs">
        <jg-field label="${t('journey-speed.distance', 'Distance')}"><jg-input id="distance" type="number" min="0" step="any" suffix="${this.#distanceUnit}" value="${state.distance}"></jg-input></jg-field>
        <jg-field label="${t('journey-speed.usualSpeed', 'Usual speed')}"><jg-input id="from" type="number" min="1" step="any" suffix="${speed}" value="${state.from}"></jg-input></jg-field>
        <jg-field label="${t('journey-speed.fasterSpeed', 'Other speed')}"><jg-input id="to" type="number" min="1" step="any" suffix="${speed}" value="${state.to}"></jg-input></jg-field>
        <jg-field label="${t('journey-speed.breaks', 'Breaks')}"><jg-input id="breaks" type="number" min="0" step="5" suffix="${t('journey-speed.min', 'min')}" value="${state.breaks}"></jg-input></jg-field>
        <jg-field label="${t('journey-speed.leaveAt', 'Leave at')}"><jg-input id="leave" type="time" value="${state.leave}"></jg-input></jg-field>
      </div>
      <div class="slider-row">
        <span class="label">${t('journey-speed.otherSpeed', 'Other speed')}</span>
        <jg-slider id="to-slider" min="${state.unit === 'mi' ? 20 : 30}" max="${state.unit === 'mi' ? 120 : 200}" step="1" value="${state.to}"></jg-slider>
      </div>
      <div id="compare-out"></div>
    </div>`;
    const read = () => ({
      distance: Number(this.$('#distance').value) || 0,
      from: Number(this.$('#from').value) || 0,
      to: Number(this.$('#to').value) || 0,
      breaks: Number(this.$('#breaks').value) || 0,
      leave: this.$('#leave').value,
    });
    for (const id of ['distance', 'from', 'to', 'breaks', 'leave']) {
      this.on(this.$(`#${id}`), 'input', () => {
        this.#save(read());
        if (id === 'to') this.$('#to-slider').value = this.#state.to;
        this.#paintCompareOut();
      });
    }
    this.on(this.$('#to-slider'), 'input', (event) => {
      this.$('#to').value = String(event.detail.value);
      this.#save(read());
      this.#paintCompareOut();
    });
    this.#paintCompareOut();
  }

  #paintCompareOut() {
    const { distance, from, to, breaks, leave, unit } = this.#state;
    const out = this.$('#compare-out');
    if (!(distance > 0 && from > 0 && to > 0)) {
      out.innerHTML = html`<jg-empty glyph="⏱" title="${t('journey-speed.enterADistanceAndTwo', 'Enter a distance and two speeds')}"></jg-empty>`;
      return;
    }
    const speed = this.#speedUnit;
    const result = compareSpeeds({ distance, from, to, breaks: breaks / 60, unit });
    const faster = to >= from;
    const saved = Math.abs(result.saved);
    const hero = faster
      ? t('journey-speed.youSave', 'You save {time}', { time: formatHours(saved) })
      : t('journey-speed.youLose', 'It takes {time} longer', { time: formatHours(saved) });
    out.innerHTML = html`<div class="stack">
      <div class="cards">
        <div class="card">
          <span class="card-label">${t('journey-speed.atSpeed', 'At {speed}', { speed: `${number(from, 1)} ${speed}` })}</span>
          <span class="card-value">${formatHours(result.slow)}</span>
          ${leave ? html`<span class="card-sub">${t('journey-speed.arriveAt', 'Arrive at {time}', { time: arrival(leave, result.slow) })}</span>` : ''}
        </div>
        <div class="card">
          <span class="card-label">${t('journey-speed.atSpeed', 'At {speed}', { speed: `${number(to, 1)} ${speed}` })}</span>
          <span class="card-value">${formatHours(result.fast)}</span>
          ${leave ? html`<span class="card-sub">${t('journey-speed.arriveAt', 'Arrive at {time}', { time: arrival(leave, result.fast) })}</span>` : ''}
        </div>
        <div class="card highlight" data-tone="${faster ? 'good' : 'bad'}">
          <span class="card-label">${faster ? t('journey-speed.timeSaved', 'Time saved') : t('journey-speed.timeLost', 'Time lost')}</span>
          <span class="card-value">${formatHours(saved)}</span>
          <span class="card-sub">${t('journey-speed.speedVsTime', '{speed} speed, {time} time', { speed: percent(result.speedChange), time: percent(result.timeChange) })}</span>
        </div>
      </div>
      <div class="insight">
        <p><strong>${hero}</strong> ${t('journey-speed.overDistance', 'over {distance}.', { distance: `${number(distance, 1)} ${this.#distanceUnit}` })}
        ${faster && result.minutesPerHour > 0 ? t('journey-speed.everyHourSaves', 'Each hour driven at {to} instead of {from} saves only {minutes} minutes.', { to: `${number(to, 1)} ${speed}`, from: `${number(from, 1)} ${speed}`, minutes: number(result.minutesPerHour, 1) }) : ''}</p>
        <p class="muted">${result.fuelChange >= 0
          ? t('journey-speed.fuelMore', 'The faster pace burns roughly {change} more fuel per {unit}, a rough figure for a typical car.', { change: percent(result.fuelChange).replace('+', ''), unit: this.#distanceUnit })
          : t('journey-speed.fuelLess', 'The slower pace burns roughly {change} less fuel per {unit}, a rough figure for a typical car.', { change: percent(result.fuelChange).replace('−', ''), unit: this.#distanceUnit })}</p>
      </div>
      <div class="panel chart-panel">${raw(this.#chart(distance, from, to, breaks / 60))}</div>
      <div class="panel flush">
        <table class="speeds">
          <thead><tr><th>${t('journey-speed.speed', 'Speed')}</th><th>${t('journey-speed.journeyTime', 'Journey time')}</th><th>${t('journey-speed.vsUsual', 'Compared with usual')}</th></tr></thead>
          <tbody>${this.#ladder(from, to).map((value) => {
            const hours = travelTime(distance, value) + breaks / 60;
            const change = result.slow - hours;
            return html`<tr data-current="${String(value === from || value === to)}">
              <td>${number(value, 1)} ${speed}</td>
              <td>${formatHours(hours)}</td>
              <td class="${change > 0.0001 ? 'good' : change < -0.0001 ? 'bad' : 'muted'}">${Math.abs(change) < 0.0001 ? '—' : change > 0 ? `−${formatHours(change)}` : `+${formatHours(-change)}`}</td>
            </tr>`;
          })}</tbody>
        </table>
      </div>
    </div>`;
  }

  #ladder(from, to) {
    const step = this.#state.unit === 'mi' ? 5 : 10;
    const low = Math.max(step, Math.floor((Math.min(from, to) - step * 3) / step) * step);
    const high = Math.ceil((Math.max(from, to) + step * 3) / step) * step;
    const values = new Set([from, to]);
    for (let value = low; value <= high; value += step) values.add(value);
    return [...values].filter((value) => value > 0).sort((a, b) => a - b);
  }

  #chart(distance, from, to, breaks) {
    const width = 760;
    const height = 230;
    const pad = { left: 52, right: 16, top: 14, bottom: 30 };
    const low = Math.max(5, Math.min(from, to) * 0.5);
    const high = Math.max(from, to) * 1.4;
    const time = (speed) => travelTime(distance, speed) + breaks;
    const top = time(low);
    const bottom = time(high);
    const x = (speed) => pad.left + ((speed - low) / (high - low)) * (width - pad.left - pad.right);
    const y = (hours) => pad.top + ((top - hours) / (top - bottom || 1)) * (height - pad.top - pad.bottom);
    const points = Array.from({ length: 80 }, (_, index) => low + ((high - low) * index) / 79);
    const curve = points.map((speed, index) => `${index ? 'L' : 'M'}${x(speed).toFixed(1)} ${y(time(speed)).toFixed(1)}`).join('');
    const [a, b] = [Math.min(from, to), Math.max(from, to)];
    const band = `M${x(a).toFixed(1)} ${(height - pad.bottom).toFixed(1)}` + points.filter((speed) => speed >= a && speed <= b).concat([b]).map((speed) => `L${x(speed).toFixed(1)} ${y(time(speed)).toFixed(1)}`).join('') + `L${x(b).toFixed(1)} ${height - pad.bottom}Z`;
    const step = (high - low) / 6 > 15 ? 20 : (high - low) / 6 > 7 ? 10 : 5;
    const speedTicks = [];
    for (let speed = Math.ceil(low / step) * step; speed <= high; speed += step) speedTicks.push(speed);
    const timeTicks = Array.from({ length: 4 }, (_, index) => bottom + ((top - bottom) * index) / 3);
    const clock = (hours) => {
      const minutes = Math.round(hours * 60);
      return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
    };
    const marker = (speed, tone) => `<line x1="${x(speed)}" x2="${x(speed)}" y1="${y(time(speed))}" y2="${height - pad.bottom}" class="guide ${tone}"/><circle cx="${x(speed)}" cy="${y(time(speed))}" r="5" class="dot ${tone}"/>`;
    const escape = (text) => String(text).replace(/[<&>]/g, '');
    return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(t('journey-speed.journeyTimeBySpeed', 'Journey time by speed'))}">
      ${timeTicks.map((hours) => `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y(hours)}" y2="${y(hours)}" class="grid"/><text x="${pad.left - 8}" y="${y(hours) + 4}" text-anchor="end" class="axis">${clock(hours)}</text>`).join('')}
      ${speedTicks.map((speed) => `<text x="${x(speed)}" y="${height - 12}" text-anchor="middle" class="axis">${number(speed)}</text>`).join('')}
      <path d="${band}" class="band"/>
      <path d="${curve}" class="curve"/>
      ${marker(from, 'usual')}${marker(to, 'other')}
    </svg>`;
  }

  // ---- average ---------------------------------------------------------

  #paintAverage() {
    const state = this.#state;
    this.$('#page').innerHTML = html`<div class="stack page">
      <div class="panel flush">
        <div class="legs-head">
          <span>${t('journey-speed.leg', 'Leg')}</span>
          <span>${t('journey-speed.distance', 'Distance')}</span>
          <span>${t('journey-speed.enteredAs', 'Entered as')}</span>
          <span>${t('journey-speed.timeOrSpeed', 'Time or speed')}</span>
          <span class="right">${t('journey-speed.legSpeed', 'Leg speed')}</span>
          <span></span>
        </div>
        <div id="legs"></div>
        <div class="legs-foot">
          <jg-button size="sm" variant="ghost" id="add-leg">+ ${t('journey-speed.addLeg', 'Add leg')}</jg-button>
          <span class="grow"></span>
          <span class="label">${t('journey-speed.breaks', 'Breaks')}</span>
          <jg-input id="leg-breaks" type="number" min="0" step="5" suffix="${t('journey-speed.min', 'min')}" value="${state.legBreaks}" style="width:130px"></jg-input>
        </div>
      </div>
      <div id="average-out"></div>
      <jg-card title="${t('journey-speed.speedNeeded', 'Speed needed')}" sub="${t('journey-speed.howFastToArriveOnTime', 'How fast you would have to average to arrive in time')}">
        <div class="inputs two">
          <jg-field label="${t('journey-speed.distanceLeft', 'Distance left')}"><jg-input id="remaining" type="number" min="0" step="any" suffix="${this.#distanceUnit}" value="${state.remaining}"></jg-input></jg-field>
          <jg-field label="${t('journey-speed.timeAvailable', 'Time available')}"><jg-input id="available" value="${state.available}" placeholder="2:15" suffix="h:mm"></jg-input></jg-field>
        </div>
        <div id="needed" class="needed"></div>
      </jg-card>
    </div>`;
    this.on(this.$('#add-leg'), 'click', () => {
      this.#save({ legs: [...this.#state.legs, { id: uid().slice(0, 8), distance: '', mode: 'time', value: '' }] });
      this.#paintLegs();
      this.#paintAverageOut();
      this.$$('.leg input[data-field="distance"]').pop()?.focus();
    });
    this.on(this.$('#leg-breaks'), 'input', (event) => {
      this.#save({ legBreaks: Number(event.detail.value) || 0 });
      this.#paintAverageOut();
    });
    for (const id of ['remaining', 'available']) {
      this.on(this.$(`#${id}`), 'input', () => {
        this.#save({ remaining: Number(this.$('#remaining').value) || 0, available: this.$('#available').value });
        this.#paintNeeded();
      });
    }
    this.#paintLegs();
    this.#paintAverageOut();
    this.#paintNeeded();
  }

  #legHours(leg) {
    const distance = Number(leg.distance) || 0;
    if (leg.mode === 'speed') return travelTime(distance, Number(leg.value));
    return parseDuration(leg.value);
  }

  #paintLegs() {
    const holder = this.$('#legs');
    const speed = this.#speedUnit;
    holder.innerHTML = this.#state.legs
      .map((leg, index) => {
        const hours = this.#legHours(leg);
        const legSpeed = Number(leg.distance) > 0 && hours > 0 && Number.isFinite(hours) ? speedFor(Number(leg.distance), hours) : null;
        return html`<div class="leg" data-id="${leg.id}">
          <span class="leg-number">${index + 1}</span>
          <label class="cell"><input data-field="distance" type="number" min="0" step="any" value="${leg.distance}" placeholder="0" /><span>${this.#distanceUnit}</span></label>
          <select data-field="mode">
            <option value="time" ${leg.mode === 'time' ? raw('selected') : ''}>${t('journey-speed.time', 'Time')}</option>
            <option value="speed" ${leg.mode === 'speed' ? raw('selected') : ''}>${t('journey-speed.speed', 'Speed')}</option>
          </select>
          <label class="cell"><input data-field="value" value="${leg.value}" placeholder="${leg.mode === 'speed' ? '100' : '1:30'}" /><span>${leg.mode === 'speed' ? speed : 'h:mm'}</span></label>
          <span class="leg-speed right">${legSpeed ? `${number(legSpeed, 1)} ${speed}` : '—'}${leg.mode === 'speed' && Number.isFinite(hours) && hours > 0 ? html`<small>${formatHours(hours)}</small>` : ''}</span>
          <button class="remove" data-remove title="${t('journey-speed.removeLeg', 'Remove leg')}" aria-label="${t('journey-speed.removeLeg', 'Remove leg')}">×</button>
        </div>`;
      })
      .join('');
    holder.querySelectorAll('.leg').forEach((row) => {
      const leg = () => this.#state.legs.find((item) => item.id === row.dataset.id);
      row.querySelectorAll('[data-field]').forEach((input) => {
        const update = (event) => {
          const target = leg();
          if (!target) return;
          target[input.dataset.field] = input.value;
          this.#save({ legs: this.#state.legs });
          if (event.type === 'change' && input.dataset.field === 'mode') {
            target.value = '';
            this.#save({ legs: this.#state.legs });
            this.#paintLegs();
          } else {
            this.#paintLegSpeed(row, target);
          }
          this.#paintAverageOut();
        };
        this.on(input, input.tagName === 'SELECT' ? 'change' : 'input', update);
      });
      this.on(row.querySelector('[data-remove]'), 'click', () => {
        this.#save({ legs: this.#state.legs.filter((item) => item.id !== row.dataset.id) });
        this.#paintLegs();
        this.#paintAverageOut();
      });
    });
  }

  #paintLegSpeed(row, leg) {
    const hours = this.#legHours(leg);
    const speed = this.#speedUnit;
    const holder = row.querySelector('.leg-speed');
    const valid = Number(leg.distance) > 0 && hours > 0 && Number.isFinite(hours);
    holder.innerHTML = valid
      ? html`${number(speedFor(Number(leg.distance), hours), 1)} ${speed}${leg.mode === 'speed' ? html`<small>${formatHours(hours)}</small>` : ''}`
      : '—';
  }

  #paintAverageOut() {
    const state = this.#state;
    const legs = state.legs.map((leg) => ({ distance: Number(leg.distance), hours: this.#legHours(leg) }));
    const result = averageSpeed(legs, (Number(state.legBreaks) || 0) / 60);
    const out = this.$('#average-out');
    const speed = this.#speedUnit;
    if (!result.legs) {
      out.innerHTML = html`<jg-empty glyph="⏱" title="${t('journey-speed.addALeg', 'Add a leg with a distance and a time or speed')}"></jg-empty>`;
      return;
    }
    const misleading = result.legs > 1 && Math.abs(result.naive - result.moving) >= 0.5;
    out.innerHTML = html`<div class="stack">
      <div class="cards four">
        <div class="card"><span class="card-label">${t('journey-speed.totalDistance', 'Total distance')}</span><span class="card-value">${number(result.distance, 1)} <small>${this.#distanceUnit}</small></span></div>
        <div class="card"><span class="card-label">${t('journey-speed.drivingTime', 'Driving time')}</span><span class="card-value">${formatHours(result.driving)}</span><span class="card-sub">${t('journey-speed.withBreaks', '{time} with breaks', { time: formatHours(result.total) })}</span></div>
        <div class="card highlight" data-tone="good"><span class="card-label">${t('journey-speed.averageWhileMoving', 'Average while moving')}</span><span class="card-value">${number(result.moving, 1)} <small>${speed}</small></span></div>
        <div class="card"><span class="card-label">${t('journey-speed.averageDoorToDoor', 'Average door to door')}</span><span class="card-value">${number(result.overall, 1)} <small>${speed}</small></span></div>
      </div>
      ${misleading
        ? html`<div class="insight"><p>${t('journey-speed.naiveWarning', 'Averaging the leg speeds would give {naive}, but the journey really averaged {real}. Slow legs take up more of the time, so they count for more.', { naive: `${number(result.naive, 1)} ${speed}`, real: `${number(result.moving, 1)} ${speed}` })}</p></div>`
        : ''}
    </div>`;
  }

  #paintNeeded() {
    const { remaining, available } = this.#state;
    const hours = parseDuration(available);
    const holder = this.$('#needed');
    if (!(remaining > 0) || !(hours > 0)) {
      holder.textContent = '—';
      return;
    }
    const needed = speedFor(remaining, hours);
    holder.innerHTML = html`<span class="needed-value">${number(needed, 1)} <small>${this.#speedUnit}</small></span><span class="muted">${t('journey-speed.neededDetail', 'to cover {distance} in {time}', { distance: `${number(remaining, 1)} ${this.#distanceUnit}`, time: formatHours(hours) })}</span>`;
  }
}

define('jg-app-journey-speed', JourneySpeed);
