import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { router } from '../../core/router.js';
import { clamp } from '../../core/util.js';
import {
  buildNetwork,
  findStation,
  mapBounds,
  mapSvg,
  placeLabels,
  planRoute,
  planTour,
  routePoints,
  routeSvg,
  searchStations,
  stationsBounds,
  stretchPoints,
  trainMotion,
  walker,
} from '../../lib/metro.js';
import MAPS from './maps/index.js';

const t = await appWords('metro-maps', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const SVG = 'http://www.w3.org/2000/svg';
const SETTINGS = { map: MAPS[0].id, trains: true, prefer: 'fastest', keepStart: true, roundTrip: false, routes: {} };

const stillness = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// a map is read and laid out once, however often it is opened
const loaded = new Map();
const loadMap = async (id) => {
  const entry = MAPS.find((map) => map.id === id) ?? MAPS[0];
  if (!loaded.has(entry.id)) {
    loaded.set(
      entry.id,
      entry.load().then((module) => {
        const network = buildNetwork(module.default);
        return { entry, network, labels: placeLabels(network) };
      }),
    );
  }
  return loaded.get(entry.id);
};

/** A small element builder, so names from map data are always text and never markup. */
const h = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'style') node.style.cssText = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
};

const badge = (line) =>
  h('span', { class: 'line-badge', style: `--c:${line.colour};--t:${line.text}` }, line.short || line.name.slice(0, 1));

const minutesText = (minutes) => t('metro-maps.aboutMinutes', 'About {minutes} min', { minutes: Math.round(minutes) });
const stopsText = (count) => (count === 1 ? t('metro-maps.oneStop', '1 stop') : t('metro-maps.stops', '{count} stops', { count }));
const changesText = (count) =>
  count === 0
    ? t('metro-maps.noChanges', 'No changes')
    : count === 1
      ? t('metro-maps.oneChange', '1 change')
      : t('metro-maps.changes', '{count} changes', { count });

class MetroMaps extends JGApp {
  static appId = 'metro-maps';
  static styles = [...JGApp.styles, sheet];

  #settings = { ...SETTINGS };
  #current = null;
  #from = null;
  #to = null;
  #route = null;
  #selected = null;
  #focusLine = null;
  #mode = 'trip';
  #tour = [];
  #view = { x: 0, y: 0, width: 1, height: 1 };
  #tween = null;
  #trains = [];
  #rider = null;
  #loading = 0;

  tools() {
    return [
      {
        name: 'plan_metro_route',
        description: `Find the route between two stations on a metro map and show it on the map. Maps: ${MAPS.map((map) => `${map.id} (${map.city} ${map.system})`).join(', ')}.`,
        params: {
          map: { type: 'string', description: 'Which map, such as toronto or vancouver', required: true },
          from: { type: 'string', description: 'The station to start from', required: true },
          to: { type: 'string', description: 'The station to go to', required: true },
          fewest_changes: { type: 'boolean', description: 'Prefer fewer changes over a faster trip' },
        },
        run: async ({ map, from, to, fewest_changes: fewest = false }) => {
          const entry = MAPS.find((item) => item.id === String(map ?? '').toLowerCase() || item.city.toLowerCase() === String(map ?? '').toLowerCase());
          if (!entry) return `There is no map called ${map}. Maps: ${MAPS.map((item) => item.id).join(', ')}.`;
          const { network } = await loadMap(entry.id);
          const start = findStation(network, from);
          const end = findStation(network, to);
          if (!start) return `There is no station like ${from} on the ${entry.city} map.`;
          if (!end) return `There is no station like ${to} on the ${entry.city} map.`;
          const route = planRoute(network, start.id, end.id, { prefer: fewest ? 'changes' : 'fastest' });
          if (!route) return `Nothing joins ${start.name} and ${end.name}.`;
          if (this.isConnected) {
            await this.#open(entry.id);
            this.#from = start.id;
            this.#to = end.id;
            this.$('#prefer').value = fewest ? 'changes' : 'fastest';
            this.#plan();
          }
          const name = (id) => network.stations.get(id).name;
          const lines = [`${start.name} to ${end.name} on the ${entry.city} ${entry.system}: about ${route.minutes} min, ${route.stops} stops, ${route.changes} changes.`];
          route.legs.forEach((leg, index) => {
            if (leg.walk) {
              lines.push(`Walk from ${name(leg.from)} to ${name(leg.to)}, about ${leg.minutes} min.`);
              return;
            }
            const line = network.lineById.get(leg.line);
            if (index && !route.legs[index - 1].walk) lines.push(`Change at ${name(leg.from)}.`);
            lines.push(`Take the ${line.name} towards ${leg.towards.map(name).join(' or ')} from ${name(leg.from)} to ${name(leg.to)}, ${leg.stops} stops, about ${leg.minutes} min.`);
          });
          lines.push(`Arrive at ${end.name}. Times are estimates.`);
          return lines.join('\n');
        },
      },
      {
        name: 'plan_metro_tour',
        description: 'Find the quickest order to visit several stations on a metro map, with the route between each, and show it on the map.',
        params: {
          map: { type: 'string', description: 'Which map, such as toronto, paris or seoul', required: true },
          stations: { type: 'string', description: 'The stations to visit, separated by commas; the first is where the trip starts', required: true },
          return_to_start: { type: 'boolean', description: 'Come back to the first station at the end' },
        },
        run: async ({ map, stations, return_to_start: roundTrip = false }) => {
          const wanted = String(map ?? '').toLowerCase();
          const entry = MAPS.find((item) => item.id === wanted || item.city.toLowerCase() === wanted);
          if (!entry) return `There is no map called ${map}. Maps: ${MAPS.map((item) => item.id).join(', ')}.`;
          const { network } = await loadMap(entry.id);
          const found = [];
          for (const text of String(stations ?? '').split(',').map((part) => part.trim()).filter(Boolean)) {
            const station = findStation(network, text);
            if (!station) return `There is no station like ${text} on the ${entry.city} map.`;
            found.push(station.id);
          }
          const tour = planTour(network, found, { returnToStart: roundTrip });
          if (!tour) return 'Name at least two stations that the network joins.';
          if (this.isConnected) {
            await this.#open(entry.id);
            this.#tour = found;
            this.$('#roundTrip').checked = roundTrip;
            this.#setMode('tour');
          }
          const name = (id) => network.stations.get(id).name;
          return [
            `Visit in this order on the ${entry.city} ${entry.system}: ${tour.visits.map(name).join(' → ')}.`,
            `About ${tour.minutes} min, ${tour.stops} stops, ${tour.changes} changes. Times are estimates.`,
          ].join('\n');
        },
      },
    ];
  }

  renderApp() {
    this.#settings = { ...SETTINGS, ...(this.store.read({}) ?? {}) };
    const settings = this.#settings;

    this.paint(html`<div class="app">
      <section class="stage">
        <div class="map" id="map" tabindex="0"></div>
        <div class="caption" id="caption"></div>
        <div class="controls">
          <button type="button" id="zoomIn" title="${t('metro-maps.zoomIn', 'Zoom in')}" aria-label="${t('metro-maps.zoomIn', 'Zoom in')}">+</button>
          <button type="button" id="zoomOut" title="${t('metro-maps.zoomOut', 'Zoom out')}" aria-label="${t('metro-maps.zoomOut', 'Zoom out')}">−</button>
          <button type="button" id="fit" title="${t('metro-maps.showAll', 'Show the whole map')}" aria-label="${t('metro-maps.showAll', 'Show the whole map')}">⤢</button>
        </div>
      </section>

      <aside class="panel">
        <div class="picker" id="picker">
          <button type="button" class="pick-button" id="pickButton" aria-haspopup="listbox" aria-expanded="false">
            <span class="flag" id="pickFlag"></span>
            <span class="pick-text"><strong id="pickCity"></strong><span id="pickSystem"></span></span>
            <span class="chevron" aria-hidden="true">▾</span>
          </button>
          <div class="pick-menu" id="pickMenu" hidden>
            <input id="pickSearch" type="search" autocomplete="off" spellcheck="false" placeholder="${t('metro-maps.searchCities', 'Search cities or countries')}" aria-label="${t('metro-maps.searchCities', 'Search cities or countries')}" />
            <div class="pick-list" id="pickList" role="listbox"></div>
          </div>
        </div>

        <div class="group">${t('metro-maps.planRoute', 'Plan a route')}</div>
        <div class="modes" role="tablist">
          <button type="button" role="tab" class="mode" data-mode="trip" aria-selected="true">${t('metro-maps.aToB', 'A to B')}</button>
          <button type="button" role="tab" class="mode" data-mode="tour" aria-selected="false">${t('metro-maps.severalStops', 'Several stops')}</button>
        </div>
        <div class="pane" id="tripPane">
          <div class="places">
            <div class="place">
              <span class="pin pin-a">A</span>
              <input id="from" type="text" autocomplete="off" spellcheck="false" placeholder="${t('metro-maps.from', 'From')}" aria-label="${t('metro-maps.from', 'From')}" role="combobox" aria-expanded="false" />
              <ul class="suggest" id="fromList" role="listbox" hidden></ul>
            </div>
            <div class="place">
              <span class="pin pin-b">B</span>
              <input id="to" type="text" autocomplete="off" spellcheck="false" placeholder="${t('metro-maps.to', 'To')}" aria-label="${t('metro-maps.to', 'To')}" role="combobox" aria-expanded="false" />
              <ul class="suggest" id="toList" role="listbox" hidden></ul>
            </div>
            <button type="button" class="swap" id="swap" title="${t('metro-maps.swap', 'Swap')}" aria-label="${t('metro-maps.swap', 'Swap')}">⇅</button>
          </div>
          <div class="hint">${t('metro-maps.orPick', 'Or pick stations on the map')}</div>
        </div>
        <div class="pane" id="tourPane" hidden>
          <div class="place">
            <span class="pin pin-add">+</span>
            <input id="tourInput" type="text" autocomplete="off" spellcheck="false" placeholder="${t('metro-maps.addStation', 'Add a station to visit')}" aria-label="${t('metro-maps.addStation', 'Add a station to visit')}" role="combobox" aria-expanded="false" />
            <ul class="suggest" id="tourInputList" role="listbox" hidden></ul>
          </div>
          <ul class="tour-stops" id="tourStops"></ul>
          <label class="toggle">
            <jg-switch id="keepStart" ${settings.keepStart !== false ? 'checked' : ''}></jg-switch>
            <span>${t('metro-maps.keepStart', 'Start from the first station')}</span>
          </label>
          <label class="toggle">
            <jg-switch id="roundTrip" ${settings.roundTrip ? 'checked' : ''}></jg-switch>
            <span>${t('metro-maps.roundTrip', 'Come back to the start')}</span>
          </label>
        </div>
        <div class="prefer-row">
          <jg-select id="prefer" value="${settings.prefer}">
            <option value="fastest">${t('metro-maps.fastest', 'Fastest')}</option>
            <option value="changes">${t('metro-maps.fewestChanges', 'Fewest changes')}</option>
          </jg-select>
          <jg-button id="clear" variant="ghost" size="sm">${t('metro-maps.clearRoute', 'Clear route')}</jg-button>
        </div>
        <div class="trip" id="trip" aria-live="polite"></div>

        <div class="card" id="card" hidden></div>

        <div class="group">${t('metro-maps.lines', 'Lines')}</div>
        <div class="lines" id="lines"></div>

        <label class="toggle">
          <jg-switch id="trains" ${settings.trains ? 'checked' : ''}></jg-switch>
          <span>${t('metro-maps.movingTrains', 'Moving trains')}</span>
        </label>
        <p class="note">${t('metro-maps.disclaimer', 'Map data may be incomplete or out of date, and travel times are estimates. This is not an official map.')}</p>
        <p class="note credit" id="credit"></p>
      </aside>
    </div>`);

    this.#wireMap();
    this.#wirePlaces();
    this.#wireTour();
    this.#wirePicker();
    for (const button of this.$('.modes').querySelectorAll('.mode')) {
      this.on(button, 'click', () => this.#setMode(button.dataset.mode));
    }
    this.on(this.$('#prefer'), 'change', () => {
      this.#remember();
      this.#plan();
    });
    this.on(this.$('#swap'), 'click', () => {
      [this.#from, this.#to] = [this.#to, this.#from];
      this.#plan();
    });
    this.on(this.$('#clear'), 'click', () => {
      if (this.#mode === 'tour') {
        this.#tour = [];
      } else {
        this.#from = null;
        this.#to = null;
      }
      this.#plan();
    });
    this.on(this.$('#trains'), 'change', () => {
      this.#remember();
      this.#startTrains();
    });
    this.on(this.$('#zoomIn'), 'click', () => this.#zoomBy(0.7));
    this.on(this.$('#zoomOut'), 'click', () => this.#zoomBy(1 / 0.7));
    this.on(this.$('#fit'), 'click', () => this.#showAll());

    let frame = 0;
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      this.#tick(now);
    };
    frame = requestAnimationFrame(tick);
    this.keep(() => cancelAnimationFrame(frame));

    // A link to one city opens that city. A change of language paints the app
    // afresh, and the open map comes back as it was.
    const route = router.current;
    const linked = route.name === 'app' && route.appId === 'metro-maps' ? route.path?.[0] : null;
    const first = this.#current?.entry.id ?? (MAPS.some((map) => map.id === linked) ? linked : settings.map);
    this.#open(first, { keepView: Boolean(this.#current) });
  }

  // ---- choosing a city ----------------------------------------------------

  #wirePicker() {
    const button = this.$('#pickButton');
    const menu = this.$('#pickMenu');
    const search = this.$('#pickSearch');
    const list = this.$('#pickList');
    let shown = [];
    let active = 0;

    const draw = () => {
      const query = search.value.trim().toLowerCase();
      shown = MAPS.filter((map) => !query || `${map.city} ${map.country} ${map.system}`.toLowerCase().includes(query))
        .slice()
        .sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city));
      active = Math.max(0, Math.min(active, shown.length - 1));
      const rows = [];
      let country = null;
      shown.forEach((map, index) => {
        if (map.country !== country) {
          country = map.country;
          rows.push(h('div', { class: 'pick-country' }, h('span', { class: 'flag' }, map.flag ?? ''), map.country));
        }
        const item = h(
          'button',
          {
            type: 'button',
            role: 'option',
            class: `pick-item${index === active ? ' active' : ''}${map.id === this.#current?.entry.id ? ' current' : ''}`,
            'aria-selected': String(map.id === this.#current?.entry.id),
          },
          h('span', { class: 'pick-city' }, map.city),
          h('span', { class: 'pick-system' }, map.system),
        );
        item.addEventListener('click', () => choose(map));
        rows.push(item);
      });
      list.replaceChildren(...(rows.length ? rows : [h('p', { class: 'pick-empty' }, t('metro-maps.noCity', 'No city matches'))]));
      list.querySelector('.pick-item.active')?.scrollIntoView({ block: 'nearest' });
    };
    const open = () => {
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      search.value = '';
      active = Math.max(0, MAPS.slice().sort((a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city)).findIndex((map) => map.id === this.#current?.entry.id));
      draw();
      search.focus();
    };
    const close = () => {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    };
    const choose = (map) => {
      close();
      button.focus();
      this.#open(map.id);
    };

    this.on(button, 'click', () => (menu.hidden ? open() : close()));
    this.on(search, 'input', () => {
      active = 0;
      draw();
    });
    this.on(search, 'keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!shown.length) return;
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
        draw();
      } else if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        if (shown[active]) choose(shown[active]);
      } else if (event.key === 'Escape') {
        close();
        button.focus();
      }
    });
    this.on(document, 'pointerdown', (event) => {
      if (!menu.hidden && !event.composedPath().includes(this.$('#picker'))) close();
    });
  }

  #showPicked() {
    const { entry, network } = this.#current;
    this.$('#pickFlag').textContent = entry.flag ?? '';
    this.$('#pickCity').textContent = entry.city;
    this.$('#pickSystem').textContent = `${entry.system} · ${entry.country}`;
    this.$('#caption').replaceChildren(
      h('strong', {}, entry.flag ? `${entry.flag} ${entry.city}` : entry.city),
      h('span', {}, `${entry.system} · ${t('metro-maps.lineCount', '{count} lines', { count: network.lines.length })} · ${t('metro-maps.stationCount', '{count} stations', { count: network.stations.size })}`),
    );
    this.$('#credit').textContent = network.credit ? t('metro-maps.dataFrom', 'Map data {credit}', { credit: network.credit }) : '';
    this.$('#credit').hidden = !network.credit;
    // the address follows the city on show, so it can be shared or bookmarked
    const route = router.current;
    if (route.name === 'app' && route.appId === 'metro-maps') {
      const address = `${router.href(`/apps/metro-maps/${entry.id}`)}${window.location.search}`;
      if (window.location.pathname !== address.split('?')[0]) history.replaceState(history.state, '', address);
    }
  }

  // ---- the map ------------------------------------------------------------

  async #open(id, { keepView = false } = {}) {
    const ticket = ++this.#loading;
    const map = await loadMap(id);
    if (ticket !== this.#loading || !this.isConnected) return;
    const switching = this.#current?.entry.id !== map.entry.id;
    const view = { ...this.#view };
    if (switching) {
      const saved = this.#settings.routes?.[map.entry.id] ?? {};
      this.#from = map.network.stations.has(saved.from) ? saved.from : null;
      this.#to = map.network.stations.has(saved.to) ? saved.to : null;
      this.#tour = (saved.tour ?? []).filter((id) => map.network.stations.has(id));
      this.#mode = saved.mode === 'tour' ? 'tour' : 'trip';
      this.#selected = null;
      this.#focusLine = null;
    }
    this.#current = map;
    this.$('#map').innerHTML = mapSvg(map.network, map.labels);
    this.$('#map svg').setAttribute('aria-label', t('metro-maps.mapOf', 'Metro map of {city}', { city: map.entry.city }));
    this.$('#map svg').setAttribute('role', 'img');
    this.#showPicked();
    this.#drawLines();
    this.#startTrains();
    if (switching) this.#remember();
    if (keepView && !switching) {
      this.#view = view;
      this.#applyView();
    } else {
      this.#fitBox(mapBounds(map.network, map.labels), false);
    }
    this.#showMode();
    this.#plan({ move: !keepView || switching });
    this.#showCard();
  }

  #svg() {
    return this.$('#map svg');
  }

  #wireMap() {
    const host = this.$('#map');
    const pointers = new Map();
    let moved = 0;
    let pinch = null;

    const toMap = (clientX, clientY) => {
      const box = host.getBoundingClientRect();
      return [
        this.#view.x + ((clientX - box.left) / box.width) * this.#view.width,
        this.#view.y + ((clientY - box.top) / box.height) * this.#view.height,
      ];
    };

    this.on(host, 'wheel', (event) => {
      if (!this.#current) return;
      event.preventDefault();
      const factor = Math.exp(clamp(event.deltaY, -120, 120) * (event.ctrlKey ? 0.01 : 0.0022));
      this.#zoomAt(toMap(event.clientX, event.clientY), factor);
    }, { passive: false });

    this.on(host, 'pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      host.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, target: event.target });
      moved = 0;
      this.#tween = null;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) };
      }
    });
    this.on(host, 'pointermove', (event) => {
      const last = pointers.get(event.pointerId);
      if (!last) return;
      const box = host.getBoundingClientRect();
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      last.x = event.clientX;
      last.y = event.clientY;
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > 0 && pinch.distance > 0) this.#zoomAt(toMap((a.x + b.x) / 2, (a.y + b.y) / 2), pinch.distance / distance);
        pinch.distance = distance;
        return;
      }
      if (moved < 4) return;
      host.dataset.dragging = 'true';
      this.#view.x -= (dx / box.width) * this.#view.width;
      this.#view.y -= (dy / box.height) * this.#view.height;
      this.#applyView();
    });
    const release = (event) => {
      const last = pointers.get(event.pointerId);
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      delete host.dataset.dragging;
      if (!last || event.type === 'pointercancel' || moved >= 6 || pointers.size) return;
      const station = last.target.closest?.('[data-station]');
      if (station) this.#select(station.dataset.station);
      else if (!last.target.closest?.('.badge')) this.#select(null);
    };
    this.on(host, 'pointerup', release);
    this.on(host, 'pointercancel', release);

    this.on(host, 'keydown', (event) => {
      const station = event.target.closest?.('[data-station]');
      if (station && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.#select(station.dataset.station);
        return;
      }
      const step = 0.12;
      const moves = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (moves[event.key]) {
        event.preventDefault();
        this.#view.x += moves[event.key][0] * this.#view.width;
        this.#view.y += moves[event.key][1] * this.#view.height;
        this.#applyView();
      } else if (event.key === '+' || event.key === '=') {
        this.#zoomBy(0.8);
      } else if (event.key === '-' || event.key === '_') {
        this.#zoomBy(1.25);
      } else if (event.key === '0') {
        this.#showAll();
      } else if (event.key === 'Escape') {
        this.#select(null);
      }
    });

    // the view keeps its middle and its scale when the window changes size
    let size = null;
    const watch = new ResizeObserver(() => {
      const box = host.getBoundingClientRect();
      if (!box.width || !box.height) return;
      if (size && this.#current) {
        const middle = [this.#view.x + this.#view.width / 2, this.#view.y + this.#view.height / 2];
        const perPixel = this.#view.width / size.width;
        this.#view.width = box.width * perPixel;
        this.#view.height = box.height * perPixel;
        this.#view.x = middle[0] - this.#view.width / 2;
        this.#view.y = middle[1] - this.#view.height / 2;
        this.#applyView();
      } else if (this.#current) {
        this.#fitBox(mapBounds(this.#current.network, this.#current.labels), false);
      }
      size = { width: box.width, height: box.height };
    });
    watch.observe(host);
    this.keep(() => watch.disconnect());
  }

  #limits() {
    const all = mapBounds(this.#current.network, this.#current.labels);
    return { least: 160, most: Math.max(all.width, all.height) * 2.2 };
  }

  #zoomAt([px, py], factor) {
    if (!this.#current) return;
    const { least, most } = this.#limits();
    const width = clamp(this.#view.width * factor, least, most);
    const scale = width / this.#view.width;
    this.#view = {
      x: px - (px - this.#view.x) * scale,
      y: py - (py - this.#view.y) * scale,
      width,
      height: this.#view.height * scale,
    };
    this.#applyView();
  }

  #zoomBy(factor) {
    this.#zoomAt([this.#view.x + this.#view.width / 2, this.#view.y + this.#view.height / 2], factor);
  }

  #applyView() {
    const { x, y, width, height } = this.#view;
    this.#svg()?.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  }

  /** Bring a box into view with the window's own proportions, gliding there unless told not to. */
  #fitBox(box, glide = true) {
    const host = this.$('#map').getBoundingClientRect();
    if (!host.width || !host.height) return;
    const aspect = host.width / host.height;
    let width = box.width;
    let height = box.height;
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    const target = { x: box.x + box.width / 2 - width / 2, y: box.y + box.height / 2 - height / 2, width, height };
    if (!glide || stillness()) {
      this.#tween = null;
      this.#view = target;
      this.#applyView();
      return;
    }
    this.#tween = { from: { ...this.#view }, to: target, start: performance.now(), length: 650 };
  }

  #showAll() {
    if (this.#current) this.#fitBox(mapBounds(this.#current.network, this.#current.labels));
  }

  #tick(now) {
    if (this.#tween) {
      const { from, to, start, length } = this.#tween;
      const share = Math.min(1, (now - start) / length);
      const eased = 1 - (1 - share) ** 3;
      this.#view = Object.fromEntries(Object.keys(to).map((key) => [key, from[key] + (to[key] - from[key]) * eased]));
      this.#applyView();
      if (share >= 1) this.#tween = null;
    }
    const seconds = now / 1000;
    for (const train of this.#trains) {
      const [x, y, angle] = train.motion.at(seconds + train.offset);
      train.node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)})`);
    }
    if (this.#rider) {
      const { path, node, length } = this.#rider;
      // a dot rides the route from A to B, rests, and sets off again
      const cycle = length / 140 + 1.2;
      const into = (seconds - this.#rider.start) % cycle;
      const [x, y] = path.at(Math.min(length, into * 140));
      node.setAttribute('cx', x.toFixed(1));
      node.setAttribute('cy', y.toFixed(1));
      node.setAttribute('opacity', into * 140 > length ? '0' : '1');
    }
  }

  #startTrains() {
    const layer = this.#svg()?.querySelector('.trains');
    this.#trains = [];
    if (!layer) return;
    layer.replaceChildren();
    if (!this.$('#trains').checked || stillness()) return;
    const { network } = this.#current;
    for (const line of network.lines) {
      line.branches.forEach((ids, branch) => {
        const motion = trainMotion(stretchPoints(network, line.id, ids));
        const count = Math.max(1, Math.round(ids.length / 7));
        for (let k = 0; k < count; k += 1) {
          const node = document.createElementNS(SVG, 'rect');
          node.setAttribute('class', 'train');
          node.setAttribute('x', '-8');
          node.setAttribute('y', '-4');
          node.setAttribute('width', '16');
          node.setAttribute('height', '8');
          node.setAttribute('rx', '4');
          node.setAttribute('fill', line.colour);
          layer.append(node);
          // branches that share track are set apart, so their trains do not ride on top of one another
          this.#trains.push({ node, motion, offset: (motion.period * (k + branch / (line.branches.length + 1))) / count });
        }
      });
    }
  }

  #drawLines() {
    const { network } = this.#current;
    this.$('#lines').replaceChildren(
      ...network.lines.map((line) =>
        h(
          'button',
          {
            type: 'button',
            class: `line-row${this.#focusLine === line.id ? ' active' : ''}`,
            'aria-pressed': String(this.#focusLine === line.id),
            onclick: () => this.#showLine(this.#focusLine === line.id ? null : line.id),
          },
          badge(line),
          h('span', { class: 'line-name' }, line.name),
          h('span', { class: 'line-count' }, t('metro-maps.stationCount', '{count} stations', { count: new Set(line.branches.flat()).size })),
        ),
      ),
    );
  }

  #showLine(id) {
    this.#focusLine = id;
    const svg = this.#svg();
    const { network, labels } = this.#current;
    const on = id ? new Set(network.lineById.get(id).branches.flat()) : null;
    svg.classList.toggle('focusing', Boolean(id));
    svg.querySelectorAll('.line, .badge').forEach((node) => node.classList.toggle('lit', node.dataset.line === id));
    svg.querySelectorAll('.stations .station').forEach((node) => node.classList.toggle('lit', Boolean(on?.has(node.dataset.station))));
    this.#drawLines();
    if (id) this.#fitBox(stationsBounds(network, labels, [...on]));
  }

  // ---- stations -------------------------------------------------------------

  #select(id) {
    this.#selected = id;
    this.#svg()?.querySelectorAll('.station').forEach((node) => node.classList.toggle('selected', node.dataset.station === id));
    this.#showCard();
  }

  #showCard() {
    const card = this.$('#card');
    const station = this.#selected ? this.#current?.network.stations.get(this.#selected) : null;
    card.hidden = !station;
    if (!station) {
      card.replaceChildren();
      return;
    }
    const { network } = this.#current;
    card.replaceChildren(
      h('div', { class: 'card-head' }, h('strong', {}, station.name), h('button', { type: 'button', class: 'close', 'aria-label': t('metro-maps.close', 'Close'), onclick: () => this.#select(null) }, '×')),
      h('div', { class: 'card-lines' }, station.lines.map((lineId) => {
        const line = network.lineById.get(lineId);
        return h('span', { class: 'card-line' }, badge(line), line.name);
      })),
      h(
        'div',
        { class: 'card-actions' },
        h('button', { type: 'button', class: 'action', onclick: () => this.#choose('from', station.id) }, h('span', { class: 'pin pin-a' }, 'A'), t('metro-maps.startHere', 'Start here')),
        h('button', { type: 'button', class: 'action', onclick: () => this.#choose('to', station.id) }, h('span', { class: 'pin pin-b' }, 'B'), t('metro-maps.goHere', 'Go here')),
        h(
          'button',
          {
            type: 'button',
            class: 'action wide',
            onclick: () => {
              this.#select(null);
              this.#addStop(station.id);
            },
          },
          h('span', { class: 'pin pin-add' }, '+'),
          this.#tour.includes(station.id) ? t('metro-maps.inStops', 'Already one of the stops') : t('metro-maps.addToStops', 'Add to the stops'),
        ),
      ),
    );
  }

  #choose(end, id) {
    if (end === 'from') this.#from = id;
    else this.#to = id;
    this.#select(null);
    this.#plan();
  }

  // ---- the two ends of a trip ------------------------------------------------

  /** A box that suggests stations as someone types, and hands the one picked to `pick`. */
  #searchBox(input, list, { pick, leave }) {
    let active = -1;
    let matches = [];

    const close = () => {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      active = -1;
    };
    const choose = (station) => {
      close();
      pick(station);
    };
    const show = () => {
      const { network } = this.#current ?? {};
      matches = network ? searchStations(network, input.value, 8) : [];
      active = matches.length ? 0 : -1;
      list.replaceChildren(
        ...(matches.length
          ? matches.map((station, index) =>
              h(
                'li',
                {
                  role: 'option',
                  class: index === active ? 'active' : '',
                  'aria-selected': String(index === active),
                  onpointerdown: (event) => {
                    event.preventDefault();
                    choose(station);
                  },
                },
                h('span', { class: 'dots' }, station.lines.map((lineId) => h('i', { style: `--c:${network.lineById.get(lineId).colour}` }))),
                station.name,
              ),
            )
          : [h('li', { class: 'empty' }, t('metro-maps.noMatch', 'No station matches'))]),
      );
      list.hidden = !input.value.trim();
      input.setAttribute('aria-expanded', String(!list.hidden));
    };
    const mark = () =>
      [...list.children].forEach((item, index) => {
        item.classList.toggle('active', index === active);
        item.setAttribute('aria-selected', String(index === active));
      });

    this.on(input, 'input', show);
    this.on(input, 'focus', () => {
      input.select();
      if (input.value.trim()) show();
    });
    this.on(input, 'keydown', (event) => {
      const key = event.key === 'Return' || event.keyCode === 13 ? 'Enter' : event.key;
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        if (list.hidden) show();
        event.preventDefault();
        if (!matches.length) return;
        active = (active + (key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        mark();
      } else if (key === 'Enter') {
        event.preventDefault();
        if (list.hidden && input.value.trim()) show();
        const station = matches[active] ?? (this.#current && findStation(this.#current.network, input.value));
        if (station) choose(station);
      } else if (key === 'Escape') {
        close();
        input.blur();
      }
    });
    this.on(input, 'blur', () => {
      close();
      leave?.();
    });
  }

  #wirePlaces() {
    for (const end of ['from', 'to']) {
      const input = this.$(`#${end}`);
      this.#searchBox(input, this.$(`#${end}List`), {
        pick: (station) => {
          input.value = station.name;
          this.#choose(end, station.id);
          // with the start chosen, the destination is next
          if (end === 'from' && !this.#to) this.$('#to').focus();
          else input.blur();
        },
        leave: () => {
          // an emptied box lets go of its station; anything else typed and not
          // picked goes back to the station already chosen
          if (!input.value.trim() && (end === 'from' ? this.#from : this.#to)) this.#choose(end, null);
          else this.#fillPlaces();
        },
      });
    }
  }

  // ---- several stops -----------------------------------------------------------

  #wireTour() {
    const input = this.$('#tourInput');
    this.#searchBox(input, this.$('#tourInputList'), {
      pick: (station) => {
        input.value = '';
        this.#addStop(station.id);
      },
      leave: () => {
        input.value = '';
      },
    });
    for (const id of ['keepStart', 'roundTrip']) {
      this.on(this.$(`#${id}`), 'change', () => {
        this.#remember();
        this.#plan();
      });
    }
  }

  #showMode() {
    for (const button of this.$('.modes').querySelectorAll('.mode')) {
      button.setAttribute('aria-selected', String(button.dataset.mode === this.#mode));
    }
    this.$('#tripPane').hidden = this.#mode !== 'trip';
    this.$('#tourPane').hidden = this.#mode !== 'tour';
  }

  #setMode(mode) {
    this.#mode = mode === 'tour' ? 'tour' : 'trip';
    this.#showMode();
    this.#plan();
  }

  #addStop(id) {
    if (!this.#tour.includes(id)) this.#tour.push(id);
    this.#setMode('tour');
  }

  #drawStops() {
    const { network } = this.#current;
    this.$('#tourStops').replaceChildren(
      ...this.#tour.map((id, index) => {
        const station = network.stations.get(id);
        return h(
          'li',
          { class: 'tour-stop' },
          h('span', { class: 'dots' }, station.lines.map((lineId) => h('i', { style: `--c:${network.lineById.get(lineId).colour}` }))),
          h('span', { class: 'tour-name' }, station.name),
          h(
            'button',
            {
              type: 'button',
              class: 'close',
              'aria-label': t('metro-maps.removeStop', 'Remove {station}', { station: station.name }),
              onclick: () => {
                this.#tour.splice(index, 1);
                this.#plan();
              },
            },
            '×',
          ),
        );
      }),
    );
  }

  #fillPlaces() {
    const { network } = this.#current ?? {};
    if (!network) return;
    for (const end of ['from', 'to']) {
      const input = this.$(`#${end}`);
      // a box someone is typing a search into keeps what they typed
      if (!this.$(`#${end}List`).hidden) continue;
      const id = end === 'from' ? this.#from : this.#to;
      input.value = id ? network.stations.get(id).name : '';
    }
  }

  // ---- the route -------------------------------------------------------------

  #plan({ move = true } = {}) {
    if (!this.#current) return;
    const { network, labels, entry } = this.#current;
    this.#fillPlaces();
    this.#settings.routes = { ...this.#settings.routes, [entry.id]: { from: this.#from, to: this.#to, tour: this.#tour, mode: this.#mode } };
    this.#remember();
    if (this.#focusLine && (this.#mode === 'tour' ? this.#tour.length > 1 : this.#from && this.#to)) this.#showLine(null);
    if (this.#mode === 'tour') {
      this.#planTour({ move });
      return;
    }

    const svg = this.#svg();
    const layer = svg.querySelector('.route');
    const result = this.$('#trip');
    this.$('#clear').hidden = !this.#from && !this.#to;
    this.#rider = null;

    if (!this.#from || !this.#to) {
      this.#route = null;
      layer.innerHTML = '';
      svg.classList.remove('routing');
      result.replaceChildren(h('p', { class: 'idle' }, t('metro-maps.pickTwo', 'Choose where you start and where you are going.')));
      this.#markEnds();
      return;
    }

    const route = planRoute(network, this.#from, this.#to, { prefer: this.$('#prefer').value });
    this.#route = route;

    if (!route) {
      layer.innerHTML = '';
      svg.classList.remove('routing');
      result.replaceChildren(h('p', { class: 'idle' }, t('metro-maps.noRoute', 'Nothing joins these two stations.')));
      return;
    }
    if (!route.legs.length) {
      layer.innerHTML = '';
      svg.classList.remove('routing');
      result.replaceChildren(h('p', { class: 'idle' }, t('metro-maps.sameStation', 'You are already there.')));
      this.#markEnds();
      return;
    }

    this.#drawRoute(route);

    const name = (id) => network.stations.get(id).name;
    const steps = this.#steps(route);
    steps.push(h('li', { class: 'step arrive' }, h('span', { class: 'step-mark' }), h('div', {}, h('b', {}, t('metro-maps.arriveAt', 'Arrive at {station}', { station: name(route.to) })))));

    result.replaceChildren(
      h('div', { class: 'summary' }, h('strong', {}, minutesText(route.minutes)), h('span', {}, `${stopsText(route.stops)} · ${changesText(route.changes)}`)),
      h('ol', { class: 'steps' }, steps),
    );
    this.#markEnds();
    if (move) this.#fitBox(stationsBounds(network, labels, route.legs.flatMap((leg) => leg.stations)));
  }

  /** Draw a route over the map, afresh each time so it draws itself in again, with a dot riding it. */
  #drawRoute(route, pins) {
    const { network, labels } = this.#current;
    const svg = this.#svg();
    const layer = svg.querySelector('.route');
    layer.innerHTML = routeSvg(network, route, labels, { pins });
    svg.classList.add('routing');
    const rider = document.createElementNS(SVG, 'circle');
    rider.setAttribute('class', 'rider');
    rider.setAttribute('r', '7');
    layer.append(rider);
    if (stillness()) {
      rider.remove();
      return;
    }
    const path = walker(routePoints(network, route));
    this.#rider = { path, node: rider, length: path.total, start: performance.now() / 1000 + 0.9 };
  }

  /** The rides, changes and walks of a route, as steps to follow. */
  #steps(route) {
    const { network, labels } = this.#current;
    const name = (id) => network.stations.get(id).name;
    const steps = [];
    route.legs.forEach((leg, index) => {
      if (leg.walk) {
        steps.push(
          h('li', { class: 'step walk' }, h('span', { class: 'step-mark' }), h('div', {}, h('b', {}, t('metro-maps.walkTo', 'Walk to {station}', { station: name(leg.to) })), h('span', { class: 'muted' }, minutesText(leg.minutes)))),
        );
        return;
      }
      const line = network.lineById.get(leg.line);
      if (index && !route.legs[index - 1].walk) {
        steps.push(
          h('li', { class: 'step change' }, h('span', { class: 'step-mark' }), h('div', {}, h('b', {}, t('metro-maps.changeAt', 'Change at {station}', { station: name(leg.from) })), h('span', { class: 'muted' }, minutesText(network.stations.get(leg.from).change)))),
        );
      }
      const towards = leg.towards.map(name);
      steps.push(
        h(
          'li',
          { class: 'step ride', style: `--c:${line.colour}`, tabindex: '0', onclick: () => this.#fitBox(stationsBounds(network, labels, leg.stations)) },
          badge(line),
          h(
            'div',
            {},
            h('b', {}, t('metro-maps.take', 'Take the {line}', { line: line.name })),
            h('span', {}, towards.length > 1
              ? t('metro-maps.towardsEither', 'towards {first} or {second}', { first: towards[0], second: towards.slice(1).join(', ') })
              : t('metro-maps.towards', 'towards {station}', { station: towards[0] ?? name(leg.to) })),
            h('span', { class: 'muted' }, `${t('metro-maps.rideTo', 'Ride to {station}', { station: name(leg.to) })} · ${stopsText(leg.stops)} · ${minutesText(leg.minutes)}`),
          ),
        ),
      );
    });
    return steps;
  }

  #planTour({ move }) {
    const { network, labels } = this.#current;
    const svg = this.#svg();
    const result = this.$('#trip');
    this.#drawStops();
    this.$('#clear').hidden = !this.#tour.length;
    this.#rider = null;
    this.#markEnds();
    const idle = (text) => {
      svg.querySelector('.route').innerHTML = '';
      svg.classList.remove('routing');
      result.replaceChildren(h('p', { class: 'idle' }, text));
    };
    if (this.#tour.length < 2) {
      idle(t('metro-maps.addTwo', 'Add two or more stations, and the quickest order to visit them is worked out for you.'));
      return;
    }
    const roundTrip = this.$('#roundTrip').checked;
    const tour = planTour(network, this.#tour, {
      prefer: this.$('#prefer').value,
      keepStart: this.$('#keepStart').checked,
      returnToStart: roundTrip,
    });
    if (!tour) {
      idle(t('metro-maps.noRoute', 'Nothing joins these two stations.'));
      return;
    }

    const last = tour.visits.length - 1;
    const numberOf = (index) => String(roundTrip && index === last ? 1 : index + 1);
    const joined = { from: tour.visits[0], to: tour.visits[last], legs: tour.legs.flatMap((leg) => leg.legs) };
    const pins = tour.visits.map((id, index) => ({ id, text: numberOf(index), kind: 'n' })).filter((pin, index) => !(roundTrip && index === last));
    this.#drawRoute(joined, pins);

    const items = [];
    tour.visits.forEach((id, index) => {
      items.push(h('li', { class: 'step visit' }, h('span', { class: 'pin pin-n' }, numberOf(index)), h('div', {}, h('b', {}, network.stations.get(id).name))));
      if (tour.legs[index]) items.push(...this.#steps(tour.legs[index]));
    });
    result.replaceChildren(
      h('div', { class: 'summary' }, h('strong', {}, minutesText(tour.minutes)), h('span', {}, `${stopsText(tour.stops)} · ${changesText(tour.changes)}`)),
      h('p', { class: 'order-note' }, t('metro-maps.quickestOrder', 'The quickest order to visit them')),
      h('ol', { class: 'steps' }, items),
    );
    if (move) this.#fitBox(stationsBounds(network, labels, joined.legs.flatMap((leg) => leg.stations)));
  }

  /** A and B on the map for an end chosen before the other one is. */
  #markEnds() {
    const svg = this.#svg();
    const tour = this.#mode === 'tour';
    svg?.querySelectorAll('.station').forEach((node) => {
      node.classList.toggle('is-from', !tour && node.dataset.station === this.#from);
      node.classList.toggle('is-to', !tour && node.dataset.station === this.#to);
      node.classList.toggle('is-stop', tour && this.#tour.includes(node.dataset.station));
    });
  }

  #remember() {
    this.store.write({
      map: this.#current?.entry.id ?? this.#settings.map,
      trains: this.$('#trains').checked,
      prefer: this.$('#prefer').value,
      keepStart: this.$('#keepStart').checked,
      roundTrip: this.$('#roundTrip').checked,
      routes: this.#settings.routes ?? {},
    });
  }
}

define('jg-app-metro-maps', MetroMaps);
