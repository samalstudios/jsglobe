import { JGApp, define, html, styleSheet } from '../../core/app.js';
import SAMPLES from './scenes.js';
import { collapsibleGroups, paletteSheet } from '../../ui/palette.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { createWorld, bodyCorners, worldPoint, localPoint, spanOf, hull, polyMass, simpleLoop } from '../../lib/physics.js';
import { createDesigns } from '../../lib/designs.js';
import { clipPolygons, polygonArea } from '../../lib/clip.js';
import { shapesFromSvg } from '../../lib/svg-shapes.js';
import { icon } from '../../ui/icons.js';
import { toast, pickFile } from '../../core/util.js';

const t = appText(strings);

const sheet = await styleSheet(import.meta.url);

const SCALE = 42;

const SHAPES = {
  circle: { label: t('physics-lab.ball', 'Ball'), icon: 'circle' },
  box: { label: t('physics-lab.block', 'Block'), icon: 'square' },
  wall: { label: t('physics-lab.wall', 'Wall'), icon: 'frame' },
  shape: { label: t('physics-lab.shape', 'Shape'), icon: 'vector' },
  gear: { label: t('physics-lab.gear', 'Gear'), icon: 'gearWheel' },
};

const LINKS = {
  spring: { label: t('physics-lab.spring', 'Spring'), icon: 'coil' },
  rod: { label: t('physics-lab.rod', 'Rod'), icon: 'line' },
  rope: { label: t('physics-lab.rope', 'Rope'), icon: 'link' },
  jack: { label: t('physics-lab.jack', 'Jack'), icon: 'piston' },
  pin: { label: t('physics-lab.pin', 'Pin'), icon: 'hinge' },
  motor: { label: t('physics-lab.motor', 'Motor'), icon: 'motorised' },
  mesh: { label: t('physics-lab.meshGears', 'Mesh gears'), icon: 'gearPair' },
  linkage: { label: t('physics-lab.linkage', 'Linkage'), icon: 'ruler' },
  track: { label: t('physics-lab.track', 'Track'), icon: 'rail' },
  weld: { label: t('physics-lab.weld', 'Weld'), icon: 'weldSeam' },
};

const CONTROLS = {
  button: { label: t('physics-lab.button', 'Button'), icon: 'toggle' },
  slider: { label: t('physics-lab.slider', 'Slider'), icon: 'tuning' },
};

const SCENERY = {
  backdrop: { label: t('physics-lab.backdrop', 'Backdrop'), icon: 'image' },
};

const BUTTON_WIDTH = 1.5;
const BUTTON_HEIGHT = 0.62;
const SLIDER_WIDTH = 0.8;
const SLIDER_HEIGHT = 3.2;
const SLIDER_GRIP = 0.5;
const HANDLE_HEIGHT = 0.3;

// the solver works in metres, the interface reads and writes millimetres
const MM = 1000;
const toMm = (metres) => Math.round((metres ?? 0) * MM);
const fromMm = (value, fallback) => {
  const mm = Number(value);
  return Number.isFinite(mm) && mm !== 0 ? mm / MM : fallback;
};

const sceneNames = () => ({
  pendulum: t('physics-lab.scenePendulum', 'Pendulum'),
  stack: t('physics-lab.sceneStack', 'Stack and ball'),
  ramp: t('physics-lab.sceneRamp', 'Ramp'),
  cradle: t('physics-lab.sceneCradle', "Newton's cradle"),
  crank: t('physics-lab.sceneCrank', 'Crank and piston'),
  dominoes: t('physics-lab.sceneDominoes', 'Domino run'),
  excavator: t('physics-lab.sceneExcavator', 'Excavator arm'),
  fourbar: t('physics-lab.sceneFourbar', 'Four bar linkage'),
  gears: t('physics-lab.sceneGears', 'Gear train'),
  orbits: t('physics-lab.sceneOrbits', 'Three bodies'),
  ackermann: t('physics-lab.sceneAckermann', 'Ackermann steering'),
});

export default class PhysicsLab extends JGApp {
  static appId = 'physics-lab';
  static styles = [...JGApp.styles, paletteSheet, sheet];
  static settings = [
    { key: 'vectors', label: t('physics-lab.showVelocityArrows', 'Show velocity arrows'), type: 'switch', value: false },
    { key: 'trails', label: t('physics-lab.traceTheSelectedBody', 'Trace the selected body'), type: 'switch', value: true },
    { key: 'centres', label: t('physics-lab.showTheCentreOfEach', 'Show the centre of each body'), type: 'switch', value: true },
    { key: 'snap', label: t('physics-lab.snapLinksToCentresAnd', 'Snap links to centres and corners'), type: 'switch', value: true },
    { key: 'accuracy', label: t('physics-lab.solverPassesPerFrame', 'Solver passes per frame'), type: 'number', value: 8, min: 3, max: 20 },
  ];

  #world = createWorld();
  #bodies = [];
  #joints = [];
  #tool = 'select';
  #seq = 1;
  #selected = null;
  #selectedJoint = null;
  #running = false;
  #frame = 0;
  #pan = { x: 0, y: 0 };
  #zoom = 1;
  #panDrag = null;
  #drag = null;
  #grab = null;
  #linkFrom = null;
  #cursor = null;
  #hover = null;
  #history = [];
  #trail = new Map();
  #paint = null;
  #grid = null;
  #designs = null;
  #openName = null;
  #gravity = 9.81;
  #attraction = 0;
  #damping = 0.02;
  #sketch = null;
  #controls = [];
  #held = new Set();
  #selectedControl = null;
  #alsoSelected = new Set();
  #clipboard = null;
  #snapHint = null;
  #backdrop = null;
  #backdropImage = null;
  #touched = false;

  connectedCallback() {
    this.#designs = createDesigns(this.store, 'physics-lab');
    const open = this.#designs.open();
    const saved = open ? this.#designs.get(open) : null;
    if (saved) {
      this.#restore(saved);
      this.#openName = open;
    } else if (SAMPLES[open]) {
      this.#load(open);
    } else {
      this.#bodies = [];
      this.#joints = [];
      this.#controls = [];
      this.#seq = 1;
      this.#reset();
    }
    super.connectedCallback();
  }

  #anchorsFromWorld(bodies, joints) {
    return joints.map((joint) => {
      const next = { ...joint };
      ['a', 'b'].forEach((end) => {
        const at = next[`${end}World`];
        if (!at) return;
        delete next[`${end}World`];
        const body = bodies.find((entry) => entry.id === next[end]);
        next[`${end}At`] = body ? localPoint({ ...body, angle: body.angle ?? 0 }, at) : { ...at };
      });
      return next;
    });
  }

  #load(name) {
    const sample = SAMPLES[name] ?? SAMPLES.pendulum;
    this.#bodies = sample.bodies.map((body) => ({ ...body }));
    this.#joints = this.#anchorsFromWorld(this.#bodies, sample.joints);
    this.#controls = (sample.controls ?? []).map((button) => ({ ...button }));
    this.#setBackdrop(null);
    this.#gravity = sample.gravity ?? 9.81;
    this.#attraction = sample.attraction ?? 0;
    this.#damping = sample.damping ?? 0.02;
    this.#seq = this.#bodies.reduce((top, body) => Math.max(top, body.id), 0) + 1;
    this.#stampIds();
    this.#openName = null;
    this.#reset();
  }

  #restore(design) {
    this.#bodies = (design.bodies ?? []).map((body) => ({ ...body }));
    this.#joints = (design.joints ?? []).map((joint) => ({ ...joint }));
    this.#controls = (design.controls ?? design.buttons ?? []).map((button) => ({ ...button }));
    this.#setBackdrop(design.backdrop ?? null);
    this.#gravity = design.gravity ?? 9.81;
    this.#attraction = design.attraction ?? 0;
    this.#damping = design.damping ?? 0.02;
    this.#seq = this.#bodies.reduce((top, body) => Math.max(top, Number(body.id) || 0), 0) + 1;
    this.#stampIds();
    this.#reset();
  }

  #stampIds() {
    const taken = [...this.#joints, ...this.#controls].reduce(
      (top, item) => Math.max(top, Number(item.id) || 0),
      this.#seq - 1,
    );
    this.#seq = taken + 1;
    this.#joints.forEach((joint) => {
      if (joint.id == null) joint.id = this.#seq++;
    });
    this.#controls.forEach((button) => {
      if (button.id == null) button.id = this.#seq++;
    });
  }

  #design() {
    return {
      bodies: this.#bodies.map((body) => ({ ...body })),
      joints: this.#joints.map((joint) => ({ ...joint })),
      controls: this.#controls.map((button) => ({ ...button })),
      gravity: this.#gravity,
      attraction: this.#attraction,
      damping: this.#damping,
    };
  }

  #reset() {
    this.#world.load(this.#bodies, this.#joints);
    this.#world.gravity.y = this.#gravity;
    this.#world.options.attraction = this.#attraction;
    this.#world.options.damping = this.#damping;
    this.#trail = new Map();
    this.#grab = null;
  }

  #sync() {
    this.#world.bodies.forEach((live) => {
      const source = this.#bodies.find((body) => body.id === live.id);
      if (!source) return;
      source.x = live.x;
      source.y = live.y;
      source.angle = live.angle;
    });
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('physics-lab.physicsLab', 'Physics Lab')}</div>
        <div class="hint">${t('physics-lab.ballsBlocksSpringsRodsAnd', 'Balls, blocks, springs, rods and motors with a real solver.')}</div>
      </div>
    </div>`);
  }

  renderApp() {
    this.paint(html`<div class="app">
      <div class="head"><jg-toolbar id="bar"></jg-toolbar></div>
      <div class="body">
        <div class="palette" id="palette"></div>
        <div class="board">
          <canvas id="view"></canvas>
          <div class="readout" id="readout"></div>
          <div class="hint-bar"><b id="tool-name">${t('physics-lab.select', 'Select')}</b><span id="tool-hint"></span></div>
        </div>
        <aside class="side">
          <div class="label">${t('physics-lab.scenes', 'Scenes')}</div>
          <div class="samples">
            ${Object.entries(SAMPLES).map(([key, sample]) => html`<button data-sample="${key}">${sceneNames()[key] ?? sample.name}</button>`)}
          </div>
          <div class="sep"></div>
          <jg-field label="${t('physics-lab.gravity', 'Gravity')}">
            <jg-input id="gravity" size="sm" type="number" step="0.5" min="-20" max="30" value="${this.#gravity}"></jg-input>
          </jg-field>
          <jg-field label="${t('physics-lab.mutualGravity', 'Mutual gravity')}">
            <jg-input id="attraction" size="sm" type="number" step="0.1" min="0" max="20" value="${this.#attraction}"></jg-input>
          </jg-field>
          <div class="sep"></div>
          <div class="label">${t('physics-lab.saved', 'Saved')}</div>
          <div class="save-row">
            <jg-input id="save-name" size="sm" placeholder="${t('physics-lab.nameThisScene', 'Name this scene')}"></jg-input>
            <jg-button size="sm" variant="outline" id="save">${t('physics-lab.save', 'Save')}</jg-button>
          </div>
          <div class="saved" id="saved"></div>
          <div class="sep"></div>
          <div id="inspector"></div>
        </aside>
      </div>
    </div>`);

    this.#toolbar();

    this.$('#palette').innerHTML = html`
      <div class="group">${t('physics-lab.edit', 'Edit')}</div>
      ${[
        { id: 'select', label: t('physics-lab.select', 'Select'), icon: 'launcher' },
        { id: 'erase', label: t('physics-lab.erase', 'Erase'), icon: 'eraser' },
      ].map(
        (tool) => html`<button class="tool" data-tool="${tool.id}" aria-pressed="${String(this.#tool === tool.id)}">
          ${icon(tool.icon, 15)}<span>${tool.label}</span>
        </button>`,
      )}
      <div class="group">${t('physics-lab.bodies', 'Bodies')}</div>
      ${Object.entries(SHAPES).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>${meta.label}</span>
        </button>`,
      )}
      <div class="group">${t('physics-lab.links', 'Links')}</div>
      ${Object.entries(LINKS).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>${meta.label}</span>
        </button>`,
      )}
      <div class="group">${t('physics-lab.controls', 'Controls')}</div>
      ${Object.entries(CONTROLS).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>${meta.label}</span>
        </button>`,
      )}
      <div class="group">${t('physics-lab.scene', 'Scene')}</div>
      <button class="tool" id="svg-in">${icon('vector', 15)}<span>${t('physics-lab.loadSvg', 'Load SVG')}</span></button>
      <button class="tool" id="backdrop-in">${icon('image', 15)}<span>${t('physics-lab.backdrop', 'Backdrop')}</span></button>
      ${Object.entries(SCENERY).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>Move ${meta.label.toLowerCase()}</span>
        </button>`,
      )}
    `;

    collapsibleGroups(this.$('#palette'), { store: this.state, key: 'palette.folded' });

    this.bind('.tool', 'click', (event) => {
      const tool = event.currentTarget.dataset.tool;
      if (tool) this.#setTool(tool);
    });
    this.bind('#svg-in', 'click', () => this.#importSvg());
    this.bind('#backdrop-in', 'click', () => this.#loadBackdrop());
    this.bind('[data-sample]', 'click', (event) => {
      this.#load(event.currentTarget.dataset.sample);
      this.#designs.setOpen(null);
      this.#worldFields();
      this.#nameField();
      this.#savedList();
      this.#inspector();
      this.#fit();
    });
    this.bind('#save', 'click', () => this.#saveNamed());
    this.on(this.$('#save-name'), 'keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.#saveNamed();
    });
    this.on(this.$('#gravity'), 'change', () => {
      this.#snapshot();
      this.#gravity = Number(this.$('#gravity').value) || 0;
      this.#world.gravity.y = this.#gravity;
    });
    this.on(this.$('#attraction'), 'change', () => {
      this.#snapshot();
      this.#attraction = Number(this.$('#attraction').value) || 0;
      this.#damping = this.#attraction ? 0 : this.#damping;
      this.#world.options.attraction = this.#attraction;
      this.#world.options.damping = this.#damping;
    });

    const canvas = this.$('#view');
    this.on(canvas, 'pointerdown', (event) => this.#down(event));
    this.on(canvas, 'pointermove', (event) => this.#move(event));
    this.on(canvas, 'pointerup', (event) => this.#up(event));
    this.on(
      canvas,
      'wheel',
      (event) => {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          this.#zoomAt(Math.exp(-event.deltaY / 240), event.clientX, event.clientY);
          return;
        }
        this.#touched = true;
        this.#pan.x -= event.deltaX;
        this.#pan.y -= event.deltaY;
      },
      { passive: false },
    );

    this.hotkeys((event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        this.#undo();
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        this.#toggleRun();
        return;
      }
      if (event.key === 'Enter' && this.#sketch) {
        event.preventDefault();
        this.#closeShape();
        return;
      }
      if (event.key === 'Escape') {
        if (this.#sketch) {
          event.preventDefault();
          this.#sketch = null;
          return;
        }
        if (this.#linkFrom) {
          event.preventDefault();
          this.#linkFrom = null;
          return;
        }
        if (this.#tool === 'select') return;
        event.preventDefault();
        this.#setTool('select');
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        this.#remove();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        this.#copy();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        this.#paste();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        this.#copy();
        this.#paste();
        return;
      }
      if (event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        this.#turn((event.shiftKey ? -1 : 1) * (Math.PI / 12));
      }
    });

    this.#setTool(this.#tool);
    this.#worldFields();
    this.#nameField();
    this.#savedList();
    this.#inspector();
    this.#fit();

    const watch = new ResizeObserver(() => {
      if (!this.#touched) this.#fit();
    });
    watch.observe(this.$('#view'));
    this.track(() => watch.disconnect());

    this.#loop();
  }

  #toolbar() {
    this.$('#bar').items = [
      {
        id: 'run',
        label: this.#running ? 'Pause' : 'Run',
        icon: this.#running ? 'pause' : 'play',
        tone: this.#running ? 'pause' : 'run',
        action: () => this.#toggleRun(),
      },
      { id: 'step', label: t('physics-lab.step', 'Step'), icon: 'stepOver', iconOnly: true, title: t('physics-lab.advanceOneFrame', 'Advance one frame'), action: () => this.#stepOnce() },
      { id: 'reset', label: t('physics-lab.reset', 'Reset'), icon: 'repeat', tone: 'stop', action: () => this.#rewind() },
      { separator: true },
      { id: 'new', label: t('physics-lab.new', 'New'), icon: 'file', iconOnly: true, title: t('physics-lab.startAnEmptyScene', 'Start an empty scene'), action: () => this.#blank() },
      { id: 'undo', label: t('physics-lab.undo', 'Undo'), icon: 'undo', iconOnly: true, title: t('physics-lab.undo', 'Undo'), action: () => this.#undo() },
      { separator: true },
      { id: 'zoom-out', label: t('physics-lab.zoomOut', 'Zoom out'), icon: 'minus', iconOnly: true, title: t('physics-lab.zoomOut', 'Zoom out'), action: () => this.#step(1 / 1.25) },
      { id: 'zoom-fit', label: t('physics-lab.fit', 'Fit'), icon: 'maximize', iconOnly: true, title: t('physics-lab.fitTheScene', 'Fit the scene'), action: () => { this.#touched = false; this.#fit(); } },
      { id: 'zoom-in', label: t('physics-lab.zoomIn', 'Zoom in'), icon: 'plus', iconOnly: true, title: t('physics-lab.zoomIn', 'Zoom in'), action: () => this.#step(1.25) },
      { separator: true },
      { id: 'copy', label: t('physics-lab.copy', 'Copy'), icon: 'copy', iconOnly: true, title: t('physics-lab.copyTheSelection', 'Copy the selection'), action: () => this.#copy() },
      { id: 'paste', label: t('physics-lab.paste', 'Paste'), icon: 'clipboard', iconOnly: true, title: t('physics-lab.pasteACopy', 'Paste a copy'), action: () => this.#paste() },
      { id: 'turn', label: t('physics-lab.rotate', 'Rotate'), icon: 'rotate', iconOnly: true, title: t('physics-lab.turnTheSelectedBodyR', 'Turn the selected body (R, shift R the other way)'), action: () => this.#turn(Math.PI / 12) },
      {
        id: 'snap',
        label: t('physics-lab.snap', 'Snap'),
        icon: 'magnet',
        iconOnly: true,
        toggle: true,
        active: this.config.get('snap', true),
        title: t('physics-lab.snapTitle', 'Snap links to centres and corners'),
        action: (item) => this.config.set('snap', item.active),
      },
      { separator: true },
      { id: 'union', label: t('physics-lab.merge', 'Merge'), icon: 'union', iconOnly: true, title: t('physics-lab.mergeTheTwoSelectedShapes', 'Merge the two selected shapes'), action: () => this.#combine('union') },
      { id: 'subtract', label: t('physics-lab.subtract', 'Subtract'), icon: 'subtract', iconOnly: true, title: t('physics-lab.cutTheSecondShapeOut', 'Cut the second shape out of the first'), action: () => this.#combine('subtract') },
      { id: 'intersect', label: t('physics-lab.overlap', 'Overlap'), icon: 'intersect', iconOnly: true, title: t('physics-lab.keepOnlyWhereTheTwo', 'Keep only where the two shapes overlap'), action: () => this.#combine('intersect') },
      { separator: true },
      { id: 'front', label: t('physics-lab.bringToFront', 'Bring to front'), icon: 'toFront', iconOnly: true, title: t('physics-lab.bringTheSelectedBodyTo', 'Bring the selected body to the front'), action: () => this.#lift(true) },
      { id: 'back', label: t('physics-lab.sendToBack', 'Send to back'), icon: 'toBack', iconOnly: true, title: t('physics-lab.sendTheSelectedBodyTo', 'Send the selected body to the back'), action: () => this.#lift(false) },
      { separator: true },
      { id: 'delete', label: t('physics-lab.delete', 'Delete'), icon: 'eraser', iconOnly: true, danger: true, title: t('physics-lab.deleteTheSelection', 'Delete the selection'), action: () => this.#remove() },
      { spacer: true },
      { id: 'import', label: t('physics-lab.openFile', 'Open file'), icon: 'upload', iconOnly: true, title: t('physics-lab.openASceneFromA', 'Open a scene from a file'), action: () => this.#importFile() },
      { id: 'export', label: t('physics-lab.saveFile', 'Save file'), icon: 'download', iconOnly: true, title: t('physics-lab.saveThisSceneToA', 'Save this scene to a file'), action: () => this.#exportFile() },
    ];
  }

  #setTool(tool) {
    this.#tool = tool;
    this.#linkFrom = null;
    this.#sketch = null;
    this.toggleAttribute('data-keeps-escape', tool !== 'select');
    this.$$('.tool').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.tool === tool)));
    const canvas = this.$('#view');
    if (canvas) canvas.dataset.tool = tool === 'select' ? 'select' : 'place';
    const name = this.$('#tool-name');
    const hint = this.$('#tool-hint');
    if (!name || !hint) return;
    if (tool === 'backdrop' || this.#tool === 'backdrop') this.#inspector();
    name.textContent = tool === 'select' ? 'Select' : tool === 'erase' ? 'Erase' : (SHAPES[tool] ?? LINKS[tool] ?? CONTROLS[tool] ?? SCENERY[tool])?.label ?? tool;
    hint.textContent = tool === 'pin' || tool === 'motor'
      ? 'Click where two bodies overlap to hinge them, or one body to hinge it to the world.'
      : tool === 'backdrop'
        ? 'Drag to move the backdrop. Its size and fade are in the panel.'
        : CONTROLS[tool]
        ? 'Click a jack or a motor to add a control for it, then use the control to drive it.'
        : tool === 'linkage'
        ? 'Click a point on one body, then a point on another, to join them with a hinged bar.'
        : LINKS[tool]
          ? 'Click one body, then the other. Click empty space to anchor to the world.'
      : tool === 'shape'
        ? 'Click each corner, then click the first one again or press Enter to close it.'
        : SHAPES[tool]
          ? 'Drag from one corner to the other, or click to drop a default one.'
        : tool === 'erase'
          ? 'Click a body or a link to remove it.'
          : 'Drag a body to throw it, R turns it, shift click a second shape to merge or subtract.';
  }

  #snapshot() {
    this.#history.push(JSON.stringify({ bodies: this.#bodies, joints: this.#joints, gravity: this.#gravity, attraction: this.#attraction, damping: this.#damping }));
    if (this.#history.length > 60) this.#history.shift();
  }

  #undo() {
    const previous = this.#history.pop();
    if (!previous) return;
    const state = JSON.parse(previous);
    this.#bodies = state.bodies;
    this.#joints = state.joints;
    this.#gravity = state.gravity;
    this.#attraction = state.attraction ?? 0;
    this.#damping = state.damping ?? 0.02;
    this.#worldFields();
    this.#selected = null;
    this.#selectedJoint = null;
    this.#reset();
    this.#inspector();
  }

  #toggleRun() {
    if (!this.#running) this.#sync();
    this.#running = !this.#running;
    this.#toolbar();
  }

  #blank() {
    this.#snapshot();
    this.#bodies = [];
    this.#joints = [];
    this.#controls = [];
    this.#setBackdrop(null);
    this.#held.clear();
    this.#selectedControl = null;
    this.#gravity = 9.81;
    this.#attraction = 0;
    this.#damping = 0.02;
    this.#seq = 1;
    this.#running = false;
    this.#openName = null;
    this.#designs.setOpen(null);
    this.#reset();
    this.#pan = { x: 0, y: 0 };
    this.#zoom = 1;
    this.#touched = false;
    this.#worldFields();
    this.#nameField();
    this.#savedList();
    this.#inspector();
    this.#toolbar();
  }

  #rewind() {
    this.#running = false;
    this.#reset();
    this.#toolbar();
  }

  #stepOnce() {
    this.#world.step(1 / 120);
    this.#world.step(1 / 120);
  }

  #point(event) {
    const rect = this.$('#view').getBoundingClientRect();
    const span = SCALE * this.#zoom;
    return {
      x: (event.clientX - rect.left - this.#pan.x) / span,
      y: (event.clientY - rect.top - this.#pan.y) / span,
    };
  }

  #zoomAt(factor, clientX, clientY) {
    this.#touched = true;
    const rect = this.$('#view').getBoundingClientRect();
    const at = [clientX - rect.left, clientY - rect.top];
    const next = Math.min(4, Math.max(0.2, this.#zoom * factor));
    const ratio = next / this.#zoom;
    this.#pan.x = at[0] - (at[0] - this.#pan.x) * ratio;
    this.#pan.y = at[1] - (at[1] - this.#pan.y) * ratio;
    this.#zoom = next;
  }

  #step(factor) {
    const canvas = this.$('#view');
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    this.#zoomAt(factor, box.left + box.width / 2, box.top + box.height / 2);
  }

  #fit() {
    const canvas = this.$('#view');
    const list = this.#world.bodies;
    if (!canvas || !list.length || !canvas.clientWidth) return;
    const bounds = list.reduce(
      (box, body) => {
        const reach = spanOf(body);
        return {
          left: Math.min(box.left, body.x - reach.x),
          top: Math.min(box.top, body.y - reach.y),
          right: Math.max(box.right, body.x + reach.x),
          bottom: Math.max(box.bottom, body.y + reach.y),
        };
      },
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
    this.#controls.forEach((control) => {
      const box = this.#controlBox(control);
      bounds.left = Math.min(bounds.left, box.left);
      bounds.right = Math.max(bounds.right, box.right);
      bounds.top = Math.min(bounds.top, box.top - HANDLE_HEIGHT);
      bounds.bottom = Math.max(bounds.bottom, box.bottom + 0.4);
    });

    const pad = 36;
    const width = Math.max(0.5, bounds.right - bounds.left) * SCALE;
    const height = Math.max(0.5, bounds.bottom - bounds.top) * SCALE;
    this.#zoom = Math.min(1.4, Math.max(0.2, Math.min((canvas.clientWidth - pad * 2) / width, (canvas.clientHeight - pad * 2) / height)));
    this.#pan = {
      x: (canvas.clientWidth - width * this.#zoom) / 2 - bounds.left * SCALE * this.#zoom,
      y: (canvas.clientHeight - height * this.#zoom) / 2 - bounds.top * SCALE * this.#zoom,
    };
  }

  #controlBox(control) {
    const wide = control.kind === 'slider' ? SLIDER_WIDTH : BUTTON_WIDTH;
    const tall = control.kind === 'slider' ? SLIDER_HEIGHT : BUTTON_HEIGHT;
    return {
      left: control.x - wide / 2,
      top: control.y - tall / 2,
      right: control.x + wide / 2,
      bottom: control.y + tall / 2,
      width: wide,
      height: tall,
    };
  }

  #sliderValue(control, point) {
    const box = this.#controlBox(control);
    const travel = box.height - SLIDER_GRIP;
    const from = box.top + SLIDER_GRIP / 2;
    return Math.max(0, Math.min(1, 1 - (point.y - from) / travel));
  }

  #widgetAt(point) {
    for (let index = this.#controls.length - 1; index >= 0; index -= 1) {
      const box = this.#controlBox(this.#controls[index]);
      if (point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom) {
        return this.#controls[index];
      }
    }
    return null;
  }

  #turnGrip(body) {
    if (!body) return null;
    const span = spanOf(body);
    const reach = Math.max(span.x, span.y) + 0.55;
    return {
      x: body.x + Math.sin(body.angle ?? 0) * reach,
      y: body.y - Math.cos(body.angle ?? 0) * reach,
      radius: 0.16,
      from: { x: body.x, y: body.y },
    };
  }

  #turnGripAt(point) {
    if (this.#selected == null) return null;
    const body = this.#world.body(this.#selected);
    const grip = this.#turnGrip(body);
    if (!grip) return null;
    const reach = Math.max(grip.radius, 0.22 / this.#zoom);
    return Math.hypot(point.x - grip.x, point.y - grip.y) <= reach ? body : null;
  }

  #handleBox(control) {
    const box = this.#controlBox(control);
    return {
      left: box.left,
      right: box.right,
      top: box.top - HANDLE_HEIGHT,
      bottom: box.top,
      width: box.width,
      height: HANDLE_HEIGHT,
    };
  }

  #handleAt(point) {
    for (let index = this.#controls.length - 1; index >= 0; index -= 1) {
      const box = this.#handleBox(this.#controls[index]);
      if (point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom) {
        return this.#controls[index];
      }
    }
    return null;
  }

  #moveWidget(widget, point) {
    widget.x = Math.round((this.#drag.origin.x + (point.x - this.#drag.from.x)) * 2) / 2;
    widget.y = Math.round((this.#drag.origin.y + (point.y - this.#drag.from.y)) * 2) / 2;
  }

  #drivable() {
    return this.#joints.filter((joint) => joint.kind === 'jack' || joint.kind === 'motor');
  }

  #liveJoint(id) {
    return this.#world.joints.find((joint) => joint.id === id) ?? null;
  }

  #addControl(point) {
    const joint = this.#jointAt(point);
    const target = joint && (joint.kind === 'jack' || joint.kind === 'motor') ? joint : this.#drivable()[0] ?? null;
    this.#snapshot();
    const button = {
      id: this.#seq++,
      kind: this.#tool,
      x: Math.round(point.x * 2) / 2,
      y: Math.round(point.y * 2) / 2,
      target: target?.id ?? null,
      action: target?.kind === 'motor' ? 'run' : 'extend',
      label: '',
      value: target?.kind === 'motor' ? 0.5 : (target?.extend ?? 0.5),
    };
    this.#controls.push(button);
    this.#selectedControl = button;
    this.#selected = null;
    this.#selectedJoint = null;
    this.#setTool('select');
    this.#inspector();
  }

  #controlName(button) {
    if (button.label) return button.label;
    const joint = this.#joints.find((entry) => entry.id === button.target);
    if (!joint) return 'unbound';
    if (button.kind === 'slider') return joint.kind === 'motor' ? 'speed' : 'length';
    const which = { extend: 'Extend', retract: 'Retract', run: 'Run', reverse: 'Reverse' }[button.action] ?? button.action;
    return `${which} ${joint.kind}`;
  }

  #press(button) {
    this.#held.add(button.id);
    if (!this.#running) this.#toggleRun();
  }

  #release() {
    this.#held.clear();
  }

  #driveControls(dt) {
    const driven = new Set();

    this.#controls.forEach((control) => {
      const joint = this.#joints.find((entry) => entry.id === control.target);
      const live = joint ? this.#liveJoint(joint.id) : null;
      if (!joint || !live) return;

      if (control.kind === 'slider') {
        driven.add(joint.id);
        if (joint.kind === 'jack') {
          live.manual = true;
          live.extend = control.value ?? 0.5;
          joint.extend = live.extend;
          return;
        }
        const power = Math.abs(joint.speed ?? 2.4);
        live.speed = ((control.value ?? 0.5) - 0.5) * 2 * power;
        return;
      }

      if (!this.#held.has(control.id)) return;
      driven.add(joint.id);

      if (joint.kind === 'jack') {
        live.manual = true;
        const step = (control.action === 'retract' ? -1 : 1) * dt * 0.4;
        live.extend = Math.max(0, Math.min(1, (live.extend ?? 0.5) + step));
        joint.extend = live.extend;
        return;
      }
      const power = Math.abs(joint.speed ?? 2.4);
      live.speed = control.action === 'reverse' ? -power : power;
    });

    this.#controls.forEach((control) => {
      const joint = this.#joints.find((entry) => entry.id === control.target);
      const live = joint ? this.#liveJoint(joint.id) : null;
      if (!joint || !live || joint.kind !== 'motor') return;
      if (control.kind === 'button' && !driven.has(joint.id)) live.speed = 0;
    });
  }

  #pointJointAt(point) {
    const reach = 0.2 / this.#zoom;
    let best = null;
    this.#joints.forEach((joint) => {
      if (joint.kind !== 'pin' && joint.kind !== 'motor') return;
      const spot = this.#anchor(joint, 'b') ?? this.#anchor(joint, 'a');
      if (!spot) return;
      const away = Math.hypot(point.x - spot.x, point.y - spot.y);
      if (away < reach && (!best || away < best.away)) best = { joint, away };
    });
    return best?.joint ?? null;
  }

  #jointAt(point) {
    const reach = 0.22 / this.#zoom;
    let best = null;
    this.#joints.forEach((joint) => {
      const a = this.#anchor(joint, 'a');
      const b = this.#anchor(joint, 'b');
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const span = dx * dx + dy * dy;
      const along = span ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / span)) : 0;
      const away = Math.hypot(point.x - (a.x + along * dx), point.y - (a.y + along * dy));
      if (away < reach && (!best || away < best.away)) best = { joint, away };
    });
    return best?.joint ?? null;
  }

  #knob(joint) {
    if (joint.kind !== 'jack' || !joint.manual) return null;
    const a = this.#anchor(joint, 'a');
    const b = this.#anchor(joint, 'b');
    if (!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = Math.hypot(dx, dy) || 1e-6;
    const axis = { x: dx / span, y: dy / span };
    const side = { x: -axis.y, y: axis.x };
    return {
      a,
      b,
      axis,
      side,
      span,
      at: { x: (a.x + b.x) / 2 + side.x * 0.34, y: (a.y + b.y) / 2 + side.y * 0.34 },
    };
  }

  #controlAt(point) {
    const reach = 0.26 / this.#zoom;
    let best = null;
    this.#joints.forEach((joint) => {
      const knob = this.#knob(joint);
      if (!knob) return;
      const away = Math.hypot(point.x - knob.at.x, point.y - knob.at.y);
      if (away < reach && (!best || away < best.away)) best = { joint, knob, away };
    });
    return best;
  }

  #anchor(joint, end) {
    const at = joint[`${end}At`] ?? { x: 0, y: 0 };
    if (joint[end] == null) return at;
    const body = this.#world.body(joint[end]);
    return body ? worldPoint(body, at) : null;
  }

  #down(event) {
    let point = this.#point(event);
    this.$('#view').setPointerCapture(event.pointerId);

    if (this.#tool === 'backdrop') {
      if (!this.#backdrop) {
        toast(t('physics-lab.loadABackdropFirst', 'Load a backdrop first.'), 'danger');
        return;
      }
      this.#snapshot();
      this.#drag = { kind: 'backdrop', from: point, origin: { x: this.#backdrop.x, y: this.#backdrop.y } };
      return;
    }

    if (CONTROLS[this.#tool]) {
      this.#addControl(point);
      return;
    }

    if (this.#tool === 'select') {
      const spun = this.#turnGripAt(point);
      if (spun) {
        this.#snapshot();
        const shape = this.#bodies.find((entry) => entry.id === spun.id);
        this.#drag = {
          kind: 'rotate',
          shape,
          centre: { x: spun.x, y: spun.y },
          start: Math.atan2(point.y - spun.y, point.x - spun.x),
          origin: shape?.angle ?? 0,
        };
        return;
      }

      const grip = this.#handleAt(point);
      if (grip) {
        this.#selectedControl = grip;
        this.#selected = null;
        this.#selectedJoint = null;
        this.#snapshot();
        this.#drag = { kind: 'widget-move', widget: grip, from: point, origin: { x: grip.x, y: grip.y } };
        this.#inspector();
        return;
      }

      const widget = this.#widgetAt(point);
      if (widget) {
        this.#selectedControl = widget;
        this.#selected = null;
        this.#selectedJoint = null;
        // the body of a control drives it, the grip above it moves it
        if (widget.kind === 'slider') {
          widget.value = this.#sliderValue(widget, point);
          if (!this.#running) this.#toggleRun();
        } else {
          this.#press(widget);
        }
        this.#drag = { kind: 'widget', widget, from: point, origin: { x: widget.x, y: widget.y } };
        this.#inspector();
        return;
      }
    }

    if (this.#tool === 'pin' || this.#tool === 'motor') {
      const snap = this.#snapPoint(point);
      const at = snap ? { x: snap.x, y: snap.y } : point;
      const found = this.#world.allAt(at.x, at.y);
      if (snap?.body && !found.includes(snap.body)) found.unshift(snap.body);
      if (!found.length) return;
      this.#snapshot();
      const top = found[0];
      point = at;
      const under = found.find((body) => body !== top) ?? null;
      const joint = {
        id: this.#seq++,
        kind: this.#tool,
        a: under ? under.id : null,
        b: top.id,
        aAt: under ? localPoint(under, point) : { x: point.x, y: point.y },
        bAt: localPoint(top, point),
      };
      if (this.#tool === 'motor') {
        joint.speed = 2.4;
        joint.torque = 60;
      }
      this.#joints.push(joint);
      this.#selectedJoint = joint;
      this.#selected = null;
      this.#reset();
      this.#setTool('select');
      this.#inspector();
      return;
    }

    if (this.#tool === 'linkage') {
      const snap = this.#snapPoint(point);
      if (snap) point = { x: snap.x, y: snap.y };
      const body = snap?.body ?? this.#world.at(point.x, point.y);
      const end = {
        id: body ? body.id : null,
        at: body ? localPoint(body, point) : { x: point.x, y: point.y },
        world: { x: point.x, y: point.y },
      };
      if (!this.#linkFrom) {
        this.#linkFrom = end;
        return;
      }
      this.#addArm(this.#linkFrom, end);
      this.#linkFrom = null;
      return;
    }

    if (LINKS[this.#tool]) {
      const snap = this.#snapPoint(point);
      if (snap) point = { x: snap.x, y: snap.y };
      const body = snap?.body ?? this.#world.at(point.x, point.y);
      const end = body ? { id: body.id, at: localPoint(body, point) } : { id: null, at: { x: point.x, y: point.y } };
      if (!this.#linkFrom) {
        this.#linkFrom = end;
        return;
      }
      if (this.#linkFrom.id === null && end.id === null) {
        this.#linkFrom = null;
        return;
      }
      this.#addLink(this.#linkFrom, end);
      this.#linkFrom = null;
      return;
    }

    if (this.#tool === 'shape') {
      this.#sketch = this.#sketch ?? [];
      const first = this.#sketch[0];
      if (first && this.#sketch.length > 2 && Math.hypot(point.x - first.x, point.y - first.y) < 0.35 / this.#zoom) {
        this.#closeShape();
        return;
      }
      this.#sketch.push({ x: point.x, y: point.y });
      return;
    }

    if (SHAPES[this.#tool]) {
      this.#snapshot();
      this.#drag = { kind: 'create', from: point, shape: this.#tool };
      return;
    }

    if (this.#tool === 'erase') {
      const marker = this.#pointJointAt(point);
      if (marker) {
        this.#snapshot();
        this.#joints = this.#joints.filter((entry) => entry !== marker);
        this.#reset();
        this.#inspector();
        return;
      }
      const body = this.#world.at(point.x, point.y);
      if (body) {
        this.#snapshot();
        this.#bodies = this.#bodies.filter((entry) => entry.id !== body.id);
        this.#joints = this.#joints.filter((joint) => joint.a !== body.id && joint.b !== body.id);
        this.#reset();
        this.#inspector();
        return;
      }
      const joint = this.#jointAt(point);
      if (joint) {
        this.#snapshot();
        this.#joints = this.#joints.filter((entry) => entry !== joint);
        this.#reset();
        this.#inspector();
      }
      return;
    }

    const control = this.#controlAt(point);
    if (control) {
      this.#snapshot();
      this.#selectedJoint = control.joint;
      this.#selected = null;
      this.#drag = { kind: 'jack', joint: control.joint };
      this.#inspector();
      return;
    }

    const pointJoint = this.#pointJointAt(point);
    if (pointJoint) {
      this.#selectedJoint = pointJoint;
      this.#selected = null;
      this.#alsoSelected.clear();
      this.#selectedControl = null;
      this.#inspector();
      return;
    }

    const body = this.#world.at(point.x, point.y);
    if (body) {
      if (event.shiftKey && this.#selected != null && this.#selected !== body.id) {
        if (this.#alsoSelected.has(body.id)) this.#alsoSelected.delete(body.id);
        else this.#alsoSelected.add(body.id);
        this.#inspector();
        this.#draw();
        return;
      }
      this.#alsoSelected.clear();
      this.#selected = body.id;
      this.#selectedJoint = null;
      this.#selectedControl = null;
      this.#trail = new Map();
      if (this.#running) {
        this.#grab = { id: body.id, local: localPoint(body, point) };
      } else {
        this.#snapshot();
        const source = this.#bodies.find((entry) => entry.id === body.id);
        const riders = this.#ridersOf(source);
        this.#drag = {
          kind: 'move',
          body: source,
          riders,
          from: point,
          origin: { x: source.x, y: source.y },
          starts: riders.map((rider) => ({ x: rider.x, y: rider.y })),
        };
      }
      this.#inspector();
      return;
    }

    const joint = this.#jointAt(point);
    if (joint) {
      this.#selectedJoint = joint;
      this.#selected = null;
      this.#selectedControl = null;
      this.#inspector();
      return;
    }

    this.#selected = null;
    this.#alsoSelected.clear();
    this.#selectedJoint = null;
    this.#selectedControl = null;
    this.#touched = true;
    this.#panDrag = { from: [event.clientX, event.clientY], origin: { ...this.#pan } };
    this.#inspector();
  }

  #move(event) {
    if (this.#panDrag) {
      this.#pan = {
        x: this.#panDrag.origin.x + (event.clientX - this.#panDrag.from[0]),
        y: this.#panDrag.origin.y + (event.clientY - this.#panDrag.from[1]),
      };
      return;
    }

    const point = this.#point(event);
    this.#cursor = point;
    this.#snapHint = LINKS[this.#tool] || this.#tool === 'linkage' ? this.#snapPoint(point) : null;
    this.#hover = this.#tool === 'select' && !this.#drag ? this.#world.at(point.x, point.y) : null;
    this.$('#view').dataset.grab = String(Boolean(this.#hover));

    if (this.#drag?.kind === 'backdrop' && this.#backdrop) {
      this.#backdrop.x = this.#drag.origin.x + (point.x - this.#drag.from.x);
      this.#backdrop.y = this.#drag.origin.y + (point.y - this.#drag.from.y);
      return;
    }

    if (this.#drag?.kind === 'rotate') {
      const drag = this.#drag;
      if (!drag.shape) return;
      const now = Math.atan2(point.y - drag.centre.y, point.x - drag.centre.x);
      let angle = drag.origin + (now - drag.start);
      if (event.shiftKey) {
        const step = Math.PI / 12;
        angle = Math.round(angle / step) * step;
      }
      drag.shape.angle = angle;
      this.#reset();
      this.#inspector();
      return;
    }

    if (this.#drag?.kind === 'widget-move') {
      this.#moveWidget(this.#drag.widget, point);
      return;
    }

    if (this.#drag?.kind === 'widget') {
      const widget = this.#drag.widget;
      if (widget.kind === 'slider') {
        widget.value = this.#sliderValue(widget, point);
        return;
      }
      return;
    }

    if (this.#drag?.kind === 'jack') {
      const joint = this.#drag.joint;
      const knob = this.#knob(joint);
      if (knob) {
        const reach = (point.x - knob.a.x) * knob.axis.x + (point.y - knob.a.y) * knob.axis.y;
        const low = joint.min ?? 0.5;
        const high = joint.max ?? 3;
        joint.extend = Math.max(0, Math.min(1, (reach - low) / (high - low || 1)));
        const live = this.#world.joints.find((entry) => entry.kind === 'jack' && entry.a === joint.a && entry.b === joint.b);
        if (live) {
          live.manual = true;
          live.extend = joint.extend;
        }
      }
      return;
    }

    if (this.#drag?.kind === 'move') {
      const shiftX = point.x - this.#drag.from.x;
      const shiftY = point.y - this.#drag.from.y;
      const place = (entry, at) => {
        entry.x = at.x + shiftX;
        entry.y = at.y + shiftY;
        const live = this.#world.body(entry.id);
        if (!live) return;
        live.x = entry.x;
        live.y = entry.y;
        live.vx = 0;
        live.vy = 0;
        live.spin = 0;
      };
      place(this.#drag.body, this.#drag.origin);
      (this.#drag.riders ?? []).forEach((rider, index) => place(rider, this.#drag.starts[index]));
    }
  }

  #up(event) {
    this.#release();
    if (this.#drag?.kind === 'create') {
      const point = this.#point(event);
      this.#addBody(this.#drag.shape, this.#drag.from, point);
      this.#setTool('select');
    }
    this.#drag = null;
    this.#panDrag = null;
    this.#grab = null;
  }

  #closeShape() {
    const drawn = this.#sketch ?? [];
    this.#sketch = null;
    if (drawn.length < 3) return;
    const points = simpleLoop(drawn) ? drawn : hull(drawn);
    if (points.length < 3) return;
    const shape = polyMass(points);
    if (shape.area < 0.02) return;
    this.#snapshot();
    const body = {
      id: this.#seq++,
      kind: 'poly',
      x: shape.centre.x,
      y: shape.centre.y,
      angle: 0,
      points: points.map((point) => ({ x: point.x - shape.centre.x, y: point.y - shape.centre.y })),
      density: 1,
      restitution: 0.15,
      friction: 0.5,
    };
    this.#bodies.push(body);
    this.#selected = body.id;
    this.#selectedJoint = null;
    this.#reset();
    this.#setTool('select');
    this.#inspector();
  }

  #addGear(from, to) {
    const radius = Math.max(0.35, Math.hypot(to.x - from.x, to.y - from.y) || 0.9);
    this.#snapshot();
    const axle = { id: this.#seq++, kind: 'circle', x: from.x, y: from.y, radius: 0.12, pinned: true };
    axle.axleFor = this.#seq;
    const wheel = {
      id: this.#seq++,
      kind: 'circle',
      x: from.x,
      y: from.y,
      radius,
      density: 1,
      friction: 0.7,
      restitution: 0,
      teeth: Math.max(8, Math.round(radius * 12)),
    };
    this.#bodies.push(axle, wheel);
    this.#joints.push({ id: this.#seq++, kind: 'pin', a: axle.id, b: wheel.id, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 } });
    this.#selected = wheel.id;
    this.#selectedJoint = null;
    this.#selectedControl = null;
    this.#reset();
    this.#setTool('select');
    this.#inspector();
  }

  #addBody(shape, from, to) {
    if (shape === 'gear') return this.#addGear(from, to);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dragged = Math.hypot(dx, dy) > 0.25;
    const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const body = {
      id: this.#seq++,
      kind: shape === 'wall' ? 'box' : shape,
      x: dragged ? middle.x : from.x,
      y: dragged ? middle.y : from.y,
      angle: 0,
    };

    if (shape === 'circle') {
      body.radius = dragged ? Math.hypot(dx, dy) / 2 : 0.45;
      body.restitution = 0.35;
      body.friction = 0.35;
    } else {
      body.width = dragged ? Math.max(0.2, Math.abs(dx)) : 1.2;
      body.height = dragged ? Math.max(0.2, Math.abs(dy)) : 0.9;
      body.restitution = shape === 'wall' ? 0.1 : 0.15;
      body.friction = shape === 'wall' ? 0.7 : 0.5;
      if (shape === 'wall') {
        body.pinned = true;
        if (!dragged) {
          body.width = 6;
          body.height = 0.5;
        }
      }
    }

    this.#bodies.push(body);
    this.#selected = body.id;
    this.#selectedJoint = null;
    this.#reset();
    this.#inspector();
  }

  #addArm(from, to) {
    const a = from.world;
    const b = to.world;
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    if (span < 0.3) return;

    this.#snapshot();
    const bar = {
      id: this.#seq++,
      kind: 'box',
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      width: span,
      height: 0.22,
      density: 1.2,
      restitution: 0.1,
      friction: 0.5,
      ghost: true,
    };
    this.#bodies.push(bar);
    this.#reset();

    const live = this.#world.body(bar.id);
    this.#joints.push({ id: this.#seq++, kind: 'pin', a: from.id, b: bar.id, aAt: from.at, bAt: localPoint(live, a) });
    this.#joints.push({ id: this.#seq++, kind: 'pin', a: to.id, b: bar.id, aAt: to.at, bAt: localPoint(live, b) });

    this.#selected = bar.id;
    this.#selectedJoint = null;
    this.#reset();
    this.#setTool('select');
    this.#inspector();
  }

  #addLink(from, to) {
    this.#snapshot();
    const anchorA = from.id == null ? { x: from.at.x, y: from.at.y } : from.at;
    const anchorB = to.id == null ? { x: to.at.x, y: to.at.y } : to.at;
    const pointA = from.id == null ? anchorA : worldPoint(this.#world.body(from.id), anchorA);
    const pointB = to.id == null ? anchorB : worldPoint(this.#world.body(to.id), anchorB);
    const span = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);

    if (this.#tool === 'mesh') {
      const wheelA = this.#world.body(from.id);
      const wheelB = this.#world.body(to.id);
      if (!wheelA || !wheelB || wheelA.kind !== 'circle' || wheelB.kind !== 'circle') return;
      this.#snapshot();
      const mesh = {
        id: this.#seq++,
        kind: 'gear',
        a: from.id,
        b: to.id,
        aAt: { x: 0, y: 0 },
        bAt: { x: 0, y: 0 },
        ratio: this.#gearRatio(from.id, to.id),
      };
      this.#joints.push(mesh);
      this.#selectedJoint = mesh;
      this.#selected = null;
      this.#reset();
      this.#setTool('select');
      this.#inspector();
      return;
    }

    const joint = { id: this.#seq++, kind: this.#tool, a: from.id, b: to.id, aAt: anchorA, bAt: anchorB };
    if (this.#tool === 'spring') {
      joint.rest = span;
      joint.stiffness = 90;
      joint.damping = 1.2;
    } else if (this.#tool === 'rod' || this.#tool === 'rope') {
      joint.rest = span;
    } else if (this.#tool === 'jack') {
      joint.rest = span;
      joint.min = Math.max(0.3, span * 0.6);
      joint.max = span * 1.5;
      joint.speed = 0.4;
      joint.manual = true;
      joint.extend = (span - joint.min) / (joint.max - joint.min || 1);
    } else if (this.#tool === 'motor') {
      joint.speed = 2.4;
      joint.torque = 60;
    }

    this.#joints.push(joint);
    this.#selectedJoint = joint;
    this.#selected = null;
    this.#reset();
    this.#setTool('select');
    this.#inspector();
  }

  #setBackdrop(next) {
    this.#backdrop = next ? { ...next } : null;
    this.#backdropImage = null;
    if (!next?.src) return;
    const image = new Image();
    image.onload = () => {
      this.#backdropImage = image;
      this.#draw();
    };
    image.src = next.src;
  }

  async #loadBackdrop() {
    const picked = await pickFile('image/*', false);
    if (!picked) return;
    const blob = new Blob([picked.data]);
    const bitmap = await createImageBitmap(blob);
    const cap = 1600;
    const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const src = canvas.toDataURL('image/jpeg', 0.82);
    bitmap.close?.();

    this.#snapshot();
    const wide = 12;
    this.#setBackdrop({
      src,
      x: 0,
      y: 0,
      width: wide,
      height: (wide * canvas.height) / canvas.width,
      opacity: 0.6,
    });
    this.#setTool('backdrop');
    this.#inspector();
  }

  async #importSvg() {
    try {
      const picked = await pickFile('image/svg+xml,.svg');
      if (!picked) return;
      const rings = shapesFromSvg(picked.data, { size: 5 });
      const middle = this.#middleOfView();
      this.#snapshot();
      const made = rings
        .map((ring) => {
          const shape = polyMass(ring);
          if (shape.area < 0.005) return null;
          return {
            id: this.#seq++,
            kind: 'poly',
            x: middle.x + shape.centre.x,
            y: middle.y + shape.centre.y,
            angle: 0,
            points: ring.map((point) => ({ x: point.x - shape.centre.x, y: point.y - shape.centre.y })),
            density: 1,
            restitution: 0.15,
            friction: 0.5,
          };
        })
        .filter(Boolean);
      if (!made.length) throw new Error('Those outlines were too small to use.');
      this.#bodies.push(...made);
      this.#selected = made[0].id;
      this.#reset();
      this.#inspector();
      this.#draw();
      toast(`Added ${made.length} shape${made.length > 1 ? 's' : ''} from the drawing.`);
    } catch (error) {
      toast(error.message, 'danger');
    }
  }

  #middleOfView() {
    const canvas = this.$('#view');
    if (!canvas) return { x: 0, y: 0 };
    const span = SCALE * this.#zoom;
    return {
      x: (canvas.clientWidth / 2 - this.#pan.x) / span,
      y: (canvas.clientHeight / 2 - this.#pan.y) / span,
    };
  }

  #ridersOf(body) {
    const held = (entry) => entry.pinned || entry.axleFor != null;
    const joined = new Set();
    this.#joints.forEach((joint) => {
      if (!['pin', 'motor', 'weld'].includes(joint.kind)) return;
      if (joint.a === body.id && joint.b != null) joined.add(joint.b);
      if (joint.b === body.id && joint.a != null) joined.add(joint.a);
    });

    return this.#bodies.filter((entry) => {
      if (entry.id === body.id) return false;
      if (entry.axleFor === body.id) return true;
      if (!joined.has(entry.id) || !held(entry)) return false;
      const live = this.#world.body(body.id);
      return live ? this.#world.holds(live, entry.x, entry.y) : false;
    });
  }

  #gearRatio(aId, bId) {
    const a = this.#bodies.find((body) => body.id === aId);
    const b = this.#bodies.find((body) => body.id === bId);
    if (!a || !b) return 1;
    if (a.teeth && b.teeth) return b.teeth / a.teeth;
    return (b.radius ?? 1) / (a.radius ?? 1);
  }

  #retuneMeshes(bodyId) {
    this.#joints
      .filter((joint) => joint.kind === 'gear' && (joint.a === bodyId || joint.b === bodyId))
      .forEach((joint) => {
        joint.ratio = this.#gearRatio(joint.a, joint.b);
      });
  }

  #anchorPoints(body) {
    const spots = [{ x: body.x, y: body.y, what: 'centre' }];
    if (body.kind === 'circle') {
      [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((step) => {
        spots.push({
          x: body.x + Math.cos(body.angle + step) * body.radius,
          y: body.y + Math.sin(body.angle + step) * body.radius,
          what: 'edge',
        });
      });
      return spots;
    }
    const corners = bodyCorners(body);
    corners.forEach((corner, index) => {
      spots.push({ x: corner.x, y: corner.y, what: 'corner' });
      const next = corners[(index + 1) % corners.length];
      spots.push({ x: (corner.x + next.x) / 2, y: (corner.y + next.y) / 2, what: 'edge' });
    });
    return spots;
  }

  #snapPoint(point, skip = null) {
    if (!this.config.get('snap', true)) return null;
    const reach = 0.34 / this.#zoom;
    let best = null;
    this.#world.bodies.forEach((body) => {
      if (body === skip) return;
      this.#anchorPoints(body).forEach((spot) => {
        const away = Math.hypot(point.x - spot.x, point.y - spot.y);
        const bias = spot.what === 'centre' ? away * 0.7 : away;
        if (away < reach && (!best || bias < best.bias)) best = { ...spot, body, away, bias };
      });
    });
    return best;
  }

  #outlineOf(body) {
    if (body.kind !== 'circle') return bodyCorners(body);
    const steps = Math.max(16, Math.min(48, Math.round(body.radius * 24)));
    return Array.from({ length: steps }, (item, index) => {
      const angle = body.angle + (index / steps) * Math.PI * 2;
      return { x: body.x + Math.cos(angle) * body.radius, y: body.y + Math.sin(angle) * body.radius };
    });
  }

  #combine(mode) {
    const first = this.#bodies.find((body) => body.id === this.#selected);
    const others = [...this.#alsoSelected]
      .map((id) => this.#bodies.find((body) => body.id === id))
      .filter(Boolean);
    if (!first || !others.length) {
      toast(t('physics-lab.pickOneShapeThenShift', 'Pick one shape, then shift click a second one.'), 'danger');
      return;
    }

    const liveOf = (body) => this.#world.body(body.id);
    if (!liveOf(first) || others.some((body) => !liveOf(body))) return;

    // fold each further shape into the running result, so three or more combine
    let kept = [this.#outlineOf(liveOf(first))];
    for (const other of others) {
      const cut = this.#outlineOf(liveOf(other));
      const next = [];
      let touched = false;
      for (const ring of kept) {
        const rings = clipPolygons(ring, cut, mode);
        if (!rings) {
          // this ring and the cutter do not meet
          if (mode === 'intersect') continue;
          next.push(ring);
          continue;
        }
        touched = true;
        next.push(...rings);
      }
      if (mode === 'union' && !touched) next.push(cut);
      kept = next.filter((ring) => ring && polygonArea(ring) > 0.01);
      if (!kept.length) break;
    }

    if (!kept.length) {
      toast(t('physics-lab.thatLeavesNothingBehind', 'That leaves nothing behind.'), 'danger');
      return;
    }

    const gone = [first.id, ...others.map((body) => body.id)];
    this.#snapshot();
    this.#sync();
    this.#bodies = this.#bodies.filter((body) => !gone.includes(body.id));
    this.#joints = this.#joints.filter((joint) => !gone.includes(joint.a) && !gone.includes(joint.b));

    const made = kept.map((ring) => {
      const shape = polyMass(ring);
      return {
        id: this.#seq++,
        kind: 'poly',
        x: shape.centre.x,
        y: shape.centre.y,
        angle: 0,
        points: ring.map((point) => ({ x: point.x - shape.centre.x, y: point.y - shape.centre.y })),
        density: first.density ?? 1,
        restitution: first.restitution ?? 0.15,
        friction: first.friction ?? 0.5,
        pinned: first.pinned ?? false,
      };
    });
    this.#bodies.push(...made);

    this.#alsoSelected.clear();
    this.#selected = made[0].id;
    this.#reset();
    this.#inspector();
    this.#draw();
  }

  #turn(radians) {
    const body = this.#bodies.find((entry) => entry.id === this.#selected);
    if (!body || body.kind === 'circle') return;
    this.#snapshot();
    this.#sync();
    body.angle = (body.angle ?? 0) + radians;
    this.#reset();
    this.#inspector();
    this.#draw();
  }

  #copy() {
    const ids = new Set([this.#selected, ...this.#alsoSelected].filter((id) => id != null));
    if (!ids.size) return;
    this.#sync();
    const bodies = this.#bodies.filter((body) => ids.has(body.id));
    const joints = this.#joints.filter((joint) => ids.has(joint.a) && ids.has(joint.b));
    const controls = this.#controls.filter((control) => joints.some((joint) => joint.id === control.target));
    this.#clipboard = {
      bodies: bodies.map((body) => ({ ...body })),
      joints: joints.map((joint) => ({ ...joint })),
      controls: controls.map((control) => ({ ...control })),
    };
    toast(`Copied ${bodies.length} part${bodies.length > 1 ? 's' : ''}.`);
  }

  #paste() {
    const held = this.#clipboard;
    if (!held?.bodies.length) return;
    this.#snapshot();
    this.#sync();

    const shift = 0.6;
    const swap = new Map();
    const bodies = held.bodies.map((body) => {
      const copy = { ...body, id: this.#seq++, x: body.x + shift, y: body.y + shift };
      swap.set(body.id, copy.id);
      return copy;
    });
    bodies.forEach((body) => {
      if (body.axleFor != null && swap.has(body.axleFor)) body.axleFor = swap.get(body.axleFor);
    });

    const joints = held.joints.map((joint) => ({
      ...joint,
      id: this.#seq++,
      a: swap.get(joint.a) ?? joint.a,
      b: swap.get(joint.b) ?? joint.b,
    }));
    const jointSwap = new Map(held.joints.map((joint, index) => [joint.id, joints[index].id]));
    const controls = held.controls.map((control) => ({
      ...control,
      id: this.#seq++,
      x: control.x + shift,
      y: control.y + shift,
      target: jointSwap.get(control.target) ?? control.target,
    }));

    this.#bodies.push(...bodies);
    this.#joints.push(...joints);
    this.#controls.push(...controls);

    this.#selected = bodies[0].id;
    this.#alsoSelected = new Set(bodies.slice(1).map((body) => body.id));
    this.#selectedJoint = null;
    this.#selectedControl = null;
    this.#reset();
    this.#inspector();
    this.#draw();
  }

  #lift(toFront) {
    if (this.#selected == null) return;
    const at = this.#bodies.findIndex((body) => body.id === this.#selected);
    if (at < 0) return;
    this.#snapshot();
    this.#sync();
    const [body] = this.#bodies.splice(at, 1);
    if (toFront) this.#bodies.push(body);
    else this.#bodies.unshift(body);
    this.#reset();
    this.#draw();
  }

  #remove() {
    if (this.#selectedControl) {
      this.#snapshot();
      this.#controls = this.#controls.filter((button) => button !== this.#selectedControl);
      this.#selectedControl = null;
      this.#inspector();
      this.#draw();
      return;
    }
    if (this.#selectedJoint) {
      this.#snapshot();
      this.#controls = this.#controls.filter((button) => button.target !== this.#selectedJoint.id);
      this.#joints = this.#joints.filter((joint) => joint !== this.#selectedJoint);
      this.#selectedJoint = null;
      this.#reset();
      this.#inspector();
      return;
    }
    if (this.#selected == null) return;
    this.#snapshot();
    this.#bodies = this.#bodies.filter((body) => body.id !== this.#selected);
    this.#joints = this.#joints.filter((joint) => joint.a !== this.#selected && joint.b !== this.#selected);
    this.#selected = null;
    this.#reset();
    this.#inspector();
  }

  #savedList() {
    const target = this.$('#saved');
    if (!target) return;
    const rows = this.#designs.list();
    if (!rows.length) {
      target.innerHTML = html`<span class="hint">${t('physics-lab.nothingSavedYetNameA', 'Nothing saved yet. Name a scene above and save it.')}</span>`;
      return;
    }
    target.innerHTML = rows
      .map(
        (row) => html`<div class="row">
          <button data-load="${row.name}" data-open="${String(row.name === this.#openName)}" title="${row.name}">${row.name}</button>
          <button class="drop" data-drop="${row.name}" title="Delete ${row.name}">${icon('eraser', 14)}</button>
        </div>`,
      )
      .join('');
    target.querySelectorAll('[data-load]').forEach((node) =>
      node.addEventListener('click', () => {
        const design = this.#designs.get(node.dataset.load);
        if (!design) return;
        this.#snapshot();
        this.#restore(design);
        this.#openName = node.dataset.load;
        this.#designs.setOpen(this.#openName);
        this.#worldFields();
        this.#nameField();
        this.#savedList();
        this.#inspector();
        this.#fit();
      }),
    );
    target.querySelectorAll('[data-drop]').forEach((node) =>
      node.addEventListener('click', () => {
        this.#designs.remove(node.dataset.drop);
        if (this.#openName === node.dataset.drop) this.#openName = null;
        this.#savedList();
      }),
    );
  }

  #nameField() {
    const field = this.$('#save-name');
    if (field) field.value = this.#openName ?? '';
  }

  #worldFields() {
    const gravity = this.$('#gravity');
    if (gravity) gravity.value = this.#gravity;
    const attraction = this.$('#attraction');
    if (attraction) attraction.value = this.#attraction;
  }

  #saveNamed() {
    const field = this.$('#save-name');
    const name = (field?.value ?? '').trim();
    if (!name) {
      field?.focus();
      return;
    }
    this.#sync();
    this.#openName = this.#designs.save(name, this.#design());
    this.#savedList();
  }

  #exportFile() {
    this.#sync();
    this.#designs.toFile(this.#openName ?? 'physics-scene', this.#design());
  }

  async #importFile() {
    try {
      const picked = await this.#designs.fromFile();
      if (!picked) return;
      this.#snapshot();
      this.#restore(picked.design);
      this.#openName = picked.name;
      this.#worldFields();
      this.#nameField();
      this.#savedList();
      this.#inspector();
      this.#fit();
    } catch (error) {
      toast(error.message, 'danger');
    }
  }

  #inspector() {
    const target = this.$('#inspector');
    if (!target) return;

    if (this.#selectedControl) {
      const button = this.#selectedControl;
      const targets = this.#drivable();
      const joint = targets.find((entry) => entry.id === button.target);
      const actions = joint?.kind === 'motor'
        ? [['run', 'Run forward'], ['reverse', 'Run backward']]
        : [['extend', 'Extend'], ['retract', 'Retract']];
      const isSlider = button.kind === 'slider';

      target.innerHTML = html`
        <div class="label">${isSlider ? 'Slider' : 'Button'}</div>
        ${targets.length
          ? html`<jg-field label="${t('physics-lab.drives', 'Drives')}">
                <jg-select id="target" size="sm" value="${String(button.target ?? '')}">
                  ${targets.map((entry) => html`<option value="${entry.id}">${entry.kind} ${entry.id}</option>`)}
                </jg-select>
              </jg-field>
              ${isSlider
                ? html`<div class="hint">${joint?.kind === 'motor' ? 'Middle stops the motor, either side runs it.' : 'Slide to set how far the jack reaches.'}</div>`
                : html`<jg-field label="${t('physics-lab.whileHeld', 'While held')}">
                    <jg-select id="action" size="sm" value="${button.action}">
                      ${actions.map(([value, name]) => html`<option value="${value}">${name}</option>`)}
                    </jg-select>
                  </jg-field>`}
              <jg-field label="${t('physics-lab.label', 'Label')}"><jg-input id="label" size="sm" value="${button.label ?? ''}" placeholder="${this.#controlName(button)}"></jg-input></jg-field>`
          : html`<div class="hint">${t('physics-lab.addAJackOrA', 'Add a jack or a motor first, then this button can drive it.')}</div>`}
        <jg-button size="sm" variant="outline" id="drop">Remove ${isSlider ? 'slider' : 'button'}</jg-button>
      `;

      const bind = (id, key, cast = (value) => value) => {
        const field = this.$(`#${id}`);
        if (!field) return;
        this.on(field, 'change', () => {
          this.#snapshot();
          button[key] = cast(field.value);
          this.#inspector();
          this.#draw();
        });
      };
      bind('target', 'target', Number);
      bind('action', 'action');
      bind('label', 'label');
      this.on(this.$('#drop'), 'click', () => this.#remove());
      return;
    }

    if (this.#selectedJoint) {
      const joint = this.#selectedJoint;
      target.innerHTML = html`
        <div class="label">${LINKS[joint.kind]?.label ?? joint.kind}</div>
        ${joint.kind === 'spring'
          ? html`<jg-field label="${t('physics-lab.stiffness', 'Stiffness')}"><jg-input id="stiffness" size="sm" type="number" step="5" min="1" value="${joint.stiffness}"></jg-input></jg-field>
              <jg-field label="${t('physics-lab.damping', 'Damping')}"><jg-input id="damping" size="sm" type="number" step="0.2" min="0" value="${joint.damping}"></jg-input></jg-field>
              <jg-field label="${t('physics-lab.restLengthMm', 'Rest length mm')}"><jg-input id="rest" size="sm" type="number" step="10" min="100" value="${toMm(joint.rest)}"></jg-input></jg-field>`
          : ''}
        ${joint.kind === 'rod' || joint.kind === 'rope'
          ? html`<jg-field label="${t('physics-lab.length', 'Length')}"><jg-input id="rest" size="sm" type="number" step="0.1" min="0.1" value="${joint.rest.toFixed(2)}"></jg-input></jg-field>`
          : ''}
        ${joint.kind === 'jack'
          ? html`<jg-field label="${t('physics-lab.shortestMm', 'Shortest mm')}"><jg-input id="min" size="sm" type="number" step="10" min="100" value="${toMm(joint.min)}"></jg-input></jg-field>
              <jg-field label="${t('physics-lab.longestMm', 'Longest mm')}"><jg-input id="max" size="sm" type="number" step="10" min="200" value="${toMm(joint.max)}"></jg-input></jg-field>
              <label class="row tight" style="gap:6px">
                <input type="checkbox" id="manual" ${joint.manual ? 'checked' : ''} />
                <span class="hint">${t('physics-lab.drivenByHand', 'Driven by hand')}</span>
              </label>
              ${joint.manual
                ? html`<jg-field label="${t('physics-lab.extension', 'Extension')}"><jg-slider id="extend" min="0" max="100" step="1" value="${Math.round((joint.extend ?? 0.5) * 100)}"></jg-slider></jg-field>`
                : html`<jg-field label="${t('physics-lab.cyclesPerSecond', 'Cycles per second')}"><jg-input id="speed" size="sm" type="number" step="0.05" min="0.05" value="${joint.speed ?? 0.4}"></jg-input></jg-field>`}`
          : ''}
        ${joint.kind === 'motor'
          ? html`<jg-field label="${t('physics-lab.speedRadS', 'Speed rad/s')}"><jg-input id="speed" size="sm" type="number" step="0.2" value="${joint.speed}"></jg-input></jg-field>
              <jg-field label="${t('physics-lab.maxTorque', 'Max torque')}"><jg-input id="torque" size="sm" type="number" step="5" min="1" value="${joint.torque}"></jg-input></jg-field>`
          : ''}
        <jg-button size="sm" variant="outline" id="drop">${t('physics-lab.removeLink', 'Remove link')}</jg-button>
      `;
      const bind = (id, key) => {
        const field = this.$(`#${id}`);
        if (!field) return;
        this.on(field, 'change', () => {
          this.#snapshot();
          joint[key] = Number(field.value);
          this.#reset();
        });
      };
      const bindLength = (id, key, least) => {
        const field = this.$(`#${id}`);
        if (!field) return;
        this.on(field, 'change', () => {
          this.#snapshot();
          joint[key] = Math.max(least, fromMm(field.value, joint[key]));
          this.#reset();
        });
      };
      bind('stiffness', 'stiffness');
      bind('damping', 'damping');
      bindLength('rest', 'rest', 0.02);
      bindLength('min', 'min', 0.02);
      bindLength('max', 'max', 0.04);
      bind('speed', 'speed');
      bind('torque', 'torque');

      const manual = this.$('#manual');
      if (manual) {
        this.on(manual, 'change', () => {
          this.#snapshot();
          joint.manual = manual.checked;
          if (joint.manual && joint.extend == null) joint.extend = 0.5;
          this.#reset();
          this.#inspector();
        });
      }
      const extend = this.$('#extend');
      if (extend) {
        this.on(extend, 'input', () => {
          joint.extend = Number(extend.value) / 100;
          const live = this.#world.joints.find((entry) => entry.kind === 'jack' && entry.a === joint.a && entry.b === joint.b);
          if (live) {
            live.manual = true;
            live.extend = joint.extend;
          }
        });
      }

      this.on(this.$('#drop'), 'click', () => this.#remove());
      return;
    }

    const body = this.#bodies.find((entry) => entry.id === this.#selected);
    if (!body && this.#tool === 'backdrop' && this.#backdrop) {
      const back = this.#backdrop;
      target.innerHTML = html`
        <div class="label">${t('physics-lab.backdrop', 'Backdrop')}</div>
        <jg-field label="${t('physics-lab.widthMm', 'Width mm')}"><jg-input id="backWidth" size="sm" type="number" step="100" min="500" value="${toMm(back.width)}"></jg-input></jg-field>
        <jg-field label="${t('physics-lab.fade', 'Fade')}"><jg-slider id="backFade" min="5" max="100" step="5" value="${Math.round((back.opacity ?? 0.6) * 100)}"></jg-slider></jg-field>
        <jg-button size="sm" variant="outline" id="backDrop">${t('physics-lab.removeBackdrop', 'Remove backdrop')}</jg-button>
      `;
      const width = this.$('#backWidth');
      this.on(width, 'change', () => {
        this.#snapshot();
        const ratio = back.height / back.width;
        back.width = Math.max(0.5, fromMm(width.value, back.width));
        back.height = back.width * ratio;
        this.#draw();
      });
      const fade = this.$('#backFade');
      this.on(fade, 'input', () => {
        back.opacity = Number(fade.value) / 100;
        this.#draw();
      });
      this.on(this.$('#backDrop'), 'click', () => {
        this.#snapshot();
        this.#setBackdrop(null);
        this.#setTool('select');
        this.#inspector();
        this.#draw();
      });
      return;
    }
    if (!body) {
      target.innerHTML = html`<div class="hint">${t('physics-lab.pickABodyOrA', 'Pick a body or a link to change it, or drop a new one from the palette.')}</div>`;
      return;
    }

    const live = this.#world.body(body.id);
    target.innerHTML = html`
      <div class="label">${body.ghost ? 'Linkage bar' : body.teeth ? 'Gear' : body.kind === 'circle' ? 'Ball' : body.kind === 'poly' ? 'Shape' : body.pinned ? 'Wall' : 'Block'}</div>
      ${body.kind === 'circle' && body.teeth
        ? html`<jg-field label="${t('physics-lab.radiusMm', 'Radius mm')}"><jg-input id="radius" size="sm" type="number" step="10" min="200" value="${toMm(body.radius)}"></jg-input></jg-field>
            <jg-field label="${t('physics-lab.teeth', 'Teeth')}"><jg-input id="teeth" size="sm" type="number" step="1" min="6" max="72" value="${Math.round(body.teeth)}"></jg-input></jg-field>
            <div class="hint">${t('physics-lab.meshedWheelsTurnInThe', 'Meshed wheels turn in the ratio of their teeth.')}</div>`
        : body.kind === 'circle'
        ? html`<jg-field label="${t('physics-lab.radiusMm', 'Radius mm')}"><jg-input id="radius" size="sm" type="number" step="10" min="50" value="${toMm(body.radius)}"></jg-input></jg-field>`
        : body.kind === 'poly'
          ? html`<div class="hint">${body.points.length} corners</div>`
          : html`<jg-field label="${t('physics-lab.widthMm', 'Width mm')}"><jg-input id="width" size="sm" type="number" step="10" min="100" value="${toMm(body.width)}"></jg-input></jg-field>
              <jg-field label="${t('physics-lab.heightMm', 'Height mm')}"><jg-input id="height" size="sm" type="number" step="10" min="100" value="${toMm(body.height)}"></jg-input></jg-field>`}
      ${body.kind === 'circle'
        ? ''
        : html`<jg-field label="${t('physics-lab.angleDegrees', 'Angle degrees')}"><jg-input id="angle" size="sm" type="number" step="5" value="${Math.round((((body.angle ?? 0) * 180) / Math.PI) * 10) / 10}"></jg-input></jg-field>`}
      <jg-field label="${t('physics-lab.density', 'Density')}"><jg-input id="density" size="sm" type="number" step="0.1" min="0.05" value="${body.density ?? 1}"></jg-input></jg-field>
      <jg-field label="${t('physics-lab.bounce', 'Bounce')}"><jg-input id="restitution" size="sm" type="number" step="0.05" min="0" max="1" value="${body.restitution ?? 0.2}"></jg-input></jg-field>
      <jg-field label="${t('physics-lab.friction', 'Friction')}"><jg-input id="friction" size="sm" type="number" step="0.05" min="0" max="1.5" value="${body.friction ?? 0.35}"></jg-input></jg-field>
      <label class="row tight" style="gap:6px">
        <input type="checkbox" id="pinned" ${body.pinned ? 'checked' : ''} />
        <span class="hint">${t('physics-lab.heldInPlace', 'Held in place')}</span>
      </label>
      <div class="hint">Mass ${live && live.mass ? `${live.mass.toFixed(2)} kg` : 'fixed'}</div>
      <jg-button size="sm" variant="outline" id="drop">${t('physics-lab.removeBody', 'Remove body')}</jg-button>
    `;

    const bindLength = (id, key, least) => {
      const field = this.$(`#${id}`);
      if (!field) return;
      this.on(field, 'change', () => {
        this.#snapshot();
        body[key] = Math.max(least, fromMm(field.value, body[key]));
        this.#reset();
        this.#inspector();
      });
    };

    const bind = (id, key) => {
      const field = this.$(`#${id}`);
      if (!field) return;
      this.on(field, 'change', () => {
        this.#snapshot();
        body[key] = Number(field.value);
        this.#reset();
        this.#inspector();
      });
    };
    const teeth = this.$('#teeth');
    if (teeth) {
      this.on(teeth, 'change', () => {
        this.#snapshot();
        body.teeth = Math.max(6, Math.round(Number(teeth.value) || body.teeth));
        this.#retuneMeshes(body.id);
        this.#reset();
        this.#inspector();
        this.#draw();
      });
    }
    const radius = this.$('#radius');
    if (radius && body.teeth) {
      this.on(radius, 'change', () => {
        this.#snapshot();
        body.radius = Math.max(0.2, fromMm(radius.value, body.radius));
        this.#retuneMeshes(body.id);
        this.#reset();
        this.#inspector();
        this.#draw();
      });
    } else {
      bindLength('radius', 'radius', 0.01);
    }
    bindLength('width', 'width', 0.02);
    bindLength('height', 'height', 0.02);
    const angle = this.$('#angle');
    if (angle) {
      this.on(angle, 'change', () => {
        this.#snapshot();
        this.#sync();
        body.angle = ((Number(angle.value) || 0) * Math.PI) / 180;
        this.#reset();
        this.#draw();
      });
    }
    bind('density', 'density');
    bind('restitution', 'restitution');
    bind('friction', 'friction');

    const pinned = this.$('#pinned');
    if (pinned) {
      this.on(pinned, 'change', () => {
        this.#snapshot();
        body.pinned = pinned.checked;
        this.#reset();
        this.#inspector();
      });
    }
    this.on(this.$('#drop'), 'click', () => this.#remove());
  }

  #palette() {
    if (this.#paint) return this.#paint;
    const styles = getComputedStyle(this);
    this.#paint = {
      line: styles.getPropertyValue('--foreground').trim() || '#111',
      soft: styles.getPropertyValue('--muted-foreground').trim() || '#888',
      border: styles.getPropertyValue('--border').trim() || '#ddd',
      ring: styles.getPropertyValue('--ring').trim() || '#8a1c3b',
      card: styles.getPropertyValue('--card').trim() || '#fff',
      font: styles.getPropertyValue('--font-sans') || 'sans-serif',
      mono: styles.getPropertyValue('--font-mono') || 'monospace',
      live: '#4a9d6b',
    };
    return this.#paint;
  }

  #loop() {
    const watch = new MutationObserver(() => {
      this.#paint = null;
      this.#grid = null;
    });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    this.track(() => watch.disconnect());

    let carry = 0;
    let last = performance.now();
    const tick = (now) => {
      carry += Math.min(0.2, (now - last) / 1000);
      last = now;
      const dt = 1 / 240;
      this.#world.options.iterations = Math.max(3, Number(this.config.get('accuracy', 8)));

      let guard = 0;
      while (carry >= dt && guard < 24) {
        if (this.#running) {
          this.#driveControls(dt);
          if (this.#grab && this.#cursor) this.#world.pull(this.#grab.id, this.#grab.local, this.#cursor, dt);
          this.#world.step(dt);
        }
        carry -= dt;
        guard += 1;
      }

      if (this.#running && this.config.get('trails', true)) {
        const traced = this.#attraction
          ? this.#world.bodies.filter((body) => body.invMass)
          : this.#world.bodies.filter((body) => body.id === this.#selected);
        const seen = new Set();
        traced.forEach((body) => {
          seen.add(body.id);
          const path = this.#trail.get(body.id) ?? [];
          path.push({ x: body.x, y: body.y });
          if (path.length > 1400) path.shift();
          this.#trail.set(body.id, path);
        });
        [...this.#trail.keys()].forEach((id) => {
          if (!seen.has(id)) this.#trail.delete(id);
        });
      }

      this.#draw();
      this.#readout();
      this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
    this.track(() => cancelAnimationFrame(this.#frame));
  }

  #readout() {
    const target = this.$('#readout');
    if (!target) return;
    const body = this.#selected != null ? this.#world.body(this.#selected) : null;
    const parts = [`t ${this.#world.time.toFixed(2)} s`];
    if (body) {
      parts.push(`v ${toMm(Math.hypot(body.vx, body.vy))} mm/s`);
      parts.push(`w ${body.spin.toFixed(2)} rad/s`);
    } else {
      parts.push(`KE ${this.#world.energy().toFixed(1)} J`);
    }
    target.textContent = parts.join('   ');
  }

  #draw() {
    const canvas = this.$('#view');
    if (!canvas) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    if (canvas.width !== width * ratio) canvas.width = width * ratio;
    if (canvas.height !== height * ratio) canvas.height = height * ratio;

    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const paint = this.#palette();

    this.#gridFill(context, width, height, paint);

    context.translate(this.#pan.x, this.#pan.y);
    context.scale(SCALE * this.#zoom, SCALE * this.#zoom);
    context.lineWidth = 1.6 / (SCALE * this.#zoom);

    if (this.#backdrop && this.#backdropImage) {
      context.save();
      context.globalAlpha = this.#backdrop.opacity ?? 0.6;
      context.drawImage(
        this.#backdropImage,
        this.#backdrop.x - this.#backdrop.width / 2,
        this.#backdrop.y - this.#backdrop.height / 2,
        this.#backdrop.width,
        this.#backdrop.height,
      );
      context.restore();
      if (this.#tool === 'backdrop') {
        context.save();
        context.setLineDash([0.16, 0.12]);
        context.strokeStyle = paint.ring;
        context.lineWidth = 2 / (SCALE * this.#zoom);
        context.strokeRect(
          this.#backdrop.x - this.#backdrop.width / 2,
          this.#backdrop.y - this.#backdrop.height / 2,
          this.#backdrop.width,
          this.#backdrop.height,
        );
        context.restore();
      }
    }

    this.#drawTrail(context, paint);
    this.#world.bodies.forEach((body) => this.#drawBody(context, body, paint));
    this.#joints.forEach((joint) => this.#drawJoint(context, joint, paint));
    this.#drawTurnGrip(context, paint);

    if (this.#linkFrom && this.#cursor) {
      const start =
        this.#linkFrom.id == null
          ? this.#linkFrom.at
          : worldPoint(this.#world.body(this.#linkFrom.id), this.#linkFrom.at);
      context.save();
      context.setLineDash([0.14, 0.1]);
      context.strokeStyle = paint.ring;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(this.#cursor.x, this.#cursor.y);
      context.stroke();
      context.restore();
    }

    if (this.#drag?.kind === 'create' && this.#cursor) this.#drawGhost(context, paint);

    if (this.#sketch?.length) {
      context.save();
      context.strokeStyle = paint.ring;
      context.setLineDash([0.12, 0.09]);
      context.beginPath();
      this.#sketch.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
      if (this.#cursor) context.lineTo(this.#cursor.x, this.#cursor.y);
      context.stroke();
      context.restore();
      this.#sketch.forEach((point) => {
        context.beginPath();
        context.arc(point.x, point.y, 0.08, 0, Math.PI * 2);
        context.fillStyle = paint.ring;
        context.fill();
      });
    }

    if (this.config.get('vectors', false)) this.#drawVectors(context, paint);

    if (this.config.get('centres', true)) {
      context.save();
      context.strokeStyle = paint.soft;
      context.lineWidth = 1.2 / (SCALE * this.#zoom);
      const arm = 0.09;
      this.#world.bodies.forEach((body) => {
        if (!body.invMass && body.radius && body.radius < 0.2) return;
        context.beginPath();
        context.moveTo(body.x - arm, body.y);
        context.lineTo(body.x + arm, body.y);
        context.moveTo(body.x, body.y - arm);
        context.lineTo(body.x, body.y + arm);
        context.stroke();
        context.beginPath();
        context.arc(body.x, body.y, arm * 0.42, 0, Math.PI * 2);
        context.stroke();
      });
      context.restore();
    }

    if (this.#snapHint) {
      context.save();
      context.beginPath();
      context.arc(this.#snapHint.x, this.#snapHint.y, 0.16, 0, Math.PI * 2);
      context.fillStyle = `color-mix(in srgb, ${paint.ring} 30%, transparent)`;
      context.fill();
      context.strokeStyle = paint.ring;
      context.lineWidth = 2 / (SCALE * this.#zoom);
      context.stroke();
      if (this.#snapHint.what === 'centre') {
        const arm = 0.13;
        context.beginPath();
        context.moveTo(this.#snapHint.x - arm, this.#snapHint.y);
        context.lineTo(this.#snapHint.x + arm, this.#snapHint.y);
        context.moveTo(this.#snapHint.x, this.#snapHint.y - arm);
        context.lineTo(this.#snapHint.x, this.#snapHint.y + arm);
        context.stroke();
      }
      context.restore();
    }

    this.#controls.forEach((button) => this.#drawControl(context, button, paint));
  }

  #gridFill(context, width, height, paint) {
    if (this.#grid?.tone !== paint.soft) {
      const tile = (size, radius, alpha) => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const brush = canvas.getContext('2d');
        brush.fillStyle = paint.soft;
        brush.globalAlpha = alpha;
        brush.beginPath();
        brush.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
        brush.fill();
        return canvas;
      };
      this.#grid = { tone: paint.soft, dots: context.createPattern(tile(SCALE, 1, 0.4), 'repeat') };
    }
    const size = SCALE * this.#zoom;
    this.#grid.dots.setTransform(new DOMMatrix().translateSelf(this.#pan.x - size / 2, this.#pan.y - size / 2).scaleSelf(this.#zoom));
    context.fillStyle = this.#grid.dots;
    context.fillRect(0, 0, width, height);
  }

  #drawTrail(context, paint) {
    if (!this.#trail.size) return;
    context.save();
    context.strokeStyle = paint.ring;
    context.globalAlpha = 0.45;
    this.#trail.forEach((path) => {
      if (path.length < 2) return;
      context.beginPath();
      path.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
      context.stroke();
    });
    context.restore();
  }

  #drawBody(context, body, paint) {
    const picked = body.id === this.#selected || this.#alsoSelected.has(body.id);
    const held = !body.invMass;
    context.save();
    context.strokeStyle = picked ? paint.ring : paint.line;
    context.lineWidth = (picked ? 2.6 : 1.7) / (SCALE * this.#zoom);
    context.fillStyle = held ? `color-mix(in srgb, ${paint.soft} 34%, transparent)` : paint.card;

    if (body.kind === 'circle' && body.teeth) {
      const count = Math.max(6, Math.round(body.teeth));
      const tip = body.radius;
      const module = (2 * tip) / (count + 2);
      const pitch = tip - module;
      const root = Math.max(tip * 0.35, pitch - module * 1.25);
      const step = (Math.PI * 2) / count;
      const wideRoot = step * 0.29;
      const wideTip = step * 0.17;
      const at = (radius, angle) => [body.x + Math.cos(angle) * radius, body.y + Math.sin(angle) * radius];

      context.beginPath();
      for (let index = 0; index < count; index += 1) {
        const base = body.angle + index * step;
        if (index === 0) context.moveTo(...at(root, base - wideRoot));
        else context.arc(body.x, body.y, root, base - step + wideRoot, base - wideRoot);
        context.lineTo(...at(pitch, base - wideRoot * 0.82));
        context.lineTo(...at(tip, base - wideTip));
        context.arc(body.x, body.y, tip, base - wideTip, base + wideTip);
        context.lineTo(...at(pitch, base + wideRoot * 0.82));
        context.lineTo(...at(root, base + wideRoot));
      }
      context.arc(body.x, body.y, root, body.angle + (count - 1) * step + wideRoot, body.angle + Math.PI * 2 - wideRoot);
      context.closePath();
      context.fill();
      context.stroke();

      const hub = Math.max(0.06, tip * 0.16);
      context.beginPath();
      context.arc(body.x, body.y, hub, 0, Math.PI * 2);
      context.fillStyle = paint.card;
      context.fill();
      context.stroke();

      if (root > tip * 0.5 && count >= 10) {
        const holes = 5;
        const ring = (root * 0.62 + hub * 1.4) / 2 + root * 0.12;
        for (let index = 0; index < holes; index += 1) {
          const angle = body.angle + (index / holes) * Math.PI * 2;
          context.beginPath();
          context.arc(body.x + Math.cos(angle) * ring, body.y + Math.sin(angle) * ring, root * 0.17, 0, Math.PI * 2);
          context.strokeStyle = paint.soft;
          context.stroke();
        }
      }

      context.beginPath();
      context.moveTo(body.x, body.y);
      context.lineTo(...at(hub, body.angle));
      context.strokeStyle = paint.soft;
      context.stroke();
      context.restore();
      return;
    }

    if (body.kind === 'circle') {
      context.beginPath();
      context.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(body.x, body.y);
      context.lineTo(body.x + Math.cos(body.angle) * body.radius, body.y + Math.sin(body.angle) * body.radius);
      context.strokeStyle = paint.soft;
      context.stroke();
      context.restore();
      return;
    }

    const corners = bodyCorners(body);
    context.beginPath();
    corners.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
    context.closePath();
    if (body.ghost) context.fillStyle = `color-mix(in srgb, ${paint.soft} 55%, ${paint.card})`;
    context.fill();
    context.stroke();

    if (held) {
      context.save();
      context.clip();
      context.strokeStyle = `color-mix(in srgb, ${paint.soft} 50%, transparent)`;
      context.lineWidth = 1 / (SCALE * this.#zoom);
      const reach = Math.hypot(body.width, body.height);
      for (let offset = -reach; offset < reach; offset += 0.22) {
        context.beginPath();
        context.moveTo(body.x + offset, body.y - reach / 2);
        context.lineTo(body.x + offset + reach / 2, body.y + reach / 2);
        context.stroke();
      }
      context.restore();
    }
    context.restore();
  }

  #drawJoint(context, joint, paint) {
    const a = this.#anchor(joint, 'a');
    const b = this.#anchor(joint, 'b');
    if (!a || !b) return;
    const picked = joint === this.#selectedJoint;
    context.save();
    context.strokeStyle = picked ? paint.ring : paint.line;
    context.lineWidth = (picked ? 2.6 : 1.7) / (SCALE * this.#zoom);
    context.fillStyle = paint.card;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = Math.hypot(dx, dy) || 1e-6;
    const axis = { x: dx / span, y: dy / span };
    const side = { x: -axis.y, y: axis.x };

    if (joint.kind === 'spring') {
      const coils = Math.max(4, Math.round(span * 4));
      const lead = 0.16;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(a.x + axis.x * lead, a.y + axis.y * lead);
      for (let index = 0; index <= coils; index += 1) {
        const along = lead + ((span - lead * 2) * index) / coils;
        const swing = index === 0 || index === coils ? 0 : (index % 2 ? 1 : -1) * 0.11;
        context.lineTo(a.x + axis.x * along + side.x * swing, a.y + axis.y * along + side.y * swing);
      }
      context.lineTo(b.x, b.y);
      context.stroke();
    } else if (joint.kind === 'rope') {
      context.save();
      context.setLineDash([0.1, 0.07]);
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.restore();
    } else if (joint.kind === 'jack') {
      const barrel = span * 0.55;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.beginPath();
      context.rect(a.x + axis.x * 0.1 - side.x * 0.1, a.y + axis.y * 0.1 - side.y * 0.1, 0, 0);
      context.save();
      context.translate(a.x, a.y);
      context.rotate(Math.atan2(dy, dx));
      context.beginPath();
      context.rect(0.08, -0.11, barrel, 0.22);
      context.fill();
      context.stroke();
      context.restore();
    } else if (joint.kind === 'track') {
      context.save();
      context.setLineDash([0.2, 0.12]);
      context.beginPath();
      context.moveTo(a.x - axis.x * 0.6, a.y - axis.y * 0.6);
      context.lineTo(b.x + axis.x * 0.6, b.y + axis.y * 0.6);
      context.stroke();
      context.restore();
      context.beginPath();
      context.rect(b.x - 0.1, b.y - 0.1, 0.2, 0.2);
      context.fill();
      context.stroke();
    } else if (joint.kind === 'weld') {
      context.beginPath();
      context.rect(a.x - 0.11, a.y - 0.11, 0.22, 0.22);
      context.fillStyle = picked ? paint.ring : paint.line;
      context.fill();
    } else if (joint.kind === 'pin' || joint.kind === 'motor') {
      context.beginPath();
      context.arc(a.x, a.y, 0.13, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      if (joint.kind === 'motor') {
        context.beginPath();
        context.arc(a.x, a.y, 0.24, -0.6, 2.2);
        context.stroke();
        const tip = { x: a.x + Math.cos(2.2) * 0.24, y: a.y + Math.sin(2.2) * 0.24 };
        context.beginPath();
        context.moveTo(tip.x, tip.y);
        context.lineTo(tip.x - 0.09, tip.y - 0.02);
        context.lineTo(tip.x + 0.01, tip.y + 0.09);
        context.closePath();
        context.fillStyle = picked ? paint.ring : paint.line;
        context.fill();
      }
    } else {
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }

    [a, b].forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 0.07, 0, Math.PI * 2);
      context.fillStyle = picked ? paint.ring : paint.soft;
      context.fill();
    });

    const knob = this.#knob(joint);
    if (knob) {
      const low = joint.min ?? 0.5;
      const high = joint.max ?? 3;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      context.save();
      context.strokeStyle = paint.soft;
      context.lineWidth = 1.4 / (SCALE * this.#zoom);
      context.beginPath();
      context.moveTo(mid.x + side.x * 0.34 - axis.x * 0.34, mid.y + side.y * 0.34 - axis.y * 0.34);
      context.lineTo(mid.x + side.x * 0.34 + axis.x * 0.34, mid.y + side.y * 0.34 + axis.y * 0.34);
      context.stroke();
      const along = ((joint.rest - low) / (high - low || 1) - 0.5) * 0.68;
      context.beginPath();
      context.arc(mid.x + side.x * 0.34 + axis.x * along, mid.y + side.y * 0.34 + axis.y * along, 0.14, 0, Math.PI * 2);
      context.fillStyle = paint.ring;
      context.fill();
      context.restore();
    }

    context.restore();
  }

  #drawControl(context, control, paint) {
    if (control.kind === 'slider') return this.#drawSlider(context, control, paint);
    const button = control;
    this.#drawHandle(context, button, paint);
    const box = this.#controlBox(button);
    const down = this.#held.has(button.id);
    const picked = button === this.#selectedControl;
    const bound = this.#joints.some((joint) => joint.id === button.target);

    context.save();
    context.beginPath();
    context.roundRect(box.left, box.top, BUTTON_WIDTH, BUTTON_HEIGHT, 0.14);
    context.fillStyle = down
      ? paint.ring
      : bound
        ? `color-mix(in srgb, ${paint.ring} 16%, ${paint.card})`
        : `color-mix(in srgb, ${paint.soft} 22%, ${paint.card})`;
    context.fill();
    context.strokeStyle = picked ? paint.ring : bound ? `color-mix(in srgb, ${paint.ring} 60%, transparent)` : paint.soft;
    context.lineWidth = (picked ? 2.6 : 1.7) / (SCALE * this.#zoom);
    context.stroke();

    context.fillStyle = down ? paint.card : paint.line;
    context.font = `600 ${0.24}px ${paint.font}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this.#controlName(button), button.x, button.y);
    context.restore();
  }

  #drawTurnGrip(context, paint) {
    if (this.#selected == null || this.#running) return;
    const body = this.#world.body(this.#selected);
    const grip = this.#turnGrip(body);
    if (!grip) return;

    const line = 1.6 / (SCALE * this.#zoom);
    context.save();
    context.strokeStyle = `color-mix(in srgb, ${paint.ring} 70%, transparent)`;
    context.lineWidth = line;
    context.beginPath();
    context.moveTo(grip.from.x, grip.from.y);
    context.lineTo(grip.x, grip.y);
    context.stroke();

    context.beginPath();
    context.arc(grip.x, grip.y, grip.radius, 0, Math.PI * 2);
    context.fillStyle = paint.card;
    context.fill();
    context.strokeStyle = paint.ring;
    context.lineWidth = line * 1.5;
    context.stroke();
    context.restore();
  }

  #drawHandle(context, control, paint) {
    const box = this.#handleBox(control);
    const picked = control === this.#selectedControl;
    const inset = 0.05;

    context.save();
    context.beginPath();
    context.roundRect(box.left + inset, box.top, box.width - inset * 2, box.height - 0.04, 0.1);
    context.fillStyle = picked ? `color-mix(in srgb, ${paint.ring} 55%, transparent)` : `color-mix(in srgb, ${paint.soft} 40%, ${paint.card})`;
    context.fill();

    const dots = 3;
    const gap = 0.11;
    const middle = box.top + (box.height - 0.04) / 2;
    context.fillStyle = picked ? paint.card : paint.soft;
    for (let index = 0; index < dots; index += 1) {
      context.beginPath();
      context.arc(control.x + (index - (dots - 1) / 2) * gap, middle, 0.032, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  #drawSlider(context, control, paint) {
    this.#drawHandle(context, control, paint);
    const box = this.#controlBox(control);
    const picked = control === this.#selectedControl;
    const bound = this.#joints.some((joint) => joint.id === control.target);
    const value = control.value ?? 0.5;
    const travel = box.height - SLIDER_GRIP;
    const middle = box.top + SLIDER_GRIP / 2 + (1 - value) * travel;

    context.save();
    context.beginPath();
    context.roundRect(box.left, box.top, box.width, box.height, 0.16);
    context.fillStyle = `color-mix(in srgb, ${paint.soft} 18%, ${paint.card})`;
    context.fill();
    context.strokeStyle = picked ? paint.ring : bound ? `color-mix(in srgb, ${paint.ring} 55%, transparent)` : paint.soft;
    context.lineWidth = (picked ? 2.6 : 1.7) / (SCALE * this.#zoom);
    context.stroke();

    context.save();
    context.beginPath();
    context.roundRect(box.left, box.top, box.width, box.height, 0.16);
    context.clip();
    context.fillStyle = `color-mix(in srgb, ${paint.ring} 30%, transparent)`;
    context.fillRect(box.left, middle, box.width, box.bottom - middle);
    context.restore();

    context.beginPath();
    context.roundRect(box.left + 0.06, middle - SLIDER_GRIP / 2, box.width - 0.12, SLIDER_GRIP, 0.1);
    context.fillStyle = paint.ring;
    context.fill();

    context.fillStyle = paint.soft;
    context.font = `600 0.22px ${paint.font}`;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText(this.#controlName(control), control.x, box.bottom + 0.12);
    context.restore();
  }

  #drawGhost(context, paint) {
    const from = this.#drag.from;
    const to = this.#cursor;
    context.save();
    context.setLineDash([0.12, 0.09]);
    context.strokeStyle = paint.ring;
    context.beginPath();
    if (this.#drag.shape === 'circle') {
      const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      context.arc(middle.x, middle.y, Math.max(0.05, Math.hypot(to.x - from.x, to.y - from.y) / 2), 0, Math.PI * 2);
    } else {
      context.rect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    }
    context.stroke();
    context.restore();
  }

  #drawVectors(context, paint) {
    context.save();
    context.strokeStyle = paint.live;
    context.fillStyle = paint.live;
    context.lineWidth = 2 / (SCALE * this.#zoom);
    this.#world.bodies.forEach((body) => {
      const speed = Math.hypot(body.vx, body.vy);
      if (speed < 0.05) return;
      const scale = 0.22;
      const tipX = body.x + body.vx * scale;
      const tipY = body.y + body.vy * scale;
      context.beginPath();
      context.moveTo(body.x, body.y);
      context.lineTo(tipX, tipY);
      context.stroke();
      const angle = Math.atan2(body.vy, body.vx);
      context.beginPath();
      context.moveTo(tipX, tipY);
      context.lineTo(tipX - Math.cos(angle - 0.4) * 0.14, tipY - Math.sin(angle - 0.4) * 0.14);
      context.lineTo(tipX - Math.cos(angle + 0.4) * 0.14, tipY - Math.sin(angle + 0.4) * 0.14);
      context.closePath();
      context.fill();
    });
    context.restore();
  }
}

define('jg-app-physics-lab', PhysicsLab);
