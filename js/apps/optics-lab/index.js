import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { collapsibleGroups, paletteSheet } from '../../ui/palette.js';
import { icon } from '../../ui/icons.js';
import { toast, download } from '../../core/util.js';
import { createDesigns } from '../../lib/designs.js';
import {
  traceRay, SPECTRUM, idealLens, sphericalLens, planeMirror, curvedMirror,
  glassBlock, glassSphere, prism, screen, blocker, beamRays, fanRays, laserRay,
  thinLensImage, concaveLens,
} from '../../lib/optics.js';
import SCENES from './scenes.js';

const t = appText(strings);
const sheet = await styleSheet(import.meta.url);

const SOURCES = {
  laser: { label: () => t('optics-lab.laser', 'Laser'), icon: 'activity' },
  beam: { label: () => t('optics-lab.beam', 'Beam'), icon: 'alignLeft' },
  point: { label: () => t('optics-lab.pointSource', 'Point source'), icon: 'sun' },
  white: { label: () => t('optics-lab.whiteLight', 'White light'), icon: 'palette' },
};

const LENSES = {
  lensIdeal: { label: () => t('optics-lab.idealLens', 'Ideal lens'), icon: 'circle' },
  lensGlass: { label: () => t('optics-lab.convexLens', 'Convex lens'), icon: 'lensConvex' },
  lensConcave: { label: () => t('optics-lab.concaveLens', 'Concave lens'), icon: 'lensConcave' },
};

const MIRRORS = {
  mirrorPlane: { label: () => t('optics-lab.flatMirror', 'Flat mirror'), icon: 'mirror' },
  mirrorConcave: { label: () => t('optics-lab.concaveMirror', 'Concave mirror'), icon: 'mirrorConcave' },
  mirrorConvex: { label: () => t('optics-lab.convexMirror', 'Convex mirror'), icon: 'mirrorConvex' },
};

const GLASS = {
  block: { label: () => t('optics-lab.glassBlock', 'Glass block'), icon: 'square' },
  prism: { label: () => t('optics-lab.prism', 'Prism'), icon: 'play' },
  drop: { label: () => t('optics-lab.waterDrop', 'Water drop'), icon: 'circle' },
};

const OTHER = {
  screen: { label: () => t('optics-lab.screen', 'Screen'), icon: 'monitor' },
  blocker: { label: () => t('optics-lab.barrier', 'Barrier'), icon: 'stop' },
  aperture: { label: () => t('optics-lab.slit', 'Slit'), icon: 'crop' },
};

const KINDS = { ...SOURCES, ...LENSES, ...MIRRORS, ...GLASS, ...OTHER };

const TINT_NAMES = {
  660: () => t('optics-lab.red', 'Red'),
  610: () => t('optics-lab.orange', 'Orange'),
  580: () => t('optics-lab.yellow', 'Yellow'),
  540: () => t('optics-lab.green', 'Green'),
  490: () => t('optics-lab.cyan', 'Cyan'),
  450: () => t('optics-lab.blue', 'Blue'),
  420: () => t('optics-lab.violet', 'Violet'),
};

const tintFor = (wavelength) => SPECTRUM.find((entry) => entry.wavelength === wavelength) ?? SPECTRUM[2];

const SCENE_NAMES = {
  focus: () => t('optics-lab.scene.focus', 'Lens brings light to a focus'),
  image: () => t('optics-lab.scene.image', 'Forming an image'),
  diverging: () => t('optics-lab.scene.diverging', 'A diverging lens'),
  glassLens: () => t('optics-lab.scene.glassLens', 'A real glass lens'),
  prism: () => t('optics-lab.scene.prism', 'A prism splits white light'),
  rainbow: () => t('optics-lab.scene.rainbow', 'Light inside a raindrop'),
  trapped: () => t('optics-lab.scene.trapped', 'Light trapped in glass'),
  slab: () => t('optics-lab.scene.slab', 'A slab shifts a ray sideways'),
  dish: () => t('optics-lab.scene.dish', 'A curved mirror focuses'),
  periscope: () => t('optics-lab.scene.periscope', 'Periscope'),
  telescope: () => t('optics-lab.scene.telescope', 'Telescope'),
  pinhole: () => t('optics-lab.scene.pinhole', 'Pinhole camera'),
};

const sceneName = (key, scene) => (SCENE_NAMES[key] ?? (() => scene.name))();
const isSource = (kind) => kind in SOURCES;

const DEFAULTS = {
  laser: { angle: 0, tint: 580 },
  beam: { angle: 0, width: 120, rays: 9, tint: 580 },
  point: { angle: 0, spread: 0.5, rays: 11, tint: 580 },
  white: { angle: 0, rays: 1 },
  lensIdeal: { angle: 0, height: 160, focal: 150 },
  lensGlass: { angle: 0, height: 150, curve: 0.0035, index: 1.52 },
  lensConcave: { angle: 0, height: 150, curve: 0.0035, index: 1.52 },
  mirrorPlane: { angle: Math.PI / 2, length: 160 },
  mirrorConcave: { angle: Math.PI, radius: 300, span: 1 },
  mirrorConvex: { angle: 0, radius: 300, span: 1 },
  block: { angle: 0, width: 160, height: 200, index: 1.52 },
  prism: { angle: 0, size: 110, index: 1.52 },
  drop: { angle: 0, radius: 90, index: 1.333 },
  screen: { angle: Math.PI / 2, height: 260 },
  blocker: { angle: Math.PI / 2, height: 160 },
  aperture: { angle: Math.PI / 2, height: 300, gap: 16 },
};

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

class OpticsLab extends JGApp {
  static appId = 'optics-lab';
  static settings = [
    { key: 'grid', label: t('optics-lab.showGrid', 'Show the grid'), type: 'switch', default: true },
    { key: 'glow', label: t('optics-lab.glowingRays', 'Let the rays glow'), type: 'switch', default: true },
    { key: 'bounces', label: t('optics-lab.bounces', 'Times a ray may bend'), type: 'select', default: '24',
      options: [{ value: '8', label: '8' }, { value: '16', label: '16' }, { value: '24', label: '24' }, { value: '40', label: '40' }] },
  ];
  static styles = [...JGApp.styles, paletteSheet, sheet];

  #elements = [];
  #selected = null;
  #tool = 'select';
  #pan = { x: 0, y: 0 };
  #zoom = 1;
  #drag = null;
  #frame = null;
  #past = [];
  #designs = createDesigns(this.store, 'optics');
  #openName = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head"><jg-toolbar id="bar"></jg-toolbar></div>
      <div class="body">
        <div class="palette" id="palette"></div>
        <div class="board">
          <canvas id="view"></canvas>
          <div class="readout" id="readout"></div>
          <div class="hint-bar"><b id="tool-name">${t('optics-lab.select', 'Select')}</b><span id="tool-hint"></span></div>
        </div>
        <aside class="side">
          <div class="label">${t('optics-lab.saved', 'Saved')}</div>
          <div class="row tight">
            <jg-input id="name" size="sm" placeholder="${t('optics-lab.nameThisSetup', 'Name this setup')}"></jg-input>
            <jg-button size="sm" id="save">${t('optics-lab.save', 'Save')}</jg-button>
          </div>
          <div class="saved" id="saved"></div>
          <div class="sep"></div>
          <div id="inspector"></div>
        </aside>
      </div>

      <jg-dialog id="gallery" title-text="${t('optics-lab.gallery', 'Gallery')}" sub="${t('optics-lab.pickASetup', 'Pick a setup to start from. It replaces what is on the bench.')}">
        <jg-input id="hunt" size="sm" placeholder="${t('optics-lab.searchTheGallery', 'Search the gallery')}" autocomplete="off"></jg-input>
        <div class="gallery" id="scenes"></div>
        <p class="nothing" id="nothing" hidden>${t('optics-lab.nothingMatchesThat', 'Nothing matches that.')}</p>
      </jg-dialog>
    </div>`);

    this.#toolbar();
    this.#buildPalette();
    this.#wireBoard();
    this.#load('focus');
    this.#saved();
    this.#inspector();
    this.#fit();
  }

  #buildPalette() {
    const group = (title, table) => html`
      <div class="group">${title}</div>
      ${Object.entries(table).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>${meta.label()}</span>
        </button>`,
      )}
    `;

    this.$('#palette').innerHTML = html`
      <div class="group">${t('optics-lab.edit', 'Edit')}</div>
      <button class="tool" data-tool="select" aria-pressed="${String(this.#tool === 'select')}">
        ${icon('launcher', 15)}<span>${t('optics-lab.select', 'Select')}</span>
      </button>
      <button class="tool" data-tool="erase" aria-pressed="${String(this.#tool === 'erase')}">
        ${icon('eraser', 15)}<span>${t('optics-lab.erase', 'Erase')}</span>
      </button>
      ${group(t('optics-lab.sources', 'Sources'), SOURCES)}
      ${group(t('optics-lab.lenses', 'Lenses'), LENSES)}
      ${group(t('optics-lab.mirrors', 'Mirrors'), MIRRORS)}
      ${group(t('optics-lab.glass', 'Glass'), GLASS)}
      ${group(t('optics-lab.other', 'Other'), OTHER)}
    `;

    const palette = this.$('#palette');
    if (!palette.dataset.wired) {
      palette.dataset.wired = 'true';
      this.on(palette, 'click', (event) => {
        const button = event.target.closest?.('[data-tool]');
        if (button) this.#setTool(button.dataset.tool);
      });
    }

    collapsibleGroups(palette, { store: this.config, key: 'palette.folded' });
  }

  #setTool(tool) {
    this.#tool = tool;
    this.$$('.tool').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.tool === tool)));
    const name = this.$('#tool-name');
    const hint = this.$('#tool-hint');
    if (name) name.textContent = tool === 'select' ? t('optics-lab.select', 'Select') : tool === 'erase' ? t('optics-lab.erase', 'Erase') : KINDS[tool]?.label() ?? tool;
    if (hint) {
      hint.textContent =
        tool === 'select'
          ? t('optics-lab.dragToMove', 'Drag a piece to move it, drag the bench to pan, scroll to zoom.')
          : tool === 'erase'
            ? t('optics-lab.clickToRemove', 'Click a piece to take it off the bench.')
            : t('optics-lab.clickToPlace', 'Click the bench to put one down.');
    }
  }

  #toolbar() {
    this.$('#bar').items = [
      { id: 'gallery', label: t('optics-lab.gallery', 'Gallery'), icon: 'widgets', action: () => this.#openGallery() },
      { id: 'new', label: t('optics-lab.new', 'New'), icon: 'file', iconOnly: true, title: t('optics-lab.emptyBench', 'Start with an empty bench'), action: () => this.#blank() },
      { id: 'undo', label: t('optics-lab.undo', 'Undo'), icon: 'undo', iconOnly: true, title: t('optics-lab.undo', 'Undo'), action: () => this.#undo() },
      { separator: true },
      { id: 'zoom-out', label: t('optics-lab.zoomOut', 'Zoom out'), icon: 'minus', iconOnly: true, title: t('optics-lab.zoomOut', 'Zoom out'), action: () => this.#step(1 / 1.25) },
      { id: 'zoom-fit', label: t('optics-lab.fit', 'Fit'), icon: 'maximize', iconOnly: true, title: t('optics-lab.fitTheBench', 'Fit the bench to the view'), action: () => this.#fit() },
      { id: 'zoom-in', label: t('optics-lab.zoomIn', 'Zoom in'), icon: 'plus', iconOnly: true, title: t('optics-lab.zoomIn', 'Zoom in'), action: () => this.#step(1.25) },
      { separator: true },
      { id: 'turn', label: t('optics-lab.rotate', 'Rotate'), icon: 'rotate', iconOnly: true, title: t('optics-lab.turnTheSelected', 'Turn the selected piece'), action: () => this.#turn(Math.PI / 24) },
      { id: 'delete', label: t('optics-lab.delete', 'Delete'), icon: 'eraser', iconOnly: true, danger: true, title: t('optics-lab.removeTheSelected', 'Take the selected piece off'), action: () => this.#remove() },
      { spacer: true },
      { id: 'png', label: t('optics-lab.savePng', 'Save PNG'), icon: 'download', iconOnly: true, title: t('optics-lab.saveAsPng', 'Save the bench as a picture'), action: () => this.#savePng() },
    ];
  }

  #wireBoard() {
    const canvas = this.$('#view');
    this.on(canvas, 'pointerdown', (event) => this.#down(event));
    this.on(canvas, 'pointermove', (event) => this.#move(event));
    this.on(canvas, 'pointerup', () => { this.#drag = null; });
    this.on(canvas, 'pointerleave', () => { this.#drag = null; });
    this.on(canvas, 'wheel', (event) => {
      event.preventDefault();
      this.#step(event.deltaY < 0 ? 1.1 : 1 / 1.1, this.#point(event));
    }, { passive: false });

    const watcher = new ResizeObserver(() => this.#draw());
    watcher.observe(canvas);
    this.track(() => watcher.disconnect());
    this.#setTool('select');
  }

  #point(event) {
    const canvas = this.$('#view');
    const box = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - box.left - this.#pan.x) / this.#zoom,
      y: (event.clientY - box.top - this.#pan.y) / this.#zoom,
    };
  }

  #handleAt(element) {
    const distance = this.#reachOf(element) + 24 / this.#zoom;
    return { x: element.x + Math.cos(element.angle) * distance, y: element.y + Math.sin(element.angle) * distance };
  }

  #overHandle(point) {
    const element = this.#current();
    if (!element) return false;
    const handle = this.#handleAt(element);
    return Math.hypot(point.x - handle.x, point.y - handle.y) <= 11 / this.#zoom;
  }

  #at(point) {
    for (let index = this.#elements.length - 1; index >= 0; index -= 1) {
      const element = this.#elements[index];
      const reach = this.#reachOf(element);
      if (Math.hypot(point.x - element.x, point.y - element.y) <= reach) return element;
    }
    return null;
  }

  #reachOf(element) {
    const spec = element;
    return Math.max(
      34,
      (spec.height ?? spec.width ?? spec.length ?? spec.size ?? spec.radius ?? 60) / 2 + 12,
    );
  }

  #down(event) {
    const point = this.#point(event);
    this.$('#view').setPointerCapture?.(event.pointerId);

    if (this.#tool === 'erase') {
      const hit = this.#at(point);
      if (hit) {
        this.#snapshot();
        this.#elements = this.#elements.filter((entry) => entry !== hit);
        if (this.#selected === hit.id) this.#selected = null;
        this.#draw();
        this.#inspector();
      }
      return;
    }

    if (this.#tool !== 'select') {
      this.#snapshot();
      const kind = this.#tool;
      const element = { id: Math.random().toString(36).slice(2, 9), kind, x: Math.round(point.x), y: Math.round(point.y), ...DEFAULTS[kind] };
      this.#elements.push(element);
      this.#selected = element.id;
      this.#setTool('select');
      this.#draw();
      this.#inspector();
      return;
    }

    if (this.#overHandle(point)) {
      const element = this.#current();
      this.#snapshot();
      this.#drag = { kind: 'turn', element };
      return;
    }

    const hit = this.#at(point);
    if (hit) {
      this.#selected = hit.id;
      this.#drag = { kind: 'element', element: hit, from: point, origin: { x: hit.x, y: hit.y } };
      this.#draw();
      this.#inspector();
      return;
    }

    this.#selected = null;
    this.#drag = { kind: 'pan', from: { x: event.clientX, y: event.clientY }, origin: { ...this.#pan } };
    this.#draw();
    this.#inspector();
  }

  #move(event) {
    if (!this.#drag) {
      const canvas = this.$('#view');
      if (canvas && this.#tool === 'select') {
        canvas.style.cursor = this.#overHandle(this.#point(event)) ? 'grab' : '';
      }
      return;
    }

    if (this.#drag.kind === 'turn') {
      const point = this.#point(event);
      const element = this.#drag.element;
      let angle = Math.atan2(point.y - element.y, point.x - element.x);
      if (event.shiftKey) {
        const step = Math.PI / 12;
        angle = Math.round(angle / step) * step;
      }
      element.angle = angle;
      this.#draw();
      this.#inspector();
      return;
    }

    if (this.#drag.kind === 'pan') {
      this.#pan = {
        x: this.#drag.origin.x + (event.clientX - this.#drag.from.x),
        y: this.#drag.origin.y + (event.clientY - this.#drag.from.y),
      };
      this.#draw();
      return;
    }
    const point = this.#point(event);
    const element = this.#drag.element;
    element.x = Math.round(this.#drag.origin.x + (point.x - this.#drag.from.x));
    element.y = Math.round(this.#drag.origin.y + (point.y - this.#drag.from.y));
    this.#draw();
    this.#inspector();
  }

  #step(factor, about) {
    const canvas = this.$('#view');
    const centre = about ?? { x: (canvas.clientWidth / 2 - this.#pan.x) / this.#zoom, y: (canvas.clientHeight / 2 - this.#pan.y) / this.#zoom };
    const next = clamp(this.#zoom * factor, 0.15, 6);
    this.#pan = {
      x: this.#pan.x + centre.x * (this.#zoom - next),
      y: this.#pan.y + centre.y * (this.#zoom - next),
    };
    this.#zoom = next;
    this.#draw();
  }

  #fit() {
    const canvas = this.$('#view');
    if (!canvas.clientWidth) return;
    if (!this.#elements.length) {
      this.#zoom = 1;
      this.#pan = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
      this.#draw();
      return;
    }
    const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const element of this.#elements) {
      const reach = this.#reachOf(element);
      bounds.left = Math.min(bounds.left, element.x - reach);
      bounds.right = Math.max(bounds.right, element.x + reach);
      bounds.top = Math.min(bounds.top, element.y - reach);
      bounds.bottom = Math.max(bounds.bottom, element.y + reach);
    }
    const pad = 70;
    const width = Math.max(100, bounds.right - bounds.left);
    const height = Math.max(100, bounds.bottom - bounds.top);
    this.#zoom = clamp(Math.min((canvas.clientWidth - pad * 2) / width, (canvas.clientHeight - pad * 2) / height), 0.15, 3);
    this.#pan = {
      x: canvas.clientWidth / 2 - ((bounds.left + bounds.right) / 2) * this.#zoom,
      y: canvas.clientHeight / 2 - ((bounds.top + bounds.bottom) / 2) * this.#zoom,
    };
    this.#draw();
  }

  #surfacesOf(element) {
    const spec = element;
    switch (element.kind) {
      case 'lensIdeal':
        return idealLens(spec.x, spec.y, spec.height, spec.focal, spec.angle);
      case 'lensGlass':
        return sphericalLens(spec.x, spec.y, spec.height, spec.curve, spec.curve, spec.angle, { index: spec.index });
      case 'lensConcave':
        return concaveLens(spec.x, spec.y, spec.height, spec.curve, spec.angle, { index: spec.index });
      case 'mirrorPlane':
        return planeMirror(spec.x, spec.y, spec.length, spec.angle);
      case 'mirrorConcave':
        return curvedMirror(spec.x, spec.y, spec.radius, spec.span, spec.angle, true);
      case 'mirrorConvex':
        return curvedMirror(spec.x, spec.y, spec.radius, spec.span, spec.angle, false);
      case 'block':
        return glassBlock(spec.x, spec.y, spec.width, spec.height, spec.angle, { index: spec.index });
      case 'prism':
        return prism(spec.x, spec.y, spec.size, spec.angle, { index: spec.index });
      case 'drop':
        return glassSphere(spec.x, spec.y, spec.radius, { index: spec.index, dispersive: true });
      case 'screen':
        return screen(spec.x, spec.y, spec.height, spec.angle);
      case 'blocker':
        return blocker(spec.x, spec.y, spec.height, spec.angle);
      case 'aperture': {
        const half = spec.height / 2;
        const gap = spec.gap / 2;
        const arm = half - gap;
        const axis = { x: Math.cos(spec.angle), y: Math.sin(spec.angle) };
        const one = { x: spec.x + axis.x * (gap + arm / 2), y: spec.y + axis.y * (gap + arm / 2) };
        const two = { x: spec.x - axis.x * (gap + arm / 2), y: spec.y - axis.y * (gap + arm / 2) };
        return [...blocker(one.x, one.y, arm, spec.angle), ...blocker(two.x, two.y, arm, spec.angle)];
      }
      default:
        return [];
    }
  }

  #raysOf(element) {
    switch (element.kind) {
      case 'laser':
        return laserRay(element.x, element.y, element.angle);
      case 'beam':
        return beamRays(element.x, element.y, element.width, element.angle, element.rays);
      case 'point':
        return fanRays(element.x, element.y, element.spread, element.angle, element.rays);
      case 'white':
        return laserRay(element.x, element.y, element.angle);
      default:
        return [];
    }
  }

  #trace() {
    const surfaces = this.#elements.flatMap((element) => (isSource(element.kind) ? [] : this.#surfacesOf(element)));
    const bounces = Number(this.config.get('bounces', '24'));
    const traced = [];

    for (const element of this.#elements) {
      if (!isSource(element.kind)) continue;
      const rays = this.#raysOf(element);
      const colours = element.kind === 'white' ? SPECTRUM : [tintFor(element.tint)];
      for (const tint of colours) {
        for (const ray of rays) {
          const { path, events } = traceRay({ surfaces }, ray, { bounces, reach: 3000, wavelength: tint.wavelength });
          traced.push({ path, events, colour: tint.colour });
        }
      }
    }
    return { surfaces, traced };
  }

  #draw() {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#paintBench();
    });
  }

  #paintBench() {
    const canvas = this.$('#view');
    if (!canvas || !canvas.clientWidth) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;

    const context = canvas.getContext('2d');
    const style = getComputedStyle(this);
    const paint = {
      line: style.getPropertyValue('--foreground').trim() || '#222',
      soft: style.getPropertyValue('--muted-foreground').trim() || '#888',
      ring: style.getPropertyValue('--ring').trim() || '#8a1c3b',
      card: style.getPropertyValue('--card').trim() || '#fff',
      border: style.getPropertyValue('--border').trim() || '#ddd',
    };

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    if (this.config.get('grid', true)) this.#grid(context, canvas, paint);

    context.save();
    context.translate(this.#pan.x, this.#pan.y);
    context.scale(this.#zoom, this.#zoom);

    const { traced } = this.#trace();

    context.lineCap = 'round';
    context.lineJoin = 'round';
    const glow = this.config.get('glow', true);
    for (const run of traced) {
      if (run.path.length < 2) continue;
      context.beginPath();
      context.moveTo(run.path[0].x, run.path[0].y);
      for (const point of run.path.slice(1)) context.lineTo(point.x, point.y);
      if (glow) {
        context.strokeStyle = run.colour;
        context.globalAlpha = 0.22;
        context.lineWidth = 6 / this.#zoom;
        context.stroke();
      }
      context.globalAlpha = 0.95;
      context.strokeStyle = run.colour;
      context.lineWidth = 1.6 / this.#zoom;
      context.stroke();
    }
    context.globalAlpha = 1;

    for (const element of this.#elements) this.#drawElement(context, element, paint);

    const picked = this.#current();
    if (picked && this.#tool === 'select') this.#drawHandle(context, picked, paint);

    context.restore();
    this.#readout();
  }

  #grid(context, canvas, paint) {
    const size = 40 * this.#zoom;
    if (size < 8) return;
    context.save();
    context.strokeStyle = paint.border;
    context.globalAlpha = 0.6;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = this.#pan.x % size; x < canvas.clientWidth; x += size) {
      context.moveTo(x, 0);
      context.lineTo(x, canvas.clientHeight);
    }
    for (let y = this.#pan.y % size; y < canvas.clientHeight; y += size) {
      context.moveTo(0, y);
      context.lineTo(canvas.clientWidth, y);
    }
    context.stroke();
    context.restore();
  }

  #hatchBack(context, element, surfaces, paint) {
    const gap = 7 / this.#zoom;
    const tick = 7 / this.#zoom;
    const inward = element.kind === 'mirrorConvex';

    context.save();
    context.strokeStyle = paint.line;
    context.globalAlpha = 0.5;
    context.lineWidth = 1.1 / this.#zoom;
    context.beginPath();

    for (const surface of surfaces) {
      if (surface.kind === 'arc') {
        const sweep = surface.to - surface.from;
        const length = Math.abs(sweep) * surface.radius;
        const steps = Math.max(2, Math.round(length / gap));
        for (let i = 0; i <= steps; i += 1) {
          const angle = surface.from + (sweep * i) / steps;
          const px = surface.centre.x + Math.cos(angle) * surface.radius;
          const py = surface.centre.y + Math.sin(angle) * surface.radius;
          const nx = (inward ? -1 : 1) * Math.cos(angle);
          const ny = (inward ? -1 : 1) * Math.sin(angle);
          context.moveTo(px, py);
          context.lineTo(px + (nx - ny) * tick * 0.7, py + (ny + nx) * tick * 0.7);
        }
        continue;
      }

      const dx = surface.b.x - surface.a.x;
      const dy = surface.b.y - surface.a.y;
      const length = Math.hypot(dx, dy);
      if (!length) continue;
      const ux = dx / length;
      const uy = dy / length;
      const steps = Math.max(2, Math.round(length / gap));
      for (let i = 0; i <= steps; i += 1) {
        const px = surface.a.x + (ux * length * i) / steps;
        const py = surface.a.y + (uy * length * i) / steps;
        context.moveTo(px, py);
        context.lineTo(px + (-uy + ux) * tick * 0.7, py + (ux + uy) * tick * 0.7);
      }
    }

    context.stroke();
    context.restore();
  }

  #drawHandle(context, element, paint) {
    const handle = this.#handleAt(element);
    context.save();
    context.strokeStyle = paint.ring;
    context.lineWidth = 1.4 / this.#zoom;
    context.setLineDash([4 / this.#zoom, 3 / this.#zoom]);
    context.beginPath();
    context.moveTo(element.x, element.y);
    context.lineTo(handle.x, handle.y);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.arc(handle.x, handle.y, 6 / this.#zoom, 0, Math.PI * 2);
    context.fillStyle = paint.card;
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(handle.x, handle.y, 2.2 / this.#zoom, 0, Math.PI * 2);
    context.fillStyle = paint.ring;
    context.fill();
    context.restore();
  }

  #drawElement(context, element, paint) {
    const picked = element.id === this.#selected;
    const line = (picked ? 2.6 : 1.6) / this.#zoom;
    context.save();
    context.strokeStyle = picked ? paint.ring : paint.line;
    context.lineWidth = line;

    const stroke = (surfaces, fill) => {
      for (const surface of surfaces) {
        context.beginPath();
        if (surface.kind === 'arc') context.arc(surface.centre.x, surface.centre.y, surface.radius, surface.from, surface.to);
        else {
          context.moveTo(surface.a.x, surface.a.y);
          context.lineTo(surface.b.x, surface.b.y);
        }
        if (fill) {
          context.fillStyle = fill;
          context.fill();
        }
        context.stroke();
      }
    };

    if (isSource(element.kind)) {
      context.fillStyle = element.kind === 'white' ? paint.soft : tintFor(element.tint).colour;
      if (picked) context.fillStyle = paint.ring;
      context.beginPath();
      context.arc(element.x, element.y, 7 / this.#zoom, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(element.x, element.y);
      context.lineTo(element.x + Math.cos(element.angle) * 26 / this.#zoom, element.y + Math.sin(element.angle) * 26 / this.#zoom);
      context.stroke();
      context.restore();
      return;
    }

    const surfaces = this.#surfacesOf(element);
    const glassy = ['lensGlass', 'lensConcave', 'block', 'prism', 'drop'].includes(element.kind);

    if (glassy) {
      context.beginPath();
      for (const surface of surfaces) {
        if (surface.kind === 'arc') context.arc(surface.centre.x, surface.centre.y, surface.radius, surface.from, surface.to);
        else {
          context.moveTo(surface.a.x, surface.a.y);
          context.lineTo(surface.b.x, surface.b.y);
        }
      }
      context.closePath();
      context.fillStyle = `color-mix(in srgb, ${paint.ring} 12%, transparent)`;
      context.fill();
      context.stroke();
    } else if (element.kind === 'mirrorPlane' || element.kind === 'mirrorConcave' || element.kind === 'mirrorConvex') {
      context.lineWidth = (picked ? 5 : 4) / this.#zoom;
      stroke(surfaces);
      this.#hatchBack(context, element, surfaces, paint);
    } else if (element.kind === 'screen') {
      context.setLineDash([8 / this.#zoom, 6 / this.#zoom]);
      context.lineWidth = (picked ? 4 : 3) / this.#zoom;
      stroke(surfaces);
      context.setLineDash([]);
    } else if (element.kind === 'lensIdeal') {
      context.lineWidth = (picked ? 4 : 3) / this.#zoom;
      stroke(surfaces);
    } else {
      context.lineWidth = (picked ? 6 : 5) / this.#zoom;
      stroke(surfaces);
    }

    context.restore();
  }

  #readout() {
    const target = this.$('#readout');
    if (!target) return;
    const sources = this.#elements.filter((element) => isSource(element.kind)).length;
    const pieces = this.#elements.length - sources;
    const { traced } = this.#trace();
    target.textContent = t('optics-lab.readout', '{sources} sources · {pieces} pieces · {rays} rays', {
      sources,
      pieces,
      rays: traced.length,
    });
  }

  #current() {
    return this.#elements.find((element) => element.id === this.#selected) ?? null;
  }

  #inspector() {
    const target = this.$('#inspector');
    if (!target) return;
    const element = this.#current();
    if (!element) {
      target.innerHTML = html`<div class="hint">${t('optics-lab.pickAPiece', 'Pick a piece to change it, or drop a new one from the left.')}</div>`;
      return;
    }

    const field = (id, label, value, min, max, step) => html`
      <jg-field label="${label}"><jg-input id="${id}" size="sm" type="number" step="${step}" min="${min}" max="${max}" value="${value}"></jg-input></jg-field>
    `;

    const rows = [];
    rows.push(html`<div class="label">${KINDS[element.kind]?.label() ?? element.kind}</div>`);
    rows.push(field('angle', t('optics-lab.angleDegrees', 'Angle degrees'), Math.round((element.angle * 180) / Math.PI), -360, 360, 1));

    if (element.kind !== 'white' && isSource(element.kind)) {
      rows.push(html`<jg-field label="${t('optics-lab.colour', 'Colour')}"><jg-select id="tint" size="sm" value="${element.tint}">
        ${SPECTRUM.map((entry) => html`<option value="${entry.wavelength}">${TINT_NAMES[entry.wavelength]?.() ?? entry.wavelength}</option>`)}
      </jg-select></jg-field>`);
    }
    if (element.kind === 'beam') {
      rows.push(field('width', t('optics-lab.beamWidth', 'Beam width'), element.width, 10, 600, 5));
      rows.push(field('rays', t('optics-lab.rayCount', 'Rays'), element.rays, 1, 41, 1));
    }
    if (element.kind === 'point') {
      rows.push(field('spread', t('optics-lab.spreadDegrees', 'Spread degrees'), Math.round((element.spread * 180) / Math.PI), 2, 350, 1));
      rows.push(field('rays', t('optics-lab.rayCount', 'Rays'), element.rays, 1, 61, 1));
    }
    if (element.kind === 'lensIdeal') {
      rows.push(field('focal', t('optics-lab.focalLength', 'Focal length'), element.focal, -900, 900, 5));
      rows.push(field('height', t('optics-lab.height', 'Height'), element.height, 20, 600, 5));
      const image = thinLensImage(element.focal, 200);
      rows.push(html`<div class="hint">${t('optics-lab.lensNote', 'An object 200 away images at {distance}, {size} times the size.', {
        distance: Number.isFinite(image.distance) ? Math.round(image.distance) : '∞',
        size: Number.isFinite(image.magnification) ? Math.abs(image.magnification).toFixed(2) : '∞',
      })}</div>`);
    }
    if (element.kind === 'lensGlass' || element.kind === 'lensConcave') {
      rows.push(field('curve', t('optics-lab.curvature', 'Curvature'), element.curve, -0.02, 0.02, 0.0005));
      rows.push(field('height', t('optics-lab.height', 'Height'), element.height, 20, 400, 5));
      rows.push(field('index', t('optics-lab.refractiveIndex', 'Refractive index'), element.index, 1.01, 3, 0.01));
    }
    if (element.kind === 'mirrorPlane') rows.push(field('length', t('optics-lab.length', 'Length'), element.length, 20, 800, 5));
    if (element.kind === 'mirrorConcave' || element.kind === 'mirrorConvex') {
      rows.push(field('radius', t('optics-lab.radius', 'Radius'), element.radius, 40, 1600, 10));
      rows.push(field('span', t('optics-lab.spanDegrees', 'Span degrees'), Math.round((element.span * 180) / Math.PI), 10, 180, 1));
      rows.push(html`<div class="hint">${t('optics-lab.mirrorNote', 'Parallel light comes to a focus at half the radius, {focus} away.', { focus: Math.round(element.radius / 2) })}</div>`);
    }
    if (element.kind === 'block') {
      rows.push(field('width', t('optics-lab.width', 'Width'), element.width, 10, 900, 5));
      rows.push(field('height', t('optics-lab.height', 'Height'), element.height, 10, 900, 5));
      rows.push(field('index', t('optics-lab.refractiveIndex', 'Refractive index'), element.index, 1.01, 3, 0.01));
    }
    if (element.kind === 'prism') {
      rows.push(field('size', t('optics-lab.size', 'Size'), element.size, 20, 400, 5));
      rows.push(field('index', t('optics-lab.refractiveIndex', 'Refractive index'), element.index, 1.01, 3, 0.01));
    }
    if (element.kind === 'drop') {
      rows.push(field('radius', t('optics-lab.radius', 'Radius'), element.radius, 10, 400, 5));
      rows.push(field('index', t('optics-lab.refractiveIndex', 'Refractive index'), element.index, 1.01, 3, 0.01));
    }
    if (element.kind === 'screen' || element.kind === 'blocker') rows.push(field('height', t('optics-lab.height', 'Height'), element.height, 20, 900, 5));
    if (element.kind === 'aperture') {
      rows.push(field('height', t('optics-lab.height', 'Height'), element.height, 40, 900, 5));
      rows.push(field('gap', t('optics-lab.gap', 'Gap'), element.gap, 1, 200, 1));
    }

    rows.push(html`<jg-button size="sm" variant="outline" id="drop">${t('optics-lab.removePiece', 'Remove piece')}</jg-button>`);
    target.innerHTML = html`${rows}`;

    if (!target.dataset.wired) {
      target.dataset.wired = 'true';
      this.on(target, 'change', (event) => {
        const live = this.#current();
        if (!live) return;
        const id = event.target.id;
        const value = Number(event.target.value);
        if (!id || !Number.isFinite(value)) return;
        this.#snapshot();
        if (id === 'tint') live.tint = value;
        else if (id === 'angle') live.angle = (value * Math.PI) / 180;
        else if (id === 'spread' || id === 'span') live[id] = (value * Math.PI) / 180;
        else live[id] = value;
        this.#draw();
        this.#inspector();
      });
      this.on(target, 'click', (event) => {
        if (event.target.closest?.('#drop')) this.#remove();
      });
    }
  }

  #snapshot() {
    this.#past.push(JSON.stringify(this.#elements));
    if (this.#past.length > 40) this.#past.shift();
  }

  #undo() {
    const last = this.#past.pop();
    if (!last) return;
    this.#elements = JSON.parse(last);
    this.#selected = null;
    this.#draw();
    this.#inspector();
  }

  #turn(by) {
    const element = this.#current();
    if (!element) return;
    this.#snapshot();
    element.angle += by;
    this.#draw();
    this.#inspector();
  }

  #remove() {
    const element = this.#current();
    if (!element) return;
    this.#snapshot();
    this.#elements = this.#elements.filter((entry) => entry !== element);
    this.#selected = null;
    this.#draw();
    this.#inspector();
  }

  #blank() {
    this.#snapshot();
    this.#elements = [];
    this.#selected = null;
    this.#openName = null;
    this.#fit();
    this.#inspector();
  }

  #load(name) {
    const scene = SCENES[name] ?? SCENES.focus;
    this.#elements = scene.elements.map((element) => ({ id: Math.random().toString(36).slice(2, 9), ...DEFAULTS[element.kind], ...element }));
    this.#selected = null;
    this.#openName = null;
    this.#past = [];
    this.#draw();
    this.#inspector();
  }

  #openGallery() {
    this.#buildGallery();
    this.$('#gallery')?.open();
  }

  #buildGallery() {
    const target = this.$('#scenes');
    if (!target || target.dataset.built === 'true') return;
    target.dataset.built = 'true';

    const titles = {
      lenses: t('optics-lab.groupLenses', 'Lenses'),
      mirrors: t('optics-lab.groupMirrors', 'Mirrors'),
      glass: t('optics-lab.groupGlass', 'Glass'),
      colour: t('optics-lab.groupColour', 'Colour'),
      instruments: t('optics-lab.groupInstruments', 'Instruments'),
    };
    const order = ['lenses', 'mirrors', 'glass', 'colour', 'instruments'];

    const bands = new Map();
    for (const [key, scene] of Object.entries(SCENES)) {
      const group = scene.group ?? 'lenses';
      if (!bands.has(group)) bands.set(group, []);
      bands.get(group).push([key, scene]);
    }

    target.innerHTML = html`${[...bands.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(
        ([group, list]) => html`<section class="band" data-band="${group}">
          <h4>${titles[group] ?? group}</h4>
          <div class="row">
            ${list.map(
              ([key, scene]) => html`<button class="card" data-scene="${key}" data-hunt="${`${sceneName(key, scene)} ${titles[group] ?? ''}`.toLowerCase()}">
                <span class="shot">${this.#thumb(scene)}</span>
                <span class="name">${sceneName(key, scene)}</span>
              </button>`,
            )}
          </div>
        </section>`,
      )}`;

    if (!target.dataset.wired) {
      target.dataset.wired = 'true';
      this.on(target, 'click', (event) => {
        const card = event.target.closest?.('[data-scene]');
        if (!card) return;
        this.#load(card.dataset.scene);
        this.#fit();
        this.$('#gallery')?.close();
      });
    }

    const hunt = this.$('#hunt');
    if (hunt && !hunt.dataset.wired) {
      hunt.dataset.wired = 'true';
      this.on(hunt, 'input', () => {
        const term = hunt.value.trim().toLowerCase();
        let shown = 0;
        this.$$('#scenes [data-scene]').forEach((card) => {
          const match = !term || card.dataset.hunt.includes(term);
          card.hidden = !match;
          if (match) shown += 1;
        });
        this.$$('#scenes .band').forEach((band) => {
          band.hidden = ![...band.querySelectorAll('[data-scene]')].some((card) => !card.hidden);
        });
        const nothing = this.$('#nothing');
        if (nothing) nothing.hidden = shown > 0;
      });
    }
  }

  #thumb(scene) {
    const elements = scene.elements.map((element) => ({ ...DEFAULTS[element.kind], ...element }));
    const surfaces = elements.flatMap((element) => (isSource(element.kind) ? [] : this.#surfacesOf(element)));

    const frame = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    const stretch = (point) => {
      frame.left = Math.min(frame.left, point.x);
      frame.right = Math.max(frame.right, point.x);
      frame.top = Math.min(frame.top, point.y);
      frame.bottom = Math.max(frame.bottom, point.y);
    };

    for (const element of elements) {
      const reach = this.#reachOf(element);
      stretch({ x: element.x - reach, y: element.y - reach });
      stretch({ x: element.x + reach, y: element.y + reach });
    }
    const span = Math.hypot(frame.right - frame.left, frame.bottom - frame.top);

    const runs = [];
    for (const element of elements) {
      if (!isSource(element.kind)) continue;
      const colours = element.kind === 'white' ? SPECTRUM : [tintFor(element.tint)];
      for (const tint of colours) {
        for (const ray of this.#raysOf(element)) {
          const { path } = traceRay({ surfaces }, ray, { bounces: 16, reach: span * 0.5, wavelength: tint.wavelength });
          if (path.length < 2) continue;
          path.forEach(stretch);
          runs.push({ path, colour: tint.colour });
        }
      }
    }

    const pad = Math.max(frame.right - frame.left, frame.bottom - frame.top) * 0.05;
    frame.left -= pad;
    frame.right += pad;
    frame.top -= pad;
    frame.bottom += pad;

    const width = 160;
    const height = 100;
    const scale = Math.min(width / (frame.right - frame.left), height / (frame.bottom - frame.top));
    const midX = (frame.left + frame.right) / 2;
    const midY = (frame.top + frame.bottom) / 2;
    const px = (point) => `${(width / 2 + (point.x - midX) * scale).toFixed(1)},${(height / 2 + (point.y - midY) * scale).toFixed(1)}`;

    const parts = [];

    for (const run of runs) {
      parts.push(`<polyline points="${run.path.map(px).join(' ')}" fill="none" stroke="${run.colour}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>`);
    }

    for (const surface of surfaces) {
      if (surface.kind === 'arc') {
        const steps = 16;
        const points = [];
        for (let step = 0; step <= steps; step += 1) {
          const angle = surface.from + ((surface.to - surface.from) * step) / steps;
          points.push({ x: surface.centre.x + Math.cos(angle) * surface.radius, y: surface.centre.y + Math.sin(angle) * surface.radius });
        }
        parts.push(`<polyline points="${points.map(px).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>`);
      } else {
        const a = px(surface.a).split(',');
        const b = px(surface.b).split(',');
        const dash = surface.role === 'screen' ? ' stroke-dasharray="3 2.4"' : '';
        parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"${dash}/>`);
      }
    }

    for (const element of elements) {
      if (!isSource(element.kind)) continue;
      const spot = px(element).split(',');
      parts.push(`<circle cx="${spot[0]}" cy="${spot[1]}" r="2.4" fill="currentColor"/>`);
    }

    return raw(`<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${parts.join('')}</svg>`);
  }

  #saved() {
    const target = this.$('#saved');
    if (!target) return;
    const saved = this.#designs.list();
    target.innerHTML = saved.length
      ? html`${saved.map((entry) => html`<button class="line" data-open="${entry.name}">${entry.name}</button>`)}`
      : html`<div class="hint">${t('optics-lab.nothingSaved', 'Nothing saved yet. Name a setup above and save it.')}</div>`;

    if (!target.dataset.wired) {
      target.dataset.wired = 'true';
      this.on(target, 'click', (event) => {
        const open = event.target.closest?.('[data-open]');
        if (!open) return;
        const design = this.#designs.get(open.dataset.open);
        if (!design) return;
        this.#elements = (design.elements ?? []).map((element) => ({ ...element }));
        this.#selected = null;
        this.#openName = open.dataset.open;
        this.#fit();
        this.#inspector();
      });
    }

    const save = this.$('#save');
    if (save && !save.dataset.wired) {
      save.dataset.wired = 'true';
      this.on(save, 'click', () => {
        const name = this.$('#name').value.trim();
        if (!name) {
          toast(t('optics-lab.nameItFirst', 'Give the setup a name first'), 'danger');
          return;
        }
        this.#designs.save(name, { elements: this.#elements });
        this.#openName = name;
        this.#saved();
        toast(t('optics-lab.setupSaved', 'Setup saved'));
      });
    }
  }

  #savePng() {
    const canvas = this.$('#view');
    canvas.toBlob((blob) => {
      if (blob) download('optics.png', blob, 'image/png');
    }, 'image/png');
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('optics-lab.opticsLab', 'Optics Lab')}</div>
        <div class="hint">${t('optics-lab.widgetBlurb', 'Lenses, mirrors and prisms with real ray tracing.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-optics-lab', OpticsLab);
