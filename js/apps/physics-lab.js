import { JGApp, define, html, css } from '../core/app.js';
import { createWorld, bodyCorners, worldPoint, localPoint, spanOf, hull, polyMass, simpleLoop } from '../lib/physics.js';
import { createDesigns } from '../lib/designs.js';
import { clipPolygons, polygonArea } from '../lib/clip.js';
import { shapesFromSvg } from '../lib/svg-shapes.js';
import { icon } from '../ui/icons.js';
import { toast, pickFile } from '../core/util.js';

const sheet = css`
  .app { padding: 0; gap: 0; container-type: inline-size; overflow: hidden; }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex: none;
  }

  .body { flex: 1; min-height: 0; display: flex; }

  .palette {
    width: 152px;
    flex: none;
    border-right: 1px solid var(--border);
    padding: 8px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 3px;
    --icon-accent: currentColor;
  }
  .palette .group {
    padding: 9px 6px 3px;
    font: 600 10px/1 var(--font-sans);
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted-foreground);
  }
  .tool {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 9px;
    white-space: nowrap;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--muted-foreground);
    font: 500 12px/1 var(--font-sans);
    text-align: left;
    cursor: pointer;
  }
  .tool:hover { background: var(--accent); color: var(--foreground); }
  .tool[aria-pressed="true"] {
    background: color-mix(in srgb, var(--ring) 16%, var(--card));
    border-color: color-mix(in srgb, var(--ring) 55%, transparent);
    color: var(--foreground);
    font-weight: 600;
  }

  .board { position: relative; flex: 1; min-width: 0; background: var(--muted); }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: default; }
  canvas[data-tool="place"] { cursor: crosshair; }
  canvas[data-grab="true"] { cursor: grab; }

  .hint-bar {
    position: absolute;
    left: 12px;
    bottom: 10px;
    right: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    color: var(--muted-foreground);
    pointer-events: none;
  }
  .hint-bar b {
    font: 600 11px/1 var(--font-sans);
    color: var(--foreground);
    padding: 3px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ring) 18%, var(--card));
    border: 1px solid color-mix(in srgb, var(--ring) 45%, transparent);
  }
  .readout {
    position: absolute;
    right: 12px;
    top: 10px;
    display: flex;
    gap: 10px;
    font: 500 11px/1 var(--font-mono);
    color: var(--muted-foreground);
    pointer-events: none;
  }

  .side {
    width: 248px;
    flex: none;
    border-left: 1px solid var(--border);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
  }
  .samples { display: flex; flex-wrap: wrap; gap: 6px; }
  .samples button {
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    border-radius: 999px;
    padding: 4px 10px;
    font: 500 11.5px/1 var(--font-sans);
    cursor: pointer;
  }
  .samples button:hover { border-color: var(--ring); }
  .saved { display: flex; flex-direction: column; gap: 5px; }
  .saved .row { display: flex; align-items: center; gap: 6px; }
  .saved .row button:first-child {
    flex: 1;
    text-align: left;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--foreground);
    border-radius: var(--radius-sm);
    padding: 5px 9px;
    font: 500 11.5px/1.3 var(--font-sans);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .saved .row button:first-child:hover { border-color: var(--ring); }
  .saved .row button[data-open="true"] { border-color: var(--ring); background: color-mix(in srgb, var(--ring) 14%, var(--card)); }
  .saved .row .drop {
    flex: none;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 4px;
    line-height: 0;
    border-radius: var(--radius-sm);
  }
  .saved .row .drop:hover { background: var(--accent); color: var(--foreground); }
  .save-row { display: flex; gap: 6px; align-items: center; }
  .save-row jg-input { flex: 1; }

  @container (max-width: 820px) {
    .body { flex-direction: column; }
    .palette { width: auto; flex-direction: row; flex-wrap: wrap; border-right: 0; border-bottom: 1px solid var(--border); }
    .palette .group { width: 100%; }
    .side { width: auto; border-left: 0; border-top: 1px solid var(--border); max-height: 220px; }
  }
`;

const SCALE = 42;

const SHAPES = {
  circle: { label: 'Ball', icon: 'circle' },
  box: { label: 'Block', icon: 'square' },
  wall: { label: 'Wall', icon: 'frame' },
  shape: { label: 'Shape', icon: 'vector' },
  gear: { label: 'Gear', icon: 'gearWheel' },
};

const LINKS = {
  spring: { label: 'Spring', icon: 'coil' },
  rod: { label: 'Rod', icon: 'line' },
  rope: { label: 'Rope', icon: 'link' },
  jack: { label: 'Jack', icon: 'piston' },
  pin: { label: 'Pin', icon: 'hinge' },
  motor: { label: 'Motor', icon: 'motorised' },
  mesh: { label: 'Mesh gears', icon: 'gearPair' },
  linkage: { label: 'Linkage', icon: 'ruler' },
  track: { label: 'Track', icon: 'rail' },
  weld: { label: 'Weld', icon: 'weldSeam' },
};

const CONTROLS = {
  button: { label: 'Button', icon: 'toggle' },
  slider: { label: 'Slider', icon: 'tuning' },
};

const SCENERY = {
  backdrop: { label: 'Backdrop', icon: 'image' },
};

const BUTTON_WIDTH = 1.5;
const BUTTON_HEIGHT = 0.62;
const SLIDER_WIDTH = 0.8;
const SLIDER_HEIGHT = 3.2;
const SLIDER_GRIP = 0.5;

const SAMPLES = {
  pendulum: {
    name: 'Pendulum',
    gravity: 9.81,
    bodies: [
      { id: 1, kind: 'box', x: 0, y: 5.6, width: 16, height: 0.6, pinned: true, friction: 0.6 },
      { id: 2, kind: 'circle', x: -0.4, y: -2.6, radius: 0.22, pinned: true },
      { id: 3, kind: 'circle', x: 2.2, y: -2.2, radius: 0.42, density: 3, restitution: 0.3 },
      { id: 4, kind: 'circle', x: -2.6, y: -2.6, radius: 0.22, pinned: true },
      { id: 5, kind: 'circle', x: -2.6, y: 0.4, radius: 0.34, density: 2, restitution: 0.5 },
    ],
    joints: [
      { kind: 'rod', a: 2, b: 3, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, rest: 2.64 },
      { kind: 'spring', a: 4, b: 5, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, rest: 2, stiffness: 90, damping: 0.6 },
    ],
  },
  stack: {
    name: 'Stack and ball',
    gravity: 9.81,
    bodies: [
      { id: 1, kind: 'box', x: 0, y: 5.6, width: 18, height: 0.6, pinned: true, friction: 0.7 },
      { id: 2, kind: 'box', x: 1.4, y: 4.85, width: 1.5, height: 0.9, friction: 0.7, restitution: 0 },
      { id: 3, kind: 'box', x: 1.4, y: 3.9, width: 1.5, height: 0.9, friction: 0.7, restitution: 0 },
      { id: 4, kind: 'box', x: 1.4, y: 2.95, width: 1.5, height: 0.9, friction: 0.7, restitution: 0 },
      { id: 5, kind: 'box', x: 1.4, y: 2, width: 1.5, height: 0.9, friction: 0.7, restitution: 0 },
      { id: 6, kind: 'circle', x: -4.6, y: -1.6, radius: 0.24, pinned: true },
      { id: 7, kind: 'circle', x: -4.6, y: 2.6, radius: 0.55, density: 6, restitution: 0.15 },
    ],
    joints: [{ kind: 'rod', a: 6, b: 7, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, rest: 4.2 }],
  },
  ramp: {
    name: 'Ramp',
    gravity: 9.81,
    bodies: [
      { id: 1, kind: 'box', x: 0, y: 5.6, width: 18, height: 0.6, pinned: true, friction: 0.7 },
      { id: 2, kind: 'box', x: -2.4, y: 2.4, width: 9, height: 0.4, angle: 0.42, pinned: true, friction: 0.35 },
      { id: 3, kind: 'circle', x: -5.4, y: 0.4, radius: 0.42, friction: 0.35, restitution: 0.1 },
      { id: 4, kind: 'box', x: -4.2, y: -0.4, width: 0.9, height: 0.9, friction: 0.5, restitution: 0 },
      { id: 5, kind: 'box', x: 5.4, y: 4.7, width: 0.9, height: 1.2, friction: 0.7, restitution: 0 },
    ],
    joints: [],
  },
  cradle: {
    name: "Newton's cradle",
    gravity: 9.81,
    bodies: [
      { id: 1, kind: 'circle', x: -2.1, y: -3, radius: 0.14, pinned: true },
      { id: 2, kind: 'circle', x: -1.05, y: -3, radius: 0.14, pinned: true },
      { id: 3, kind: 'circle', x: 0, y: -3, radius: 0.14, pinned: true },
      { id: 4, kind: 'circle', x: 1.05, y: -3, radius: 0.14, pinned: true },
      { id: 5, kind: 'circle', x: 2.1, y: -3, radius: 0.14, pinned: true },
      { id: 6, kind: 'circle', x: -5.1, y: -3, radius: 0.52, restitution: 1, friction: 0 },
      { id: 7, kind: 'circle', x: -1.05, y: 0, radius: 0.52, restitution: 1, friction: 0 },
      { id: 8, kind: 'circle', x: 0, y: 0, radius: 0.52, restitution: 1, friction: 0 },
      { id: 9, kind: 'circle', x: 1.05, y: 0, radius: 0.52, restitution: 1, friction: 0 },
      { id: 10, kind: 'circle', x: 2.1, y: 0, radius: 0.52, restitution: 1, friction: 0 },
    ],
    joints: [
      { kind: 'rod', a: 1, b: 6, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, rest: 3 },
      { kind: 'rod', a: 2, b: 7, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, rest: 3 },
      { kind: 'rod', a: 3, b: 8, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, rest: 3 },
      { kind: 'rod', a: 4, b: 9, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, rest: 3 },
      { kind: 'rod', a: 5, b: 10, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, rest: 3 },
    ],
  },
  crank: {
    name: 'Crank and piston',
    gravity: 9.81,
    bodies: [
      { id: 1, kind: 'box', x: 0, y: 5.6, width: 20, height: 0.6, pinned: true, friction: 0.8 },
      { id: 2, kind: 'box', x: -2.6, y: 3.8, width: 1.4, height: 3, pinned: true, friction: 0.8 },
      { id: 3, kind: 'circle', x: -2.6, y: 2, radius: 1, density: 2.6, friction: 0.6 },
      { id: 4, kind: 'box', x: 2.4, y: 2, width: 2.8, height: 0.12, pinned: true },
      { id: 5, kind: 'box', x: 2.4, y: 2, width: 0.9, height: 0.8, density: 2, fixedAngle: true, friction: 0.2 },
    ],
    joints: [
      { kind: 'motor', a: 2, b: 3, aWorld: { x: -2.6, y: 2 }, bWorld: { x: -2.6, y: 2 }, speed: 3.2, torque: 160 },
      { kind: 'track', a: 4, b: 5, aWorld: { x: 2.4, y: 2 }, bWorld: { x: 2.4, y: 2 }, axis: { x: 1, y: 0 } },
      { kind: 'rod', a: 3, b: 5, aWorld: { x: -1.9, y: 2 }, bWorld: { x: 2.4, y: 2 }, rest: 4.3 },
    ],
  },
  dominoes: {
    name: 'Domino run',
    gravity: 9.81,
    bodies: [
      { id: 1, kind: 'box', x: 0, y: 5.6, width: 22, height: 0.6, pinned: true, friction: 0.8 },
      { id: 2, kind: 'box', x: -5.6, y: 3.9, width: 4.2, height: 0.25, angle: 0.5, pinned: true, friction: 0.25 },
      { id: 3, kind: 'circle', x: -7.1, y: 2.7, radius: 0.3, density: 4, friction: 0.25, restitution: 0.05 },
      { id: 10, kind: 'box', x: -3, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 11, kind: 'box', x: -2.38, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 12, kind: 'box', x: -1.76, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 13, kind: 'box', x: -1.14, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 14, kind: 'box', x: -0.52, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 15, kind: 'box', x: 0.1, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 16, kind: 'box', x: 0.72, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 17, kind: 'box', x: 1.34, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 18, kind: 'box', x: 1.96, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 19, kind: 'box', x: 2.58, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 20, kind: 'box', x: 3.2, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 21, kind: 'box', x: 3.82, y: 4.7, width: 0.16, height: 1.2, friction: 0.5, restitution: 0 },
      { id: 30, kind: 'box', x: 4.75, y: 4.4, width: 0.5, height: 1.8, density: 0.3, friction: 0.6, restitution: 0 },
    ],
    joints: [],
  },
  excavator: {
    name: 'Excavator arm',
    gravity: 9.81,
    bodies: [
      { id: 1, kind: 'box', x: 0, y: 6.1, width: 30, height: 0.8, pinned: true, friction: 0.9 },
      { id: 2, kind: 'poly', x: -4.9, y: 4.963, angle: 0, pinned: true, friction: 0.9, points: [{ x: -2.3, y: -0.363 }, { x: 2.3, y: -0.363 }, { x: 1.9, y: 0.387 }, { x: -1.9, y: 0.387 }] },
      { id: 3, kind: 'poly', x: -5.1, y: 3.8, angle: 0, pinned: true, friction: 0.8, points: [{ x: -1.8, y: -0.8 }, { x: 1.8, y: -0.8 }, { x: 1.8, y: 0.8 }, { x: -1.8, y: 0.8 } ] },
      { id: 4, kind: 'poly', x: -5.723, y: 2.271, angle: 0, pinned: true, friction: 0.8, points: [{ x: -0.877, y: -0.771 }, { x: 0.723, y: -0.771 }, { x: 1.023, y: 0.729 }, { x: -0.877, y: 0.729 }] },
      { id: 5, kind: 'poly', x: -1.919, y: 1.683, angle: 0, density: 1, friction: 0.6, points: [{ x: -2.155, y: 1.397 }, { x: 1.988, y: -1.988 }, { x: 2.298, y: -1.62 }, { x: -1.743, y: 1.887 }] },
      { id: 6, kind: 'poly', x: 0.895, y: 1.097, angle: 0, density: 0.9, friction: 0.6, points: [{ x: -0.936, y: -1.46 }, { x: 1.413, y: 1.335 }, { x: 1.143, y: 1.573 }, { x: -1.326, y: -1.116 }] },
      { id: 7, kind: 'poly', x: 1.736, y: 2.799, angle: 0, density: 1.1, friction: 0.95, points: [{ x: 0.643, y: -0.285 }, { x: 0.419, y: 0.127 }, { x: -0.285, y: 0.485 }, { x: -0.747, y: 0.127 }, { x: -0.48, y: -0.172 }, { x: -0.182, y: 0.039 }, { x: 0.212, y: -0.331 }, { x: 0.153, y: -0.699 }] },
      { id: 8, kind: 'box', x: 5.4, y: 5.3, width: 0.8, height: 0.8, friction: 0.8, restitution: 0 },
      { id: 9, kind: 'box', x: 6.4, y: 5.3, width: 0.8, height: 0.8, friction: 0.8, restitution: 0 },
      { id: 10, kind: 'circle', x: 7.4, y: 5.35, radius: 0.35, friction: 0.7, restitution: 0.1 },
    ],
    joints: [
      { id: 20, kind: 'pin', a: 3, b: 5, aWorld: { x: -3.6, y: 3.1 }, bWorld: { x: -3.6, y: 3.1 } },
      { id: 21, kind: 'pin', a: 5, b: 6, aWorld: { x: -0.005, y: 0.072 }, bWorld: { x: -0.005, y: 0.072 } },
      { id: 22, kind: 'pin', a: 6, b: 7, aWorld: { x: 1.975, y: 2.326 }, bWorld: { x: 1.975, y: 2.326 } },
      { id: 23, kind: 'jack', a: 3, b: 5, aWorld: { x: -5.4, y: 1.6 }, bWorld: { x: -2.702, y: 0.906 }, manual: true, extend: 0.5, rest: 2.786, min: 2.4, max: 3.18 },
      { id: 24, kind: 'jack', a: 5, b: 6, aWorld: { x: -1.386, y: 0.451 }, bWorld: { x: 1.342, y: 1.151 }, manual: true, extend: 0.5, rest: 2.816, min: 2.42, max: 3.21 },
      { id: 25, kind: 'jack', a: 6, b: 7, aWorld: { x: 2.03, y: 1.479 }, bWorld: { x: 2.512, y: 3.348 }, manual: true, extend: 0.5, rest: 1.93, min: 1.66, max: 2.2 },
    ],
    controls: [
      { id: 30, kind: 'slider', x: -10.6, y: -1.4, target: 23, value: 0.5, label: 'Boom' },
      { id: 31, kind: 'slider', x: -9.3, y: -1.4, target: 24, value: 0.5, label: 'Stick' },
      { id: 32, kind: 'slider', x: -8, y: -1.4, target: 25, value: 0.5, label: 'Bucket' },
    ],
  },
  fourbar: {
    name: 'Four bar linkage',
    gravity: 9.81,
    bodies: [
      { id: 1, kind: 'box', x: 0, y: 5.6, width: 20, height: 0.6, pinned: true, friction: 0.8 },
      { id: 2, kind: 'circle', x: -2.5, y: 2, radius: 0.2, pinned: true },
      { id: 3, kind: 'circle', x: 2.5, y: 2, radius: 0.2, pinned: true },
      { id: 4, kind: 'box', x: -1.9, y: 2, width: 1.2, height: 0.22, angle: 0, density: 1.2, ghost: true },
      { id: 5, kind: 'box', x: 0.492, y: 0.905, width: 4.2, height: 0.22, angle: -0.548, density: 1.2, ghost: true },
      { id: 6, kind: 'box', x: 2.392, y: 0.905, width: 2.2, height: 0.22, angle: -1.669, density: 1.2, ghost: true },
    ],
    joints: [
      { id: 20, kind: 'motor', a: 2, b: 4, aWorld: { x: -2.5, y: 2 }, bWorld: { x: -2.5, y: 2 }, speed: 2.2, torque: 220 },
      { id: 21, kind: 'pin', a: 4, b: 5, aWorld: { x: -1.3, y: 2 }, bWorld: { x: -1.3, y: 2 } },
      { id: 22, kind: 'pin', a: 5, b: 6, aWorld: { x: 2.284, y: -0.189 }, bWorld: { x: 2.284, y: -0.189 } },
      { id: 23, kind: 'pin', a: 3, b: 6, aWorld: { x: 2.5, y: 2 }, bWorld: { x: 2.5, y: 2 } },
    ],
    controls: [
      { id: 30, kind: 'slider', x: -5.4, y: -1.2, target: 20, value: 0.78, label: 'Motor' },
      { id: 31, kind: 'button', x: -3.4, y: -2.2, target: 20, action: 'run', label: 'Turn' },
      { id: 32, kind: 'button', x: -3.4, y: -1.4, target: 20, action: 'reverse', label: 'Reverse' },
    ],
  },
  gears: {
    name: 'Gear train',
    gravity: 0,
    bodies: [
      { id: 1, kind: 'circle', x: -3.2, y: 0, radius: 0.12, pinned: true },
      { id: 2, kind: 'circle', x: -3.2, y: 0, radius: 1.2, density: 1, teeth: 17, friction: 0.7 },
      { id: 3, kind: 'circle', x: -0.4, y: 0, radius: 0.12, pinned: true },
      { id: 4, kind: 'circle', x: -0.4, y: 0, radius: 1.6, density: 1, teeth: 22, friction: 0.7 },
      { id: 5, kind: 'circle', x: 2.2, y: 0, radius: 0.12, pinned: true },
      { id: 6, kind: 'circle', x: 2.2, y: 0, radius: 1, density: 1, teeth: 14, friction: 0.7 },
    ],
    joints: [
      { id: 20, kind: 'pin', a: 1, b: 2, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 } },
      { id: 21, kind: 'pin', a: 3, b: 4, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 } },
      { id: 22, kind: 'pin', a: 5, b: 6, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 } },
      { id: 23, kind: 'motor', a: 1, b: 2, aAt: { x: 0, y: 0 }, bAt: { x: 0, y: 0 }, speed: 1.6, torque: 300 },
      { id: 24, kind: 'gear', a: 2, b: 4, ratio: 1.3333 },
      { id: 25, kind: 'gear', a: 4, b: 6, ratio: 0.625 },
    ],
    controls: [
      { id: 30, kind: 'slider', x: -6, y: 0, target: 23, value: 0.75, label: 'Drive' },
    ],
  },
  orbits: {
    name: 'Three bodies',
    gravity: 0,
    damping: 0,
    attraction: 16,
    bodies: [
      { id: 1, kind: 'circle', x: 2.91, y: -0.7293, radius: 0.16, density: 12.434, vx: 1.0767, vy: 0.9985, restitution: 1 },
      { id: 2, kind: 'circle', x: -2.91, y: 0.7293, radius: 0.16, density: 12.434, vx: 1.0767, vy: 0.9985, restitution: 1 },
      { id: 3, kind: 'circle', x: 0, y: 0, radius: 0.16, density: 12.434, vx: -2.1533, vy: -1.997, restitution: 1 },
    ],
    joints: [],
  },
};

export default class PhysicsLab extends JGApp {
  static appId = 'physics-lab';
  static styles = [sheet];
  static settings = [
    { key: 'vectors', label: 'Show velocity arrows', type: 'switch', value: false },
    { key: 'trails', label: 'Trace the selected body', type: 'switch', value: true },
    { key: 'accuracy', label: 'Solver passes per frame', type: 'number', value: 8, min: 3, max: 20 },
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
    } else {
      this.#load(SAMPLES[open] ? open : 'pendulum');
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
        <div class="label">Physics Lab</div>
        <div class="hint">Balls, blocks, springs, rods and motors with a real solver.</div>
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
          <div class="hint-bar"><b id="tool-name">Select</b><span id="tool-hint"></span></div>
        </div>
        <aside class="side">
          <div class="label">Scenes</div>
          <div class="samples">
            ${Object.entries(SAMPLES).map(([key, sample]) => html`<button data-sample="${key}">${sample.name}</button>`)}
          </div>
          <div class="sep"></div>
          <jg-field label="Gravity">
            <jg-input id="gravity" size="sm" type="number" step="0.5" min="-20" max="30" value="${this.#gravity}"></jg-input>
          </jg-field>
          <jg-field label="Mutual gravity">
            <jg-input id="attraction" size="sm" type="number" step="0.1" min="0" max="20" value="${this.#attraction}"></jg-input>
          </jg-field>
          <div class="sep"></div>
          <div class="label">Saved</div>
          <div class="save-row">
            <jg-input id="save-name" size="sm" placeholder="Name this scene"></jg-input>
            <jg-button size="sm" variant="outline" id="save">Save</jg-button>
          </div>
          <div class="saved" id="saved"></div>
          <div class="sep"></div>
          <div id="inspector"></div>
        </aside>
      </div>
    </div>`);

    this.#toolbar();

    this.$('#palette').innerHTML = html`
      <div class="group">Edit</div>
      ${[
        { id: 'select', label: 'Select', icon: 'launcher' },
        { id: 'erase', label: 'Erase', icon: 'eraser' },
      ].map(
        (tool) => html`<button class="tool" data-tool="${tool.id}" aria-pressed="${String(this.#tool === tool.id)}">
          ${icon(tool.icon, 15)}<span>${tool.label}</span>
        </button>`,
      )}
      <div class="group">Bodies</div>
      ${Object.entries(SHAPES).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>${meta.label}</span>
        </button>`,
      )}
      <div class="group">Links</div>
      ${Object.entries(LINKS).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>${meta.label}</span>
        </button>`,
      )}
      <div class="group">Controls</div>
      ${Object.entries(CONTROLS).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>${meta.label}</span>
        </button>`,
      )}
      <div class="group">Scene</div>
      <button class="tool" id="svg-in">${icon('vector', 15)}<span>Load SVG</span></button>
      <button class="tool" id="backdrop-in">${icon('image', 15)}<span>Backdrop</span></button>
      ${Object.entries(SCENERY).map(
        ([kind, meta]) => html`<button class="tool" data-tool="${kind}" aria-pressed="${String(this.#tool === kind)}">
          ${icon(meta.icon, 15)}<span>Move ${meta.label.toLowerCase()}</span>
        </button>`,
      )}
    `;

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
      { id: 'step', label: 'Step', icon: 'stepOver', iconOnly: true, title: 'Advance one frame', action: () => this.#stepOnce() },
      { id: 'reset', label: 'Reset', icon: 'repeat', tone: 'stop', action: () => this.#rewind() },
      { separator: true },
      { id: 'new', label: 'New', icon: 'file', iconOnly: true, title: 'Start an empty scene', action: () => this.#blank() },
      { id: 'undo', label: 'Undo', icon: 'undo', iconOnly: true, title: 'Undo', action: () => this.#undo() },
      { id: 'zoom-out', label: 'Zoom out', icon: 'minus', iconOnly: true, title: 'Zoom out', action: () => this.#step(1 / 1.25) },
      { id: 'zoom-fit', label: 'Fit', icon: 'maximize', iconOnly: true, title: 'Fit the scene', action: () => { this.#touched = false; this.#fit(); } },
      { id: 'zoom-in', label: 'Zoom in', icon: 'plus', iconOnly: true, title: 'Zoom in', action: () => this.#step(1.25) },
      { id: 'turn', label: 'Rotate', icon: 'rotate', iconOnly: true, title: 'Turn the selected body (R, shift R the other way)', action: () => this.#turn(Math.PI / 12) },
      { id: 'union', label: 'Merge', icon: 'union', iconOnly: true, title: 'Merge the two selected shapes', action: () => this.#combine('union') },
      { id: 'subtract', label: 'Subtract', icon: 'subtract', iconOnly: true, title: 'Cut the second shape out of the first', action: () => this.#combine('subtract') },
      { id: 'intersect', label: 'Overlap', icon: 'intersect', iconOnly: true, title: 'Keep only where the two shapes overlap', action: () => this.#combine('intersect') },
      { id: 'front', label: 'Bring to front', icon: 'toFront', iconOnly: true, title: 'Bring the selected body to the front', action: () => this.#lift(true) },
      { id: 'back', label: 'Send to back', icon: 'toBack', iconOnly: true, title: 'Send the selected body to the back', action: () => this.#lift(false) },
      { id: 'delete', label: 'Delete', icon: 'eraser', iconOnly: true, title: 'Delete the selection', action: () => this.#remove() },
      { spacer: true },
      { id: 'import', label: 'Open file', icon: 'upload', iconOnly: true, title: 'Open a scene from a file', action: () => this.#importFile() },
      { id: 'export', label: 'Save file', icon: 'download', iconOnly: true, title: 'Save this scene to a file', action: () => this.#exportFile() },
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
    const point = this.#point(event);
    this.$('#view').setPointerCapture(event.pointerId);

    if (this.#tool === 'backdrop') {
      if (!this.#backdrop) {
        toast('Load a backdrop first.', 'danger');
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
      const widget = this.#widgetAt(point);
      if (widget) {
        this.#selectedControl = widget;
        this.#selected = null;
        this.#selectedJoint = null;
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
      const found = this.#world.allAt(point.x, point.y);
      if (!found.length) return;
      this.#snapshot();
      const top = found[0];
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
      const body = this.#world.at(point.x, point.y);
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
      const body = this.#world.at(point.x, point.y);
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
        this.#drag = { kind: 'move', body: source, from: point, origin: { x: source.x, y: source.y } };
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
    this.#hover = this.#tool === 'select' && !this.#drag ? this.#world.at(point.x, point.y) : null;
    this.$('#view').dataset.grab = String(Boolean(this.#hover));

    if (this.#drag?.kind === 'backdrop' && this.#backdrop) {
      this.#backdrop.x = this.#drag.origin.x + (point.x - this.#drag.from.x);
      this.#backdrop.y = this.#drag.origin.y + (point.y - this.#drag.from.y);
      return;
    }

    if (this.#drag?.kind === 'widget') {
      const widget = this.#drag.widget;
      if (widget.kind === 'slider') {
        widget.value = this.#sliderValue(widget, point);
        return;
      }
      const moved = Math.hypot(point.x - this.#drag.from.x, point.y - this.#drag.from.y);
      if (moved > 0.25) {
        if (this.#held.size) {
          this.#release();
          this.#snapshot();
        }
        widget.x = Math.round((this.#drag.origin.x + (point.x - this.#drag.from.x)) * 2) / 2;
        widget.y = Math.round((this.#drag.origin.y + (point.y - this.#drag.from.y)) * 2) / 2;
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
      this.#drag.body.x = this.#drag.origin.x + (point.x - this.#drag.from.x);
      this.#drag.body.y = this.#drag.origin.y + (point.y - this.#drag.from.y);
      const live = this.#world.body(this.#drag.body.id);
      if (live) {
        live.x = this.#drag.body.x;
        live.y = this.#drag.body.y;
        live.vx = 0;
        live.vy = 0;
        live.spin = 0;
      }
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
    const secondId = [...this.#alsoSelected][0];
    const second = this.#bodies.find((body) => body.id === secondId);
    if (!first || !second) {
      toast('Pick one shape, then shift click a second one.', 'danger');
      return;
    }

    const liveA = this.#world.body(first.id);
    const liveB = this.#world.body(second.id);
    if (!liveA || !liveB) return;

    const rings = clipPolygons(this.#outlineOf(liveA), this.#outlineOf(liveB), mode);
    if (!rings) {
      toast('Those shapes do not touch, so there is nothing to merge.', 'danger');
      return;
    }
    const kept = rings.filter((ring) => polygonArea(ring) > 0.01);
    if (!kept.length) {
      toast('That leaves nothing behind.', 'danger');
      return;
    }

    this.#snapshot();
    this.#sync();
    this.#bodies = this.#bodies.filter((body) => body.id !== first.id && body.id !== second.id);
    this.#joints = this.#joints.filter((joint) => ![first.id, second.id].includes(joint.a) && ![first.id, second.id].includes(joint.b));

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
      target.innerHTML = html`<span class="hint">Nothing saved yet. Name a scene above and save it.</span>`;
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
          ? html`<jg-field label="Drives">
                <jg-select id="target" size="sm" value="${String(button.target ?? '')}">
                  ${targets.map((entry) => html`<option value="${entry.id}">${entry.kind} ${entry.id}</option>`)}
                </jg-select>
              </jg-field>
              ${isSlider
                ? html`<div class="hint">${joint?.kind === 'motor' ? 'Middle stops the motor, either side runs it.' : 'Slide to set how far the jack reaches.'}</div>`
                : html`<jg-field label="While held">
                    <jg-select id="action" size="sm" value="${button.action}">
                      ${actions.map(([value, name]) => html`<option value="${value}">${name}</option>`)}
                    </jg-select>
                  </jg-field>`}
              <jg-field label="Label"><jg-input id="label" size="sm" value="${button.label ?? ''}" placeholder="${this.#controlName(button)}"></jg-input></jg-field>`
          : html`<div class="hint">Add a jack or a motor first, then this button can drive it.</div>`}
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
          ? html`<jg-field label="Stiffness"><jg-input id="stiffness" size="sm" type="number" step="5" min="1" value="${joint.stiffness}"></jg-input></jg-field>
              <jg-field label="Damping"><jg-input id="damping" size="sm" type="number" step="0.2" min="0" value="${joint.damping}"></jg-input></jg-field>
              <jg-field label="Rest length"><jg-input id="rest" size="sm" type="number" step="0.1" min="0.1" value="${joint.rest.toFixed(2)}"></jg-input></jg-field>`
          : ''}
        ${joint.kind === 'rod' || joint.kind === 'rope'
          ? html`<jg-field label="Length"><jg-input id="rest" size="sm" type="number" step="0.1" min="0.1" value="${joint.rest.toFixed(2)}"></jg-input></jg-field>`
          : ''}
        ${joint.kind === 'jack'
          ? html`<jg-field label="Shortest"><jg-input id="min" size="sm" type="number" step="0.1" min="0.1" value="${joint.min.toFixed(2)}"></jg-input></jg-field>
              <jg-field label="Longest"><jg-input id="max" size="sm" type="number" step="0.1" min="0.2" value="${joint.max.toFixed(2)}"></jg-input></jg-field>
              <label class="row tight" style="gap:6px">
                <input type="checkbox" id="manual" ${joint.manual ? 'checked' : ''} />
                <span class="hint">Driven by hand</span>
              </label>
              ${joint.manual
                ? html`<jg-field label="Extension"><jg-slider id="extend" min="0" max="100" step="1" value="${Math.round((joint.extend ?? 0.5) * 100)}"></jg-slider></jg-field>`
                : html`<jg-field label="Cycles per second"><jg-input id="speed" size="sm" type="number" step="0.05" min="0.05" value="${joint.speed ?? 0.4}"></jg-input></jg-field>`}`
          : ''}
        ${joint.kind === 'motor'
          ? html`<jg-field label="Speed rad/s"><jg-input id="speed" size="sm" type="number" step="0.2" value="${joint.speed}"></jg-input></jg-field>
              <jg-field label="Max torque"><jg-input id="torque" size="sm" type="number" step="5" min="1" value="${joint.torque}"></jg-input></jg-field>`
          : ''}
        <jg-button size="sm" variant="outline" id="drop">Remove link</jg-button>
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
      bind('stiffness', 'stiffness');
      bind('damping', 'damping');
      bind('rest', 'rest');
      bind('min', 'min');
      bind('max', 'max');
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
        <div class="label">Backdrop</div>
        <jg-field label="Width m"><jg-input id="backWidth" size="sm" type="number" step="0.5" min="0.5" value="${back.width.toFixed(1)}"></jg-input></jg-field>
        <jg-field label="Fade"><jg-slider id="backFade" min="5" max="100" step="5" value="${Math.round((back.opacity ?? 0.6) * 100)}"></jg-slider></jg-field>
        <jg-button size="sm" variant="outline" id="backDrop">Remove backdrop</jg-button>
      `;
      const width = this.$('#backWidth');
      this.on(width, 'change', () => {
        this.#snapshot();
        const ratio = back.height / back.width;
        back.width = Math.max(0.5, Number(width.value) || back.width);
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
      target.innerHTML = html`<div class="hint">Pick a body or a link to change it, or drop a new one from the palette.</div>`;
      return;
    }

    const live = this.#world.body(body.id);
    target.innerHTML = html`
      <div class="label">${body.ghost ? 'Linkage bar' : body.teeth ? 'Gear' : body.kind === 'circle' ? 'Ball' : body.kind === 'poly' ? 'Shape' : body.pinned ? 'Wall' : 'Block'}</div>
      ${body.kind === 'circle' && body.teeth
        ? html`<jg-field label="Radius m"><jg-input id="radius" size="sm" type="number" step="0.05" min="0.2" value="${body.radius}"></jg-input></jg-field>
            <jg-field label="Teeth"><jg-input id="teeth" size="sm" type="number" step="1" min="6" max="72" value="${Math.round(body.teeth)}"></jg-input></jg-field>
            <div class="hint">Meshed wheels turn in the ratio of their teeth.</div>`
        : body.kind === 'circle'
        ? html`<jg-field label="Radius m"><jg-input id="radius" size="sm" type="number" step="0.05" min="0.05" value="${body.radius}"></jg-input></jg-field>`
        : body.kind === 'poly'
          ? html`<div class="hint">${body.points.length} corners</div>`
          : html`<jg-field label="Width m"><jg-input id="width" size="sm" type="number" step="0.1" min="0.1" value="${body.width}"></jg-input></jg-field>
              <jg-field label="Height m"><jg-input id="height" size="sm" type="number" step="0.1" min="0.1" value="${body.height}"></jg-input></jg-field>`}
      ${body.kind === 'circle'
        ? ''
        : html`<jg-field label="Angle degrees"><jg-input id="angle" size="sm" type="number" step="5" value="${Math.round((((body.angle ?? 0) * 180) / Math.PI) * 10) / 10}"></jg-input></jg-field>`}
      <jg-field label="Density"><jg-input id="density" size="sm" type="number" step="0.1" min="0.05" value="${body.density ?? 1}"></jg-input></jg-field>
      <jg-field label="Bounce"><jg-input id="restitution" size="sm" type="number" step="0.05" min="0" max="1" value="${body.restitution ?? 0.2}"></jg-input></jg-field>
      <jg-field label="Friction"><jg-input id="friction" size="sm" type="number" step="0.05" min="0" max="1.5" value="${body.friction ?? 0.35}"></jg-input></jg-field>
      <label class="row tight" style="gap:6px">
        <input type="checkbox" id="pinned" ${body.pinned ? 'checked' : ''} />
        <span class="hint">Held in place</span>
      </label>
      <div class="hint">Mass ${live && live.mass ? `${live.mass.toFixed(2)} kg` : 'fixed'}</div>
      <jg-button size="sm" variant="outline" id="drop">Remove body</jg-button>
    `;

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
        body.radius = Math.max(0.2, Number(radius.value) || body.radius);
        this.#retuneMeshes(body.id);
        this.#reset();
        this.#inspector();
        this.#draw();
      });
    } else {
      bind('radius', 'radius');
    }
    bind('width', 'width');
    bind('height', 'height');
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
      parts.push(`v ${Math.hypot(body.vx, body.vy).toFixed(2)} m/s`);
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

  #drawSlider(context, control, paint) {
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
