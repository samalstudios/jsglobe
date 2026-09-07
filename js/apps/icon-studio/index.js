import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { copyText, download, toast, debounce } from '../../core/util.js';
import { ai } from '../../core/ai.js';
import { parts, groups, findPart, searchParts, partMarkup } from '../../lib/icon-parts.js';
import { PALETTES, SYSTEM, composeFromWords, readLayers, shortlist } from '../../lib/icon-compose.js';

const t = await appWords('icon-studio', (lang) => import(`./i18n/${lang}.js`));
const sheet = await styleSheet(import.meta.url);

const SIZES = [16, 24, 32, 48, 64, 128, 256];

const groupName = (id) =>
  ({
    shapes: t('icon-studio.group.shapes', 'Shapes'),
    pattern: t('icon-studio.group.pattern', 'Patterns'),
    decor: t('icon-studio.group.decor', 'Decoration'),
    symbols: t('icon-studio.group.symbols', 'Symbols'),
    nature: t('icon-studio.group.nature', 'Nature'),
    mechanical: t('icon-studio.group.mechanical', 'Mechanical'),
    arrows: t('icon-studio.group.arrows', 'Arrows'),
  })[id] ?? id;
const newId = () => Math.random().toString(36).slice(2, 9);

class IconStudio extends JGApp {
  static appId = 'icon-studio';
  static settings = [
    { key: 'grid', label: t('icon-studio.showGuides', 'Show the guides'), type: 'switch', default: true },
    { key: 'plate', label: t('icon-studio.drawPlate', 'Draw a background plate'), type: 'switch', default: true },
  ];
  static styles = [...JGApp.styles, sheet];

  #layers = [];
  #picked = null;
  #hunt = '';
  #group = 'all';
  #busy = false;
  #stop = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head"><jg-toolbar id="bar"></jg-toolbar></div>
      <div class="body">
        <div class="library">
          <jg-input id="hunt" size="sm" placeholder="${t('icon-studio.searchParts', 'Search parts')}" autocomplete="off"></jg-input>
          <div class="chips" id="chips"></div>
          <div class="shelf" id="shelf"></div>
          <div class="count" id="count"></div>
        </div>

        <div class="stage">
          <div class="canvas" id="canvas"></div>
          <div class="ask">
            <jg-input id="prompt" placeholder="${t('icon-studio.describeAnIcon', 'Describe an icon, for example: a shield with a star')}" autocomplete="off"></jg-input>
            <jg-button id="make" variant="primary">${t('icon-studio.make', 'Make it')}</jg-button>
            <jg-button id="halt" variant="outline" hidden>${t('icon-studio.stop', 'Stop')}</jg-button>
          </div>
          <div class="note" id="note"></div>
          <div class="sizes" id="sizes"></div>
        </div>

        <aside class="side">
          <div class="label">${t('icon-studio.layers', 'Layers')}</div>
          <div class="stack" id="stack"></div>
          <div class="sep"></div>
          <div id="inspector"></div>
        </aside>
      </div>
    </div>`);

    this.#toolbar();
    this.#chips();
    this.#shelf();
    this.#draw();
    this.#stack();
    this.#inspector();

    const hunt = this.$('#hunt');
    this.on(hunt, 'input', debounce(() => {
      this.#hunt = hunt.value;
      this.#shelf();
    }, 140));

    this.on(this.$('#make'), 'click', () => this.#make());
    this.on(this.$('#halt'), 'click', () => this.#stop?.abort());
    this.on(this.$('#prompt'), 'keydown', (event) => {
      if (event.key === 'Enter') this.#make();
    });
  }

  #toolbar() {
    this.$('#bar').items = [
      { id: 'clear', label: t('icon-studio.clear', 'Clear'), icon: 'file', action: () => this.#clear() },
      { id: 'shuffle', label: t('icon-studio.surprise', 'Surprise me'), icon: 'dice', action: () => this.#surprise() },
      { separator: true },
      { id: 'up', label: t('icon-studio.raise', 'Raise'), icon: 'toFront', iconOnly: true, title: t('icon-studio.raiseTheLayer', 'Move the layer up'), action: () => this.#shift(1) },
      { id: 'down', label: t('icon-studio.lower', 'Lower'), icon: 'toBack', iconOnly: true, title: t('icon-studio.lowerTheLayer', 'Move the layer down'), action: () => this.#shift(-1) },
      { id: 'drop', label: t('icon-studio.remove', 'Remove'), icon: 'eraser', iconOnly: true, danger: true, title: t('icon-studio.removeTheLayer', 'Remove the layer'), action: () => this.#drop() },
      { spacer: true },
      { id: 'copy', label: t('icon-studio.copySvg', 'Copy SVG'), icon: 'copy', action: () => this.#copy() },
      { id: 'svg', label: t('icon-studio.saveSvg', 'Save SVG'), icon: 'download', iconOnly: true, title: t('icon-studio.saveAsSvg', 'Save as SVG'), action: () => this.#saveSvg() },
      { id: 'png', label: t('icon-studio.savePng', 'Save PNG'), icon: 'image', iconOnly: true, title: t('icon-studio.saveAsPng', 'Save as PNG'), action: () => this.#savePng() },
    ];
  }

  // ---- library ---------------------------------------------------------

  #chips() {
    const target = this.$('#chips');
    const all = parts().length;
    target.innerHTML = html`
      <button class="chip ${this.#group === 'all' ? 'on' : ''}" data-group="all">${t('icon-studio.all', 'All')} <span>${all}</span></button>
      ${groups()
        .sort((a, b) => b.count - a.count)
        .map(
          (group) => html`<button class="chip ${this.#group === group.id ? 'on' : ''}" data-group="${group.id}">
            ${groupName(group.id)} <span>${group.count}</span>
          </button>`,
        )}
    `;
    this.bind('[data-group]', 'click', (event) => {
      this.#group = event.currentTarget.dataset.group;
      this.#chips();
      this.#shelf();
    });
  }

  #shelf() {
    const target = this.$('#shelf');
    let list = this.#hunt ? searchParts(this.#hunt, 2000) : parts();
    if (this.#group !== 'all') list = list.filter((part) => part.group === this.#group);
    const shown = list.slice(0, 300);

    target.innerHTML = html`${shown.map(
      (part) => html`<button class="part" data-part="${part.id}" title="${part.label}">
        ${raw(`<svg viewBox="0 0 100 100" aria-hidden="true">${partMarkup(part, { fill: 'currentColor', width: 5 })}</svg>`)}
      </button>`,
    )}`;

    this.$('#count').textContent = t('icon-studio.showing', 'Showing {shown} of {total} parts', {
      shown: shown.length,
      total: list.length,
    });

    this.bind('[data-part]', 'click', (event) => this.#add(event.currentTarget.dataset.part));
  }

  // ---- the icon --------------------------------------------------------

  #colours() {
    return PALETTES[Object.keys(PALETTES)[0]];
  }

  #add(id) {
    const part = findPart(id);
    if (!part) return;
    const shades = this.#colours();
    this.#layers.push({
      id: newId(),
      part: id,
      fill: shades[this.#layers.length % shades.length],
      scale: this.#layers.length ? 0.6 : 1,
      x: 0,
      y: 0,
      rotate: 0,
    });
    this.#picked = this.#layers.at(-1).id;
    this.#draw();
    this.#stack();
    this.#inspector();
  }

  #svg(size = 100, forExport = false) {
    const plate = this.config.get('plate', true) && !forExport ? '' : '';
    const body = this.#layers
      .map((layer) => {
        const part = findPart(layer.part);
        if (!part) return '';
        return `<g transform="translate(${50 + layer.x} ${50 + layer.y}) rotate(${layer.rotate}) scale(${layer.scale}) translate(-50 -50)">${partMarkup(
          part,
          { fill: layer.fill, width: 6 },
        )}</g>`;
      })
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${plate}${body}</svg>`;
  }

  #draw() {
    const canvas = this.$('#canvas');
    if (!canvas) return;
    const guides = this.config.get('grid', true);
    canvas.dataset.guides = String(guides);
    canvas.dataset.plate = String(this.config.get('plate', true));
    canvas.innerHTML = html`${raw(this.#svg(340))}`;
    this.#sizes();
  }

  #sizes() {
    const target = this.$('#sizes');
    if (!target) return;
    target.innerHTML = html`${SIZES.map(
      (size) => html`<div class="peek"><div class="shot" style="width:${size}px;height:${size}px">${raw(this.#svg(size))}</div><span>${size}</span></div>`,
    )}`;
  }

  #stack() {
    const target = this.$('#stack');
    if (!target) return;
    if (!this.#layers.length) {
      target.innerHTML = html`<p class="hint">${t('icon-studio.noLayers', 'Nothing yet. Pick a part on the left, or describe an icon below.')}</p>`;
      return;
    }
    target.innerHTML = html`${[...this.#layers].reverse().map((layer) => {
      const part = findPart(layer.part);
      return html`<button class="row ${this.#picked === layer.id ? 'on' : ''}" data-layer="${layer.id}">
        <span class="swatch" style="background:${layer.fill}"></span>
        <span class="what">${part?.label ?? layer.part}</span>
      </button>`;
    })}`;
    this.bind('[data-layer]', 'click', (event) => {
      this.#picked = event.currentTarget.dataset.layer;
      this.#stack();
      this.#inspector();
    });
  }

  #current() {
    return this.#layers.find((layer) => layer.id === this.#picked) ?? null;
  }

  #inspector() {
    const target = this.$('#inspector');
    if (!target) return;
    const layer = this.#current();
    if (!layer) {
      target.innerHTML = html`<p class="hint">${t('icon-studio.pickALayer', 'Pick a layer to change it.')}</p>`;
      return;
    }

    target.innerHTML = html`
      <jg-field label="${t('icon-studio.colour', 'Colour')}"><jg-input id="fill" size="sm" type="color" value="${layer.fill}"></jg-input></jg-field>
      <div class="swatches">
        ${Object.entries(PALETTES).map(
          ([name, shades]) => html`<button class="tone" data-tone="${shades[0]}" title="${name}" style="background:${shades[0]}"></button>`,
        )}
      </div>
      <jg-field label="${t('icon-studio.size', 'Size')}"><jg-slider id="scale" min="20" max="120" step="1" value="${Math.round(layer.scale * 100)}"></jg-slider></jg-field>
      <jg-field label="${t('icon-studio.turn', 'Turn')}"><jg-slider id="rotate" min="-180" max="180" step="1" value="${layer.rotate}"></jg-slider></jg-field>
      <jg-field label="${t('icon-studio.across', 'Across')}"><jg-slider id="x" min="-40" max="40" step="1" value="${layer.x}"></jg-slider></jg-field>
      <jg-field label="${t('icon-studio.down', 'Down')}"><jg-slider id="y" min="-40" max="40" step="1" value="${layer.y}"></jg-slider></jg-field>
    `;

    const live = (id, apply) => {
      const field = this.$(`#${id}`);
      if (!field) return;
      this.on(field, 'input', () => {
        apply(field.value);
        this.#draw();
        this.#stack();
      });
      this.on(field, 'change', () => {
        apply(field.value);
        this.#draw();
        this.#stack();
      });
    };

    live('fill', (value) => { layer.fill = value; });
    live('scale', (value) => { layer.scale = Number(value) / 100; });
    live('rotate', (value) => { layer.rotate = Number(value); });
    live('x', (value) => { layer.x = Number(value); });
    live('y', (value) => { layer.y = Number(value); });

    this.bind('[data-tone]', 'click', (event) => {
      layer.fill = event.currentTarget.dataset.tone;
      this.#draw();
      this.#stack();
      this.#inspector();
    });
  }

  #shift(direction) {
    const index = this.#layers.findIndex((layer) => layer.id === this.#picked);
    if (index < 0) return;
    const to = index + direction;
    if (to < 0 || to >= this.#layers.length) return;
    const [moved] = this.#layers.splice(index, 1);
    this.#layers.splice(to, 0, moved);
    this.#draw();
    this.#stack();
  }

  #drop() {
    if (!this.#picked) return;
    this.#layers = this.#layers.filter((layer) => layer.id !== this.#picked);
    this.#picked = this.#layers.at(-1)?.id ?? null;
    this.#draw();
    this.#stack();
    this.#inspector();
  }

  #clear() {
    this.#layers = [];
    this.#picked = null;
    this.#draw();
    this.#stack();
    this.#inspector();
  }

  #surprise() {
    const all = parts();
    const pick = () => all[Math.floor(Math.random() * all.length)];
    const shades = Object.values(PALETTES)[Math.floor(Math.random() * Object.keys(PALETTES).length)];
    this.#layers = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, (item, index) => ({
      id: newId(),
      part: pick().id,
      fill: shades[index % shades.length],
      scale: index ? 0.45 + Math.random() * 0.35 : 1,
      x: index ? Math.round((Math.random() - 0.5) * 20) : 0,
      y: index ? Math.round((Math.random() - 0.5) * 20) : 0,
      rotate: index ? Math.round((Math.random() - 0.5) * 60) : 0,
    }));
    this.#picked = this.#layers.at(-1).id;
    this.#draw();
    this.#stack();
    this.#inspector();
  }

  #apply(result) {
    this.#layers = result.layers.map((layer) => ({ id: newId(), ...layer }));
    this.#picked = this.#layers.at(-1)?.id ?? null;
    this.#draw();
    this.#stack();
    this.#inspector();
  }

  // ---- from a prompt ---------------------------------------------------

  async #make() {
    const prompt = this.$('#prompt').value.trim();
    const note = this.$('#note');

    // Any request still in flight is abandoned, so a second prompt is never
    // ignored while a model that may never answer is still being waited on.
    this.#stop?.abort();

    // Put something on the canvas at once, then let the model improve on it.
    this.#apply(composeFromWords(prompt));

    if (!ai.isEnabled()) {
      note.textContent = t('icon-studio.builtFromWords', 'Built from the words alone. Turn on local AI in settings for a closer read.');
      return;
    }

    const controller = new AbortController();
    this.#stop = controller;
    this.#busy = true;
    this.$('#halt').hidden = false;
    this.$('#make').setAttribute('disabled', '');
    note.textContent = t('icon-studio.thinking', 'The model is choosing parts...');

    // A model that has not been downloaded yet can sit there indefinitely, so
    // the wait is bounded and the words result simply stands.
    const timer = setTimeout(() => controller.abort(), 30000);
    const givenUp = new Promise((resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')), { once: true });
    });

    const menu = shortlist(prompt)
      .map((part) => `${part.id} = ${part.label}`)
      .join('\n');

    try {
      const answer = await Promise.race([
        ai.complete(SYSTEM, `Parts you may use:\n${menu}\n\nIcon to design: ${prompt}`, { signal: controller.signal }),
        givenUp,
      ]);
      const result = readLayers(answer);
      if (result) {
        this.#apply(result);
        note.textContent = t('icon-studio.builtByModel', 'Built by the model from {count} parts.', { count: result.layers.length });
      } else {
        note.textContent = t('icon-studio.modelMissed', 'The model did not name parts that exist, so this was built from the words.');
      }
    } catch (error) {
      note.textContent = error.name === 'AbortError'
        ? t('icon-studio.stopped', 'Stopped. This was built from the words.')
        : t('icon-studio.builtFromWords', 'Built from the words alone. Turn on local AI in settings for a closer read.');
    } finally {
      clearTimeout(timer);
      if (this.#stop === controller) {
        this.#stop = null;
        this.#busy = false;
        this.$('#halt').hidden = true;
        this.$('#make').removeAttribute('disabled');
      }
    }
  }

  // ---- getting it out --------------------------------------------------

  #copy() {
    if (!this.#layers.length) return;
    copyText(this.#svg(256));
    toast(t('icon-studio.svgCopied', 'SVG copied'));
  }

  #saveSvg() {
    if (!this.#layers.length) return;
    download('icon.svg', this.#svg(256), 'image/svg+xml');
  }

  async #savePng() {
    if (!this.#layers.length) return;
    const size = 512;
    const blob = new Blob([this.#svg(size)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = 'sync';
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('render failed'));
        image.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(image, 0, 0, size, size);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (png) download('icon.png', png, 'image/png');
    } catch {
      toast(t('icon-studio.pngFailed', 'That icon could not be turned into a PNG'), 'danger');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('icon-studio.iconStudio', 'Icon Studio')}</div>
        <div class="hint">${t('icon-studio.widgetBlurb', 'Build an icon from thousands of parts.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-icon-studio', IconStudio);
