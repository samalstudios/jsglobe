import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords, language } from '../../core/i18n.js';
import { clamp } from '../../core/util.js';
import { LIMIT, mercatorLat, mercatorPath, mercatorStretch, mercatorY, moveShape, shapeCentre, unpackRings } from '../../lib/geo.js';

const t = await appWords('true-size', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const SVG = 'http://www.w3.org/2000/svg';
const COLOURS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const TRY = ['grl', 'rus', 'bra', 'aus', 'ind', 'gbr', 'usa', 'cod'];
const SETTINGS = { unit: 'km', picked: null };
const SQUARE_MILE = 2.589988110336;

// the outlines are a sizeable file, so they are fetched when the app opens
let world = null;
const loadWorld = async () => {
  if (!world) {
    world = import('./countries.js').then(({ default: countries }) => {
      const byId = new Map();
      for (const country of countries) {
        const rings = unpackRings(country.rings);
        byId.set(country.id, { ...country, rings, centre: shapeCentre(rings) });
      }
      return { countries: [...byId.values()], byId };
    });
  }
  return world;
};

const nameOf = (country) => country.names[language()] ?? country.names.en;

const fold = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** A small element builder, so names from the data are always text. */
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

const svgNode = (tag, attributes = {}) => {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

class TrueSize extends JGApp {
  static appId = 'true-size';
  static styles = [...JGApp.styles, sheet];

  #settings = { ...SETTINGS };
  #world = null;
  #picked = [];
  #view = { x: -180, y: -mercatorY(78), width: 360, height: mercatorY(78) + mercatorY(60) };
  #frame = 0;

  tools() {
    return [
      {
        name: 'compare_country_sizes',
        description: 'Compare the true areas of countries, and place their outlines on the map to drag and compare.',
        params: {
          countries: { type: 'string', description: 'Country names separated by commas, such as Greenland, Brazil', required: true },
        },
        run: async ({ countries }) => {
          const { byId, countries: all } = await loadWorld();
          const found = [];
          for (const text of String(countries ?? '').split(',').map((part) => part.trim()).filter(Boolean)) {
            const match = this.#search(all, text)[0];
            if (!match) return `No country matches ${text}.`;
            found.push(match);
          }
          if (!found.length) return 'Name at least one country.';
          if (this.isConnected) for (const country of found) this.#add(country.id);
          const biggest = found.reduce((big, country) => (country.area > big.area ? country : big));
          return found
            .map((country) => `${country.names.en}: ${country.area.toLocaleString('en')} km²${country === biggest ? '' : `, ${(biggest.area / country.area).toFixed(1)} times smaller than ${biggest.names.en}`}.`)
            .concat(byId.size ? ['Areas come from Natural Earth outlines and are approximate.'] : [])
            .join('\n');
        },
      },
    ];
  }

  renderApp() {
    this.#settings = { ...SETTINGS, ...(this.store.read({}) ?? {}) };

    this.paint(html`<div class="app">
      <section class="stage">
        <div class="map" id="map" tabindex="0" aria-label="${t('true-size.mapLabel', 'World map. Drag a coloured country to move it.')}">
          <svg class="world" id="svg" preserveAspectRatio="none">
            <g class="graticule" id="graticule"></g>
            <g class="land" id="land"></g>
            <g class="picked" id="pickedLayer"></g>
          </svg>
        </div>
        <div class="loading" id="loading">${t('true-size.loading', 'Loading the world…')}</div>
        <div class="controls">
          <button type="button" id="zoomIn" title="${t('true-size.zoomIn', 'Zoom in')}" aria-label="${t('true-size.zoomIn', 'Zoom in')}">+</button>
          <button type="button" id="zoomOut" title="${t('true-size.zoomOut', 'Zoom out')}" aria-label="${t('true-size.zoomOut', 'Zoom out')}">−</button>
          <button type="button" id="fit" title="${t('true-size.showWorld', 'Show the whole world')}" aria-label="${t('true-size.showWorld', 'Show the whole world')}">⤢</button>
        </div>
        <div class="tip">${t('true-size.tip', 'Drag a coloured country towards the poles or the equator and watch it change size on the map, while its real size stays the same.')}</div>
      </section>

      <aside class="panel">
        <div class="group">${t('true-size.addCountry', 'Add a country')}</div>
        <div class="search">
          <input id="search" type="search" autocomplete="off" spellcheck="false" placeholder="${t('true-size.searchCountries', 'Search countries')}" aria-label="${t('true-size.searchCountries', 'Search countries')}" role="combobox" aria-expanded="false" />
          <ul class="suggest" id="suggest" role="listbox" hidden></ul>
        </div>
        <div class="hint">${t('true-size.orClick', 'Or click a country on the map')}</div>
        <div class="chips" id="chips"></div>

        <div class="group picked-head">
          <span>${t('true-size.onTheMap', 'On the map')}</span>
          <jg-select id="unit" value="${this.#settings.unit}">
            <option value="km">km²</option>
            <option value="mi">mi²</option>
          </jg-select>
        </div>
        <ul class="list" id="list"></ul>
        <jg-button id="clear" variant="ghost" size="sm">${t('true-size.removeAll', 'Remove all')}</jg-button>

        <p class="note">${t('true-size.why', 'Flat world maps use the Mercator projection, which stretches land more the further it is from the equator. Greenland looks as big as Africa, but Africa is about 14 times larger.')}</p>
        <p class="note">${t('true-size.credit', 'Outlines from Natural Earth. Areas are approximate.')}</p>
      </aside>
    </div>`);

    this.#wireMap();
    this.#wireSearch();
    this.on(this.$('#zoomIn'), 'click', () => this.#zoomBy(0.7));
    this.on(this.$('#zoomOut'), 'click', () => this.#zoomBy(1 / 0.7));
    this.on(this.$('#fit'), 'click', () => this.#fitWorld());
    this.on(this.$('#unit'), 'change', () => {
      this.#remember();
      this.#drawList();
    });
    this.on(this.$('#clear'), 'click', () => {
      this.#picked = [];
      this.#drawPicked();
    });
    this.keep(() => cancelAnimationFrame(this.#frame));

    this.#start();
  }

  async #start() {
    const loaded = await loadWorld();
    if (!this.isConnected) return;
    this.#world = loaded;
    this.$('#loading').hidden = true;
    this.#drawWorld();
    const kept = Array.isArray(this.#settings.picked) ? this.#settings.picked : null;
    if (this.#picked.length) {
      this.#drawPicked();
    } else if (kept) {
      for (const item of kept) if (loaded.byId.has(item.id)) this.#add(item.id, item.at, false);
      this.#drawPicked();
    } else {
      // a first look: Greenland, carried down to the equator beside Africa
      this.#add('grl', [-15, 4], false);
      this.#drawPicked();
    }
    this.#chips();
  }

  // ---- the map --------------------------------------------------------------

  #drawWorld() {
    const lines = [];
    for (let lon = -180; lon <= 180; lon += 30) lines.push(`M${lon} ${-mercatorY(LIMIT)}V${mercatorY(LIMIT)}`);
    for (let lat = -60; lat <= 80; lat += 20) lines.push(`M-180 ${-mercatorY(lat)}H180`);
    this.$('#graticule').replaceChildren(
      svgNode('path', { d: lines.join(''), class: 'grid' }),
      svgNode('path', { d: `M-180 0H180`, class: 'equator' }),
    );
    this.$('#land').replaceChildren(
      ...this.#world.countries.map((country) => {
        const path = svgNode('path', { d: mercatorPath(country.rings, 2), class: 'country', 'data-id': country.id, 'fill-rule': 'evenodd' });
        const title = svgNode('title');
        title.textContent = nameOf(country);
        path.append(title);
        return path;
      }),
    );
    this.#applyView();
  }

  #wireMap() {
    const host = this.$('#map');
    const pointers = new Map();
    let drag = null;
    let pinch = null;
    let moved = 0;

    const toMap = (clientX, clientY) => {
      const box = host.getBoundingClientRect();
      return [
        this.#view.x + ((clientX - box.left) / box.width) * this.#view.width,
        this.#view.y + ((clientY - box.top) / box.height) * this.#view.height,
      ];
    };

    this.on(host, 'wheel', (event) => {
      event.preventDefault();
      this.#zoomAt(toMap(event.clientX, event.clientY), Math.exp(clamp(event.deltaY, -120, 120) * (event.ctrlKey ? 0.01 : 0.0022)));
    }, { passive: false });

    this.on(host, 'pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      host.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, target: event.target });
      moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) };
        drag = null;
        return;
      }
      const copy = event.target.closest?.('.copy');
      if (copy) {
        const item = this.#picked.find((entry) => entry.key === copy.dataset.key);
        if (item) {
          const [x, y] = toMap(event.clientX, event.clientY);
          drag = { item, x, y, lon: item.at[0], northing: -mercatorY(item.at[1]) };
          this.#raise(item);
          host.dataset.dragging = 'true';
        }
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
      if (drag) {
        // the country follows the pointer in the map's own units, then is
        // carried over the globe to that place
        const [x, y] = toMap(event.clientX, event.clientY);
        const lon = drag.lon + (x - drag.x);
        const lat = clamp(mercatorLat(-(drag.northing + (y - drag.y))), -80, 80);
        drag.item.at = [((lon + 540) % 360) - 180, lat];
        this.#schedule(drag.item);
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
      if (drag) {
        this.#drawList();
        this.#remember();
        drag = null;
        return;
      }
      if (!last || event.type === 'pointercancel' || moved >= 6 || pointers.size) return;
      const country = last.target.closest?.('.country');
      if (country) this.#add(country.dataset.id);
    };
    this.on(host, 'pointerup', release);
    this.on(host, 'pointercancel', release);

    this.on(host, 'keydown', (event) => {
      const step = 0.12;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[event.key]) {
        event.preventDefault();
        this.#view.x += moves[event.key][0] * this.#view.width;
        this.#view.y += moves[event.key][1] * this.#view.height;
        this.#applyView();
      } else if (event.key === '+' || event.key === '=') this.#zoomBy(0.8);
      else if (event.key === '-' || event.key === '_') this.#zoomBy(1.25);
      else if (event.key === '0') this.#fitWorld();
    });

    let size = null;
    const watch = new ResizeObserver(() => {
      const box = host.getBoundingClientRect();
      if (!box.width || !box.height) return;
      if (size) {
        const middle = [this.#view.x + this.#view.width / 2, this.#view.y + this.#view.height / 2];
        const perPixel = this.#view.width / size.width;
        this.#view.width = box.width * perPixel;
        this.#view.height = box.height * perPixel;
        this.#view.x = middle[0] - this.#view.width / 2;
        this.#view.y = middle[1] - this.#view.height / 2;
        this.#applyView();
      } else {
        this.#fitWorld();
      }
      size = { width: box.width, height: box.height };
    });
    watch.observe(host);
    this.keep(() => watch.disconnect());
  }

  #fitWorld() {
    const host = this.$('#map').getBoundingClientRect();
    if (!host.width || !host.height) return;
    const box = { x: -180, y: -mercatorY(78), width: 360, height: mercatorY(78) + mercatorY(58) };
    const aspect = host.width / host.height;
    let { width, height } = box;
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    this.#view = { x: box.x + box.width / 2 - width / 2, y: box.y + box.height / 2 - height / 2, width, height };
    this.#applyView();
  }

  #zoomAt([px, py], factor) {
    const width = clamp(this.#view.width * factor, 4, 900);
    const scale = width / this.#view.width;
    this.#view = { x: px - (px - this.#view.x) * scale, y: py - (py - this.#view.y) * scale, width, height: this.#view.height * scale };
    this.#applyView();
  }

  #zoomBy(factor) {
    this.#zoomAt([this.#view.x + this.#view.width / 2, this.#view.y + this.#view.height / 2], factor);
  }

  #applyView() {
    const { x, y, width, height } = this.#view;
    const svg = this.$('#svg');
    svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    // lines and names keep their size on screen whatever the zoom
    const box = this.$('#map').getBoundingClientRect();
    svg.style.setProperty('--px', String(width / (box.width || 1)));
  }

  // ---- countries on the map ------------------------------------------------

  #add(id, at, draw = true) {
    const country = this.#world?.byId.get(id);
    if (!country) return;
    const used = new Set(this.#picked.map((item) => item.colour));
    const colour = COLOURS.find((value) => !used.has(value)) ?? COLOURS[this.#picked.length % COLOURS.length];
    const item = { key: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, id, country, colour, at: at ?? [...country.centre], node: null };
    this.#picked.push(item);
    if (draw) {
      this.#drawPicked();
      this.#remember();
    }
  }

  #raise(item) {
    this.#picked = [...this.#picked.filter((entry) => entry !== item), item];
    if (item.node) this.$('#pickedLayer').append(item.node);
  }

  #schedule(item) {
    item.dirty = true;
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      for (const entry of this.#picked) {
        if (!entry.dirty) continue;
        entry.dirty = false;
        this.#shape(entry);
      }
      this.#drawList({ quick: true });
    });
  }

  #shape(item) {
    const moved = moveShape(item.country.rings, item.country.centre, item.at);
    const path = item.node.querySelector('.shape');
    path.setAttribute('d', mercatorPath(moved, 2));
    const label = item.node.querySelector('.name');
    label.setAttribute('x', String(item.at[0]));
    label.setAttribute('y', String(-mercatorY(item.at[1])));
  }

  #drawPicked() {
    const layer = this.$('#pickedLayer');
    layer.replaceChildren(
      ...this.#picked.map((item) => {
        const group = svgNode('g', { class: 'copy', 'data-key': item.key, style: `--c:${item.colour}` });
        group.append(svgNode('path', { class: 'shape', 'fill-rule': 'evenodd' }));
        const label = svgNode('text', { class: 'name' });
        label.textContent = nameOf(item.country);
        group.append(label);
        item.node = group;
        this.#shape(item);
        return group;
      }),
    );
    this.$('#clear').hidden = !this.#picked.length;
    this.#drawList();
    this.#remember();
  }

  #area(value) {
    const unit = this.$('#unit').value;
    const shown = unit === 'mi' ? value / SQUARE_MILE : value;
    return `${new Intl.NumberFormat(language()).format(Math.round(shown))} ${unit === 'mi' ? 'mi²' : 'km²'}`;
  }

  #drawList({ quick = false } = {}) {
    const list = this.$('#list');
    if (quick) {
      // while dragging only the stretch changes
      for (const item of this.#picked) {
        const cell = list.querySelector(`[data-key="${item.key}"] .stretch`);
        if (cell) cell.textContent = this.#stretchText(item);
      }
      return;
    }
    const biggest = this.#picked.reduce((big, item) => (!big || item.country.area > big.country.area ? item : big), null);
    list.replaceChildren(
      ...(this.#picked.length
        ? this.#picked
            .slice()
            .reverse()
            .map((item) =>
              h(
                'li',
                { class: 'item', 'data-key': item.key, style: `--c:${item.colour}` },
                h('span', { class: 'swatch' }),
                h(
                  'div',
                  { class: 'item-text' },
                  h('strong', {}, nameOf(item.country)),
                  h('span', {}, this.#area(item.country.area)),
                  item !== biggest && biggest
                    ? h('span', { class: 'muted' }, t('true-size.timesSmaller', '{times}× smaller than {other}', { times: (biggest.country.area / item.country.area).toFixed(1), other: nameOf(biggest.country) }))
                    : null,
                  h('span', { class: 'muted stretch' }, this.#stretchText(item)),
                ),
                h('button', { type: 'button', class: 'icon', title: t('true-size.backHome', 'Back where it belongs'), 'aria-label': t('true-size.backHome', 'Back where it belongs'), onclick: () => this.#home(item) }, '↺'),
                h('button', { type: 'button', class: 'icon', title: t('true-size.remove', 'Remove'), 'aria-label': t('true-size.remove', 'Remove'), onclick: () => this.#remove(item) }, '×'),
              ),
            )
        : [h('li', { class: 'empty' }, t('true-size.nothingYet', 'Nothing on the map yet. Add a country to compare.'))]),
    );
  }

  #stretchText(item) {
    const home = mercatorStretch(item.country.centre[1]);
    const here = mercatorStretch(item.at[1]);
    return t('true-size.drawnAt', 'Drawn {times}× as big as at the equator', { times: here.toFixed(1) }) + (Math.abs(here - home) > 0.05 ? '' : '');
  }

  #home(item) {
    item.at = [...item.country.centre];
    this.#shape(item);
    this.#drawList();
    this.#remember();
  }

  #remove(item) {
    this.#picked = this.#picked.filter((entry) => entry !== item);
    this.#drawPicked();
  }

  // ---- finding countries ----------------------------------------------------

  #search(countries, query) {
    const wanted = fold(query);
    if (!wanted) return [];
    const scored = [];
    for (const country of countries) {
      let best = Infinity;
      for (const name of Object.values(country.names).map(fold)) {
        if (name === wanted) best = Math.min(best, 0);
        else if (name.startsWith(wanted)) best = Math.min(best, 1);
        else if (name.split(/\s+/).some((word) => word.startsWith(wanted))) best = Math.min(best, 2);
        else if (name.includes(wanted)) best = Math.min(best, 3);
      }
      if (best < Infinity) scored.push({ best, country });
    }
    return scored.sort((a, b) => a.best - b.best || b.country.area - a.country.area).map((entry) => entry.country).slice(0, 8);
  }

  #wireSearch() {
    const input = this.$('#search');
    const list = this.$('#suggest');
    let matches = [];
    let active = 0;
    const close = () => {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    };
    const choose = (country) => {
      close();
      input.value = '';
      this.#add(country.id);
    };
    const show = () => {
      matches = this.#world ? this.#search(this.#world.countries, input.value) : [];
      active = 0;
      list.replaceChildren(
        ...(matches.length
          ? matches.map((country, index) =>
              h(
                'li',
                {
                  role: 'option',
                  class: index === active ? 'active' : '',
                  onpointerdown: (event) => {
                    event.preventDefault();
                    choose(country);
                  },
                },
                h('span', {}, nameOf(country)),
                h('span', { class: 'muted' }, this.#area(country.area)),
              ),
            )
          : [h('li', { class: 'empty' }, t('true-size.noMatch', 'No country matches'))]),
      );
      list.hidden = !input.value.trim();
      input.setAttribute('aria-expanded', String(!list.hidden));
    };
    const mark = () => [...list.children].forEach((item, index) => item.classList.toggle('active', index === active));
    this.on(input, 'input', show);
    this.on(input, 'keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!matches.length) return;
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        mark();
      } else if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        if (list.hidden && input.value.trim()) show();
        if (matches[active]) choose(matches[active]);
      } else if (event.key === 'Escape') {
        close();
        input.blur();
      }
    });
    this.on(input, 'blur', close);
  }

  #chips() {
    this.$('#chips').replaceChildren(
      ...TRY.map((id) => this.#world.byId.get(id))
        .filter(Boolean)
        .map((country) => h('button', { type: 'button', class: 'chip', onclick: () => this.#add(country.id) }, `+ ${nameOf(country)}`)),
    );
  }

  #remember() {
    this.store.write({
      unit: this.$('#unit').value,
      picked: this.#picked.map((item) => ({ id: item.id, at: item.at.map((value) => Math.round(value * 100) / 100) })),
    });
  }
}

define('jg-app-true-size', TrueSize);
