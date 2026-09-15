// App icons as drawings on a 100 by 100 canvas.
//
// Every icon sits on the same plate: a squircle with continuous corners, a
// background lit from above, a thin rim of light and a handful of shared
// materials. Ids inside a drawing start with @, so a page showing the same
// icon twice can give each copy ids of its own before it goes into the DOM.

// corner radius 22.4 with 60 percent smoothing, the shape of a home screen icon
export const SQUIRCLE =
  'M64.16 0c12.55 0 18.82 0 23.61 2.44a22.4 22.4 0 0 1 9.79 9.79c2.44 4.79 2.44 11.06 2.44 23.61V64.16c0 12.55 0 18.82-2.44 23.61a22.4 22.4 0 0 1-9.79 9.79c-4.79 2.44-11.06 2.44-23.61 2.44H35.84c-12.55 0-18.82 0-23.61-2.44a22.4 22.4 0 0 1-9.79-9.79C0 82.98 0 76.71 0 64.16V35.84c0-12.55 0-18.82 2.44-23.61a22.4 22.4 0 0 1 9.79-9.79C17.02 0 23.29 0 35.84 0Z';

// ---- colour ------------------------------------------------------------

const channels = (colour) => {
  const hex = colour.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
  return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16));
};

export const mix = (from, to, amount) => {
  const a = channels(from);
  const b = channels(to);
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`;
};

const light = (colour, amount) => mix(colour, '#ffffff', amount);
const deep = (colour, amount) => mix(colour, '#000000', amount);

// ---- paint -------------------------------------------------------------

// stops are colours, or [colour, opacity], or [colour, opacity, offset]
const stops = (list) =>
  list
    .map((stop, index) => {
      const [colour, opacity, offset] = Array.isArray(stop) ? stop : [stop];
      const at = offset ?? (list.length === 1 ? 0 : index / (list.length - 1));
      return `<stop offset="${+at.toFixed(3)}" stop-color="${colour}"${opacity === undefined ? '' : ` stop-opacity="${opacity}"`}/>`;
    })
    .join('');

// a gradient across the shape it paints; x1 y1 x2 y2 run from 0 to 1
const linear = (id, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="@${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;

// a gradient fixed to the canvas, for strokes and for shapes that line up
const across = (id, list, x1, y1, x2, y2) =>
  `<linearGradient id="@${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;

const radial = (id, list, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="@${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;

// a colour lit from above, lighter at the top and deeper at the foot
const lit = (id, colour, up = 0.18, down = 0.14) => linear(id, [light(colour, up), deep(colour, down)]);

// the blurred silhouette of a shape, dropped below it
const shadow = (shape, y = 2.5, opacity = 0.28, blur = 'f') =>
  `<g transform="translate(0 ${y})" opacity="${opacity}" filter="url(#@${blur})" fill="#000" stroke="#000">${shape}</g>`;

// the local AI apps share one light: a soft iridescent sweep and a four point spark
const aurora = (id) => across(id, ['#48c6ff', '#8a6bff', '#ff5fb0', '#ffb347'], 10, 10, 90, 90);
const spark = (x, y, size) => {
  const r = size / 2;
  const k = +(r * 0.18).toFixed(2);
  return `<path d="M${x} ${y - r}C${x + k} ${y - k} ${x + k} ${y - k} ${x + r} ${y}C${x + k} ${y + k} ${x + k} ${y + k} ${x} ${y + r}C${x - k} ${y + k} ${x - k} ${y + k} ${x - r} ${y}C${x - k} ${y - k} ${x - k} ${y - k} ${x} ${y - r}Z"/>`;
};

// a lit sphere with meridians and parallels; needs radial('gs', ...) style paint passed in
const globe = (cx, cy, r, paint) => {
  const lines = [
    `M${cx - r} ${cy}h${2 * r}`,
    `M${cx - r * 0.87} ${cy - r * 0.5}h${1.74 * r}M${cx - r * 0.87} ${cy + r * 0.5}h${1.74 * r}`,
    `M${cx} ${cy - r}v${2 * r}`,
    `M${cx} ${cy - r}a${r * 0.5} ${r} 0 0 0 0 ${2 * r}a${r * 0.5} ${r} 0 0 0 0 ${-2 * r}`,
  ].join('');
  return (
    shadow(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`, 3, 0.3) +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${paint}"/>` +
    `<path d="${lines}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="${+(r / 22).toFixed(2)}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r - 0.5}" fill="none" stroke="url(#@e)" stroke-width="1"/>`
  );
};

// a white die seen a little from above, showing a face of pips
const die = (x, y, size, angle, pips, pip = '#1c1c1e') => {
  const r = size / 2;
  const dots = pips.map(([px, py]) => `<circle cx="${+(px * r * 0.5).toFixed(2)}" cy="${+(py * r * 0.5).toFixed(2)}" r="${+(size * 0.085).toFixed(2)}"/>`).join('');
  return (
    `<g transform="translate(${x} ${y}) rotate(${angle})">` +
    shadow(`<rect x="${-r}" y="${-r}" width="${size}" height="${size}" rx="${size * 0.24}"/>`, size * 0.08, 0.32) +
    `<rect x="${-r}" y="${-r}" width="${size}" height="${size}" rx="${size * 0.24}" fill="url(#@w)"/>` +
    `<rect x="${-r + 0.6}" y="${-r + 0.6}" width="${size - 1.2}" height="${size - 1.2}" rx="${size * 0.22}" fill="none" stroke="#fff" stroke-width="1"/>` +
    `<g fill="${pip}">${dots}</g></g>`
  );
};

// a camera body with a glass lens, centred on cx cy
const camera = (cx, cy, width, body = 'url(#@cb)') => {
  const w = width;
  const h = w * 0.66;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = h * 0.36;
  return (
    shadow(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.14}"/>`, 3, 0.35) +
    `<path d="M${x + w * 0.3} ${y + 1}l${w * 0.06} ${-h * 0.14}h${w * 0.2}l${w * 0.06} ${h * 0.14}Z" fill="#3a3a3c"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.14}" fill="${body}"/>` +
    `<rect x="${x + w * 0.08}" y="${y + h * 0.14}" width="${w * 0.12}" height="${h * 0.12}" rx="${h * 0.04}" fill="#fff" opacity=".85"/>` +
    `<circle cx="${cx}" cy="${cy + h * 0.02}" r="${r + w * 0.05}" fill="#1c1c1e"/>` +
    `<circle cx="${cx}" cy="${cy + h * 0.02}" r="${r}" fill="url(#@cl)"/>` +
    `<circle cx="${cx}" cy="${cy + h * 0.02}" r="${r * 0.45}" fill="#0b1026"/>` +
    `<circle cx="${cx - r * 0.35}" cy="${cy - r * 0.3}" r="${r * 0.18}" fill="#fff" opacity=".7"/>`
  );
};
const cameraPaint = () =>
  linear('cb', ['#e9ecf1', '#aab1bd']) + radial('cl', ['#7aa7ff', '#2a3b8f', '#0b1026'], 0.4, 0.35, 0.7);

// a shipping container seen side on, with ridges
const container = (x, y, width, height, colour) =>
  shadow(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2.5"/>`, 2, 0.3) +
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2.5" fill="${colour}"/>` +
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2.5" fill="url(#@kr)"/>` +
  `<path d="${Array.from({ length: Math.floor((width - 6) / 4) }, (unused, index) => `M${x + 5 + index * 4} ${y + 3}v${height - 6}`).join('')}" stroke="#000" stroke-opacity=".16" stroke-width="1.2"/>` +
  `<rect x="${x + 0.6}" y="${y + 0.6}" width="${width - 1.2}" height="${height - 1.2}" rx="2" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>`;

// a ship's wheel with seven spokes and handles
const helm = (cx, cy, r, paint) => {
  const spokes = Array.from({ length: 7 }, (unused, index) => `<path d="M${cx} ${cy}V${cy - r * 1.28}" transform="rotate(${+((index * 360) / 7).toFixed(2)} ${cx} ${cy})"/>`).join('');
  const knobs = Array.from({ length: 7 }, (unused, index) => {
    const angle = ((index * 360) / 7 - 90) * (Math.PI / 180);
    return `<circle cx="${+(cx + r * 1.3 * Math.cos(angle)).toFixed(2)}" cy="${+(cy + r * 1.3 * Math.sin(angle)).toFixed(2)}" r="${+(r * 0.16).toFixed(2)}"/>`;
  }).join('');
  const shape = `<g fill="none" stroke-width="${r * 0.17}" stroke-linecap="round">${spokes}<circle cx="${cx}" cy="${cy}" r="${r}"/></g>${knobs}<circle cx="${cx}" cy="${cy}" r="${r * 0.3}"/>`;
  return shadow(shape, 2.5, 0.3) + `<g fill="${paint}" stroke="${paint}">${shape}</g><circle cx="${cx}" cy="${cy}" r="${r * 0.12}" fill="#1c1c1e" opacity=".35"/>`;
};

// the neutral colours for paper, ink and rules; in the dark, paper turns to
// graphite and ink to white, as a dark home screen icon does
const tones = (dark) =>
  dark
    ? { paper: '#3d3d42', sheet: ['#4a4a50', '#35353a'], ink: '#f2f2f7', soft: '#a5a5ac', rule: '#5e5e66', faint: '#48484e', rim: 'rgba(255,255,255,.14)' }
    : { paper: '#ffffff', sheet: ['#ffffff', '#eef0f4'], ink: '#1c1c1e', soft: '#8e8e93', rule: '#d1d1d6', faint: '#e5e5ea', rim: 'rgba(0,0,0,.05)' };

// how much colour a colour carries, from grey at 0 to full at 1
const saturation = (colour) => {
  const values = channels(colour);
  const high = Math.max(...values);
  return high ? (high - Math.min(...values)) / high : 0;
};

// the background a drawing sits on; in the dark it keeps a trace of its hue,
// and a near white or grey ground turns to graphite
const ground = (background, dark) => {
  const colours = Array.isArray(background) ? background : [light(background, 0.12), deep(background, 0.16)];
  if (!dark) return colours;
  const [top, bottom] = [colours[0], colours[colours.length - 1]];
  const pale = saturation(top) < 0.22 && saturation(bottom) < 0.3;
  return pale ? ['#2f2f33', '#151517'] : [mix(top, '#141417', 0.62), mix(bottom, '#050506', 0.82)];
};

const plate = (background, dark) => {
  const colours = ground(background, dark);
  const hue = Array.isArray(background) ? background[0] : background;
  return (
    `<clipPath id="@c"><path d="${SQUIRCLE}"/></clipPath>` +
    linear('b', colours) +
    (dark
      ? linear('r', [['#fff', 0.34], ['#fff', 0.06, 0.45], ['#fff', 0.02, 0.7], ['#fff', 0.14]], 0, 0, 0.35, 1) +
        radial('t', [[saturation(hue) < 0.22 ? '#ffffff' : hue, saturation(hue) < 0.22 ? 0.12 : 0.26], [hue, 0]], 0.5, 0.05, 0.85)
      : linear('r', [['#fff', 0.7], ['#fff', 0.1, 0.45], ['#fff', 0.05, 0.7], ['#fff', 0.35]], 0, 0, 0.35, 1) +
        radial('t', [['#fff', 0.2], ['#fff', 0]], 0.5, 0, 0.75)) +
    across('w', ['#ffffff', '#e6e8ee'], 0, 16, 0, 84) +
    linear('q', tones(dark).sheet) +
    linear('e', [['#fff', 0.95], ['#fff', 0.2, 0.55], ['#fff', 0.05]]) +
    `<filter id="@f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.2"/></filter>` +
    `<filter id="@s" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="0.8"/></filter>` +
    `<filter id="@g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>`
  );
};

// ---- lettering ---------------------------------------------------------

// rounded figures drawn as strokes in a 10 by 16 box
export const DIGITS = {
  0: 'M5 0C1.9 0 0 3 0 8s1.9 8 5 8 5-3 5-8-1.9-8-5-8Z',
  1: 'M1.6 3.4 5.8 0v16',
  2: 'M0.4 3.8C1 1.5 2.8 0 5.1 0 7.9 0 9.8 1.9 9.8 4.5c0 1.9-.9 3.3-2.7 5L0.2 16h9.8',
  3: 'M0.8 0.4h8.6L4.6 6.4c3.4-.2 5.4 1.9 5.4 4.7 0 2.9-2.2 4.9-5.1 4.9-2.1 0-3.8-.9-4.7-2.6',
  4: 'M7.2 16V0L0 11.2h10',
  5: 'M9.2 0.4H1.8l-.8 7c1-.8 2.3-1.2 3.8-1.2C7.9 6.2 10 8.3 10 11.1 10 14 7.8 16 4.9 16c-2.1 0-3.8-.9-4.7-2.6',
  6: 'M8.2 1C7.3.3 6.3 0 5.2 0 1.9 0 0 3.3 0 8.8 0 13.4 1.9 16 5 16c2.9 0 5-2.1 5-5s-2-5-4.8-5C2.7 6 .6 7.6.1 9.8',
  7: 'M0 0.4h10L3.4 16',
  8: 'M5 7.3C2.6 7.3 1.1 5.9 1.1 3.7S2.7 0 5 0s3.9 1.5 3.9 3.7S7.4 7.3 5 7.3Zm0 0c-3 0-5 1.8-5 4.3S2 16 5 16s5-1.9 5-4.4-2-4.3-5-4.3Z',
  9: 'M1.8 15C2.7 15.7 3.7 16 4.8 16 8.1 16 10 12.7 10 7.2 10 2.6 8.1 0 5 0 2.1 0 0 2.1 0 5s2 5 4.8 5c2.5 0 4.6-1.6 5.1-3.8',
};

// a number laid out figure by figure, from its top left corner
export const figures = (text, x, y, size = 16, gap = 3) => {
  const scale = size / 16;
  return [...String(text)]
    .map((digit, index) => `<path transform="translate(${+(x + index * (10 + gap) * scale).toFixed(2)} ${y}) scale(${+scale.toFixed(4)})" d="${DIGITS[digit]}"/>`)
    .join('');
};

// the land of the world on a Mercator map between 78° north and 56° south,
// thinned from the Natural Earth outlines the True Size app uses
const WORLD =
  'M71.8 46.8l2.7 .1-3.2 3-1.5-1.8 2-1.3zM52.8 47l1.1 5.1-2.8 1.6-3.9-3.5 2.4-1.3-.3-1.2 3.4-.7zM57.9 63.6l-.2 2.3-3.9-.1 .2-3.8 3.8 1.6zM31.1 70.4l.3 2.7-2.7 1.6-1.1 5.5-1.2-.2 1.6-12.4 4.3 1.1-1.2 1.7zM96.9 64l3.3 4.8-1.1 4.5-2.7 .4-1.2-2.4-.7 1-1.5-1.4-4.8 1.4-.8-4.9 5.9-3.7 2.8 2.2 .8-1.9zM27.2 65.9l0-2.3 1.4-.4 2.6 2.9-3.4 1.6-.6-1.8zM58.3 66l1.3 1.5-2.8 1.7 .1-3.1 1.4-.1zM28.1 59.6l5-1-.4 1.9 5.7 1.4-1.8 5.5-2.6 1.2-1.5 3.2-1.4-1.4 1.3-1.5-1.5-3.5-5.2-2.9 2.3-2.9zM50.3 56.4l-2.1 .2 1.6-1.6 .5 1.4zM52.8 58.5l2-2.8 .5 3.8-2.5-1zM7.4 37.8l-3.6-2.7 0-7.3 1.9 .9 1.8-1.4-1.2 1.3 1.7-1.7 6.8 3.7 .4-2.2 3.3 .6 .1 1.4 .4-5 2.4 4.6 .6-2.4 1.3 .6-.4 2.3-2.9 .5 1.1 1.4-1.8 0 .3 4.8 3.4 1.1 1 2.4 .4-7 1.4-.1 1.6 3 1.5-1.5 2.3 3.5-1 .7 1.5 0-8.8 5.7-1.9-3.1-11.3-.3-2.3-3.8zM21.6 26.4l1.5-2.9 .4 2 1.3-.9 2.8 2.3-.3 1.6 2.6 1.9-.7 1.4-1.7-1 .8 3.2-3.9-1.9 1.9-2.2-1.8-2.7-3.6-.3-.1-2.7 1.3-.8-.4 3zM57.9 57.2l1.1 1.1-3.7 1-.2-1.7 2.8-.4zM57.9 53.5l-.4 2.9-2.4 1.2-.2-5.3 2.8 1.1zM26.9 66.1l1.1 1.7-2.1 11 1.7 1.4-1.5 .5-.9-3.3 1.7-11.2zM26.6 56.1l1.5 3.5-1 1.8-3-1.9 2.5-3.4zM60.1 62.7l-.6 1.8-5.5-2.6 2.3-3.5 2.6-.1 1.3 1-.1 3.4zM62.1 52.6l-3.9 0-.1-3 3.1-.4 .9 3.4zM61.6 58.2l.8-3.1 3.3 2.3-4.1 .8zM57.9 31.1l-1.1-2.8 2.8-.6 .7 5.6-2.8 2.1 .4-4.3zM52.5 42.2l-.3 2.1-2.7 .1-1-2.6 2.3-1.3 1.7 1.7zM54.4 59.3l.2 1.5-1.7-.6 1.4-.9zM53.1 42.3l-1.2-1.8 .9-2.1 2.1 2-1.8 1.9zM40.2 6l1.3 .8-2 .8 3.4 .8-2.7 1.5 2.8 0-.6 2.8 1.2-1.8 2.7 .4-2.9 3-.1 9.5-2.3 .4 1.8 .2-1.5 .2 1.6 2.3-1.8-1.1-.6 1.2 2.2 .4-5.9 3.9-1.3 4.1-2.9-4.1 .9-3.9-1.4-.6 1.2-.3-.9-1.5-.6 .9-1-4.8-3.2-.6-.9-1.4 1.6-.7-2.1-1.3 2.2-1.3-.4-2.3 2.2-3.2 1.2 1.2-.8-1.5 1.5-.8 .3 1.7 1.2-2 1.7 1.7-.2-2.4 1.3 0-1.5-.8 5-1.5zM72.3 52l3.2-4.4 1.6 3 4.8-.2-1.4 2.2-1.5-1.6 .2 1.8-3.8 4.6-1.4-4.7-1.6-.7zM85.9 59.4l2.6-.7-.9 2.7-1.7-2zM96.2 60.9l0 2.1-3.3-2.5 3.2 .4zM67.7 46.8l2.4 .3 0 4.4-4.2-1.8-1.4-3.1 3.2 .3zM63.9 46.9l2 2.8-3.1-.8 1.1-2zM52.3 43l2.2-.2 1.5 3-.8 .8-2.9-3.5zM47.4 56.7l1.7 .2 0 1.4-1.6 .3-.1-1.9zM73.3 44.7l-4.1-1.5-2 1.7 .2-2.2-1.5 0-.3-1.9 4.4-.1 .1-1.8 2.5-.8 5.8 3.1-2.1 3.5-3.1 0zM61.1 60.4l.5-2.2 2.1 .5-.1 1.9-.7 1-1.8-1.2zM53.1 49.6l.7-1.1 4.4 .5 0 4.3-4.8-1.6-.3-2.1zM66.2 64.1l-1.8 4.4 .2-3.1 1.6-1.3zM46.3 55.9l1.9-1-.4-3.3 3.5 3.2-3.3 1.9-1.7-.8zM46 55.1l-1.6-2.2 2.8-2.2 1.2 .9-.2 3.3-2.2 .2zM11.6 48.7l5.2 1.1 2.2 4.2 2.5-1.2-1.7 2.4-2.5-.7-5.7-5.7zM78.8 41.5l3.6-1.6 5.7 1.2 1.2 1.5-4.9 2.4-2.8-.5-2.8-3zM49.3 47.7l.3 1.2-5.2 3.9 3.7-5.4 1.1 .3zM60.3 67.6l-.4-2.6 1.7 .7-.3-1.8 2-.4 .1 1.4-2.6 4.3-.5-1.6zM82.8 53.2l-.5 3.5-2.1-3.8 1.8-2.6 .8 2.9zM57.7 65.9l-1.4 4-2.5-4.1 3.8 .1zM54.5 55.5l-4.4-.3 3.8-3.1 1.3 1.1-.8 2.1zM54.5 55.5l-2.5 3.1-.6-3 3-.1zM56.8 28.3l-4.4 8.3-.7-2.8 4.3-5.9 3-1.5 1.1 1.5-3.3 .4zM67.4 54.5l.9-2.9 1.3 1-2.1 1.9zM75.2 47.5l-1.9 4.3-3.1-.3-.3-1.7 5.3-2.3zM96.2 63l0-2.1 1.4 .6 1.8 2-3.1-.4zM30.9 66.8l1.3 1.4-1.4 1.1-1.3-1.8 1.4-.8zM85.4 52.8l-2.9-.2-1-2.7-4.9-.2-2.2-2.8 4.1-5.4 3.1 3 2.8 .5 4.9-2.3-1.4-.7 1.8-2.7 4.4 2.6-1.3 2.7-4.2 1.5 1.6 .7-1 4.6-3.8 1.4zM27.1 61.4l-1.4 1.1 1.8 1.7-.4 1.9-2.1-1.4-1.6-3.3 1.9-1.4 1.7 1.4zM57.7 40.3l-.2 1.2-2.6-.9 .9-2.1 1.9 1.7zM53.6 61.3l2.5-2.5-.9 2.5-1.5 .1zM92.8 44.7l1.3-2.8-3.6-2.7-1.9 2.1-6.2-1.4-3.7 1.6-6.1-3.4-2.5 .8-.1 1.8-4.5 .2 .2 4.3-2.6-1-1.1-.8 1.1-2.1-2.7-1.3-1.4-3.2 1.3-3.5-.4-5.5 3.5 1.7-.7 1.4-2.2-.9 1.8 2.6 2.2-1.7-.3-2.2 1 1.6 2.4-1.9 2 .6 .4-1.4 2.5 1.4-.7-2.6 1.6-2 .2 6.3 1-2.2 1.3 1.1-1.7-1.4 .3-3.7 .3 1.7 2.4-.5 0 1.6-.8-3.6 2 .5 .1-2.5 4.1-.8 1.5-2.8 3.2 2.6-2.8 3.9 1.6-1.4 1.2 1.5 3.5-1.2 2.1 3.2 .6-1.2 2.4 .5 .3-1.5 5.8 2 .7 2.3 .8-1.1 2.4 .8 0-1.2 2.7 .7 .4 3.7-1.8 .3 1.5 1.7-5 1.6-2.3 5.2-.3-3.1 3.1-3.8-2.7 .6-.6 1.6-4.2 0-2.4 2.6 2 .9-.4 2.5-3 2.9zM67 53.7l-3 .9-2.6-4.2 1.4-1.5 5.3 3.5-1 1.3zM63.6 60.6l.1-1.9 3.1-2.1-3.2 3.9zM59.6 67.5l1 2.3-4 2.4-1.2-2.4 4.1-2.3zM61.1 58.6l-1.9 0-1-2 2.7-.6 .3 2.6zM49.4 44.2l1.7 .5-1.8 2.4-1.7-.2-.6-2.5 2.4-.2zM61.2 56.9l-3.4 .3-.6-1.4 1-3.2 3.9 0-.9 4.3zM53.7 35.9l1.6-6.2 2.2-.8-2.3 8.7-1 .5-.5-2.2zM60.8 63.1l-.8-2.7 2.9 1.2 .2 2-2.3-.5zM82.8 53.2l1.8 1.6-1.8 .8 .3 2.6-.3-5zM63.6 45l1.1 1.9-2.9 .5-2.8-.3-.4-1.4 5-.6zM68.3 45.1l3.5 1.4-1.4 1.2-2.7-.9-.5-1.9 1.1 .2zM62.5 42.5l-3.1 .9 .1-1.3-2.2-.3 .7-1.7 3.1-.3 2 1.5-.6 1.2zM7.4 37.8l-5.4-3.3-1.7 1.3 .7-1.5-4.5 4.1 2.1-2.5-2.8-1 1.5-3-2.4-.7 2.6-.6-2.2-1.7 3.4-2.9 4.4 1.3 .7 7.8 3.6 2.7zM25.5 43.5l1.8-1.2 .7 1.3-3.3 2.7-1.3 5.2-.9-1.8-3.6 .1-.8 1.4-6.5-2.5-2.1-2.5-.4-4.3 9.7-.5 3.6 1.4 .5 2.2 2.6-1.5zM73.3 44.7l-1.5 2.1-3.5-1.7 0-1.6 4.9 1.2zM30.3 57.2l-2 2.6-2.1-3.3 4.1 .7zM85.4 52.8l.5 3.1-1.6 1.3 1-2.2-1.8-2.5 1.9 .3zM67.4 54.5l-3.2 1.1 0-1.4 3.2 .2zM60 65.2l-2.8 .1 .7-1.7 1.9 .9 .3-1.8-.1 2.5zM60.3 67.6l-2-1.6 2.5-.4-.5 1.9z';
const GREENLAND =
  'M40.2 6l1.3 .8-2 .8 3.4 .8-2.7 1.5 2.8 0-.6 2.8 1.2-1.8 2.7 .4-2.9 3-.1 9.5-2.3 .4 1.8 .2-1.5 .2 1.6 2.3-1.8-1.1-.6 1.2 2.2 .4-5.9 3.9-1.3 4.1-2.9-4.1 .9-3.9-1.4-.6 1.2-.3-.9-1.5-.6 .9-1-4.8-3.2-.6-.9-1.4 1.6-.7-2.1-1.3 2.2-1.3-.4-2.3 2.2-3.2 1.2 1.2-.8-1.5 1.5-.8 .3 1.7 1.2-2 1.7 1.7-.2-2.4 1.3 0-1.5-.8 5-1.5z';

// ---- the icons ---------------------------------------------------------

// each entry gives a background, extra definitions and the drawing on top
const ART = {
  // one italic # drawn as a single shape, its corners softened by a stroke of the same paint
  'hash-text': ({ dark }) => {
    const slant = 0.19;
    const post = (x) => {
      const half = 4.1;
      const lean = slant * 31;
      return `M${x + lean - half} 19H${x + lean + half}L${x - lean + half} 81H${x - lean - half}Z`;
    };
    const bar = (y) => {
      const shift = slant * (50 - y);
      return `M${21 + shift} ${y - 4.1}H${79 + shift}V${y + 4.1}H${21 + shift}Z`;
    };
    const glyph = post(39.5) + post(60.5) + bar(38.5) + bar(61.5);
    return {
      background: ['#8583ff', '#3f33d6'],
      defs: across('hx', ['#ffffff', '#e4e2ff'], 0, 19, 0, 81),
      art:
        `<ellipse cx="50" cy="46" rx="30" ry="26" fill="#b9b6ff" opacity="${dark ? 0.22 : 0.35}" filter="url(#@g)"/>` +
        `<path d="${glyph}" fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round" opacity=".28" filter="url(#@f)" transform="translate(0 3.5)"/>` +
        `<path d="${glyph}" fill="url(#@hx)" stroke="url(#@hx)" stroke-width="3" stroke-linejoin="round"/>`,
    };
  },
  'hmac-generator': () => {
    const key =
      '<circle cx="31" cy="50" r="16"/><rect x="42" y="45.5" width="42" height="9" rx="2.5"/>' +
      '<path d="M62 53h22v12a2 2 0 0 1-2 2h-4.2v-5.5h-4.6V67H64a2 2 0 0 1-2-2Z"/>';
    const engraving = 'M24.5 46.5h13M24.5 53.5h13M29.5 41.5l-1.6 17M35.1 41.5l-1.6 17';
    return {
      background: ['#34507f', '#121c38'],
      defs:
        across('kg', ['#fff3c4', ['#f9c950', 1, 0.45], '#c7841b'], 0, 34, 0, 68) +
        radial('kh', [['#ffd66e', 0.55], ['#ffd66e', 0]]),
      art:
        `<circle cx="50" cy="50" r="40" fill="url(#@kh)" opacity=".45"/>` +
        `<g transform="translate(51.5 52) scale(1.14) rotate(38) translate(-50 -50)">` +
        shadow(key, 3, 0.45) +
        `<g fill="url(#@kg)">${key}</g>` +
        `<path d="${engraving}" transform="translate(0 .7)" fill="none" stroke="#fff6d6" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
        `<path d="${engraving}" fill="none" stroke="#a8680f" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M19.6 42.4a13 13 0 0 1 17-6.8M45 47.2h36" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>` +
        `</g>`,
    };
  },
  encryption: () => {
    const body = '<rect x="25" y="43" width="50" height="39" rx="10"/>';
    return {
      background: ['#52b1ff', '#0b5fe0'],
      defs:
        across('ls', ['#9ea8ba', '#ffffff', ['#c3cad7', 1, 0.55], '#f6f8fb', '#8f99ac'], 33, 0, 67, 0) +
        linear('lb', ['#ffffff', '#e3ebf7']) +
        linear('lk', ['#16335f', '#2c5796']),
      art:
        `<ellipse cx="50" cy="86" rx="27" ry="4" fill="#00236b" opacity=".35" filter="url(#@f)"/>` +
        shadow(`<path d="M36.5 46V35.5a13.5 13.5 0 0 1 27 0V46" fill="none" stroke-width="8.5"/>`, 2.5, 0.25) +
        `<path d="M36.5 47V35.5a13.5 13.5 0 0 1 27 0V47" fill="none" stroke="url(#@ls)" stroke-width="8.5"/>` +
        `<path d="M33.6 36a16.4 16.4 0 0 1 12-15.3" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>` +
        shadow(body, 3, 0.3) +
        `<g fill="url(#@lb)" stroke="url(#@e)" stroke-width=".9">${body}</g>` +
        `<path d="M25.5 52a10 10 0 0 1 9.5-8.5h30a10 10 0 0 1 9.5 8.5" fill="none" stroke="#fff" stroke-width="1.2" opacity=".9"/>` +
        `<path d="M50 55.5a5.2 5.2 0 0 0-2.6 9.7l-1.3 7.3a1.4 1.4 0 0 0 1.4 1.7h5a1.4 1.4 0 0 0 1.4-1.7l-1.3-7.3A5.2 5.2 0 0 0 50 55.5Z" fill="url(#@lk)"/>` +
        `<path d="M46.4 72.6h7.2" stroke="#fff" stroke-width=".9" opacity=".7" transform="translate(0 1.6)"/>`,
    };
  },
  'token-generator': () => {
    const pill = '<rect x="13" y="36" width="74" height="28" rx="14"/>';
    const dots = [26, 38, 50, 62].map((x) => `<circle cx="${x}" cy="50" r="4.8"/>`).join('');
    return {
      background: ['#3a3a3f', '#0e0e10'],
      defs:
        linear('tp', [['#fff', 0.22], ['#fff', 0.07]]) +
        linear('td', ['#c9ffd9', '#34c759']) +
        radial('tg', [['#34c759', 0.5], ['#34c759', 0]]),
      art:
        `<ellipse cx="50" cy="50" rx="46" ry="30" fill="url(#@tg)" opacity=".55"/>` +
        shadow(pill, 3, 0.5) +
        `<g fill="url(#@tp)" stroke="url(#@e)" stroke-width=".9">${pill}</g>` +
        `<g fill="#34c759" opacity=".7" filter="url(#@s)">${dots}</g>` +
        `<g fill="url(#@td)">${dots}</g>` +
        `<rect x="72.4" y="41" width="2.6" height="18" rx="1.3" fill="#fff"/>` +
        `<path d="M24 38.6h52" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".5"/>` +
        `<path d="M76 14.5c.9 4.6 2.9 6.6 7.5 7.5-4.6.9-6.6 2.9-7.5 7.5-.9-4.6-2.9-6.6-7.5-7.5 4.6-.9 6.6-2.9 7.5-7.5Z" fill="#34c759" opacity=".8" filter="url(#@f)"/>` +
        `<path d="M76 14.5c.9 4.6 2.9 6.6 7.5 7.5-4.6.9-6.6 2.9-7.5 7.5-.9-4.6-2.9-6.6-7.5-7.5 4.6-.9 6.6-2.9 7.5-7.5Z" fill="url(#@td)"/>` +
        `<path d="M24 71c.6 3 1.9 4.3 4.9 4.9-3 .6-4.3 1.9-4.9 4.9-.6-3-1.9-4.3-4.9-4.9 3-.6 4.3-1.9 4.9-4.9Z" fill="#34c759" opacity=".55"/>`,
    };
  },
  'otp-generator': ({ dark }) => {
    const card = '<rect x="10" y="50" width="80" height="31" rx="9"/>';
    return {
      background: ['#63e3cb', '#0c8f83'],
      defs: linear('oc', ['#ffffff', '#e4f4f1']) + linear('oa', ['#ffffff', '#d9fff7']),
      art:
        shadow(card, 3, 0.25) +
        `<g fill="url(#@${dark ? 'q' : 'oc'})" stroke="url(#@e)" stroke-width=".9">${card}</g>` +
        `<g fill="none" stroke="${dark ? '#8af2de' : '#0a5a52'}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${figures('482', 17.2, 59, 13)}${figures('913', 53.5, 59, 13)}</g>` +
        `<circle cx="50" cy="29" r="14" fill="none" stroke="#fff" stroke-width="4.4" opacity=".32"/>` +
        shadow(`<circle cx="50" cy="29" r="14" fill="none" stroke-width="4.4" pathLength="100" stroke-dasharray="70 100" transform="rotate(-90 50 29)"/>`, 1.5, 0.18) +
        `<circle cx="50" cy="29" r="14" fill="none" stroke="url(#@oa)" stroke-width="4.4" stroke-linecap="round" pathLength="100" stroke-dasharray="70 100" transform="rotate(-90 50 29)"/>` +
        `<path d="M50 29v-7.5M50 29l4.5 3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>` +
        `<circle cx="50" cy="29" r="2" fill="#fff"/>`,
    };
  },
  'basic-auth': ({ dark }) => {
    const tone = tones(dark);
    const card = '<rect x="13" y="27" width="74" height="50" rx="10"/>';
    return {
      background: ['#ffbd52', '#ee6f00'],
      defs:
        linear('bc', ['#ffffff', '#f3ece4']) +
        linear('ba', ['#ffcf7a', '#ff8a00']),
      art:
        shadow(card, 3.5, 0.3) +
        `<g fill="url(#@${dark ? 'q' : 'bc'})" stroke="url(#@e)" stroke-width=".9">${card}</g>` +
        `<rect x="42" y="32" width="16" height="3.6" rx="1.8" fill="${tone.faint}"/>` +
        `<circle cx="33.5" cy="54" r="12" fill="url(#@ba)"/>` +
        `<g fill="#fff"><circle cx="33.5" cy="50.4" r="4.3"/><path d="M25.6 62.3c1.4-3.7 4.3-5.9 7.9-5.9s6.5 2.2 7.9 5.9a12 12 0 0 1-15.8 0Z"/></g>` +
        `<rect x="51" y="45" width="26" height="5.2" rx="2.6" fill="${tone.ink}"/>` +
        `<g fill="${tone.soft}">${[53.5, 60.5, 67.5, 74.5].map((x) => `<circle cx="${x}" cy="60.5" r="2.6"/>`).join('')}</g>`,
    };
  },
  'rsa-keygen': () => {
    const key =
      '<path fill-rule="evenodd" d="M27 36a14 14 0 1 0 0 28 14 14 0 0 0 0-28Zm0 9a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/>' +
      '<rect x="38" y="46" width="47" height="8" rx="2.4"/><path d="M66 52h19v10.5a2 2 0 0 1-2 2h-3.8v-4.8h-4v4.8H68a2 2 0 0 1-2-2Z"/>';
    const place = (angle, dx) => `translate(${50 + dx} 51) scale(.86) rotate(${angle}) translate(-54 -50)`;
    return {
      background: ['#b07cff', '#5419c9'],
      defs:
        across('rg', ['#fff3c4', ['#f9c950', 1, 0.45], '#c7841b'], 0, 36, 0, 66) +
        across('rs', ['#ffffff', ['#dfe3ea', 1, 0.45], '#99a2b3'], 0, 36, 0, 66),
      art:
        `<g transform="${place(135, 0)}">${shadow(key, 3, 0.35)}<g fill="url(#@rs)">${key}</g>` +
        `<path d="M15.5 43a13 13 0 0 1 15-6.6M40 48h43" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".8"/></g>` +
        `<g transform="${place(45, 0)}">${shadow(key, 3, 0.4)}<g fill="url(#@rg)">${key}</g>` +
        `<path d="M15.5 43a13 13 0 0 1 15-6.6M40 48h43" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".75"/></g>`,
    };
  },
  'password-strength': () => {
    const shield = '<path d="M50 13.5c8.2 4.6 17.4 7.4 28 8.2v25.8c0 18.3-10.6 31.6-28 39-17.4-7.4-28-20.7-28-39V21.7c10.6-.8 19.8-3.6 28-8.2Z"/>';
    return {
      background: ['#fbfcfd', '#dde2ea'],
      defs: linear('ps', ['#5fe07c', '#17a03d']) + linear('pb', [['#fff', 0.35], ['#fff', 0]]),
      art:
        `<ellipse cx="50" cy="88" rx="24" ry="3.5" fill="#1d3b24" opacity=".35" filter="url(#@f)"/>` +
        shadow(shield, 3, 0.25) +
        `<g fill="url(#@ps)">${shield}</g>` +
        `<path d="M50 16.8c7.6 4.1 16.1 6.7 25.6 7.6v10.2C63 36 55 42 50 50c-5-8-13-14-25.6-15.4V24.4c9.5-.9 18-3.5 25.6-7.6Z" fill="url(#@pb)"/>` +
        `<g fill="none" stroke="url(#@e)" stroke-width="1">${shield}</g>` +
        shadow(`<path d="m38.5 43 8 8 15-16" fill="none" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/>`, 1.5, 0.2, 's') +
        `<path d="m38.5 43 8 8 15-16" fill="none" stroke="#fff" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<g fill="#fff">${[34.5, 43, 51.5].map((x) => `<rect x="${x}" y="61" width="6.5" height="4.6" rx="2.3"/>`).join('')}<rect x="60" y="61" width="6.5" height="4.6" rx="2.3" opacity=".45"/></g>`,
    };
  },
  'base64-converter': ({ dark }) => {
    const card = '<rect x="17" y="17" width="66" height="66" rx="16"/>';
    return {
      background: ['#ffd95c', '#f29a00'],
      defs: linear('bg', ['#ffffff', '#fff1d6']) + linear('bi', dark ? ['#ffd37a', '#f29a00'] : ['#c26a00', '#8a4300']),
      art:
        shadow(card, 3.5, 0.28) +
        `<g fill="url(#@${dark ? 'q' : 'bg'})" stroke="url(#@e)" stroke-width=".9">${card}</g>` +
        `<g fill="none" stroke="url(#@bi)" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round">${figures('64', 28.4, 27, 30)}</g>` +
        `<g fill="#f29a00">${[39, 53].map((x) => `<rect x="${x}" y="65" width="8" height="3" rx="1.5"/><rect x="${x}" y="70.5" width="8" height="3" rx="1.5"/>`).join('')}</g>`,
    };
  },
  'color-converter': () => {
    const discs = [
      ['cr', '#ff3b30', 50, 37],
      ['cg', '#34c759', 38.2, 57.5],
      ['cb', '#0a84ff', 61.8, 57.5],
    ];
    return {
      background: ['#303036', '#08080a'],
      defs: discs.map(([id, colour]) => radial(id, [light(colour, 0.25), colour, deep(colour, 0.2)], 0.4, 0.35, 0.7)).join(''),
      art:
        discs.map(([, colour, x, y]) => `<circle cx="${x}" cy="${y}" r="23" fill="${colour}" opacity=".45" filter="url(#@g)"/>`).join('') +
        `<g style="mix-blend-mode:screen;isolation:isolate">${discs.map(([id, , x, y]) => `<circle cx="${x}" cy="${y}" r="21" fill="url(#@${id})" style="mix-blend-mode:screen"/>`).join('')}</g>` +
        discs.map(([, , x, y]) => `<circle cx="${x}" cy="${y}" r="20.6" fill="none" stroke="url(#@e)" stroke-width=".8" opacity=".8"/>`).join(''),
    };
  },
  'color-palette': ({ dark }) => {
    const tone = tones(dark);
    const colours = ['#af52de', '#0a84ff', '#30d158', '#ffd60a', '#ff9f0a', '#ff375f'];
    const card = '<rect x="-9" y="-60" width="18" height="64" rx="4.5"/>';
    return {
      background: ['#ffffff', '#e4e6ec'],
      defs: colours.map((colour, index) => linear(`p${index}`, [light(colour, 0.12), deep(colour, 0.1)])).join(''),
      art:
        `<ellipse cx="51" cy="85" rx="30" ry="3.5" fill="#000" opacity=".22" filter="url(#@f)"/>` +
        colours
          .map((colour, index) => {
            const angle = -14 + index * 14.5;
            return (
              `<g transform="translate(33 78) rotate(${angle})">` +
              shadow(card, 1.4, 0.22, 's') +
              `<g fill="${tone.paper}" stroke="${tone.rim}" stroke-width=".5">${card}</g>` +
              `<rect x="-7" y="-58" width="14" height="46" rx="3" fill="url(#@p${index})"/>` +
              `<rect x="-5" y="-7" width="7" height="1.8" rx=".9" fill="${tone.rule}"/>` +
              `</g>`
            );
          })
          .join('') +
        `<circle cx="33" cy="78" r="3.2" fill="${tone.rule}" stroke="${tone.paper}" stroke-width="1.2"/>`,
    };
  },
  'case-converter': () => {
    const upper = 'M17 73 33.5 27 50 73M23.4 58h20.2';
    const lower = 'M79.5 45.5V73M79.5 59a11.5 12.8 0 1 1-23 0 11.5 12.8 0 1 1 23 0Z';
    return {
      background: ['#ff7aa8', '#e3175a'],
      defs: across('cu', ['#ffffff', '#ffe8f0'], 0, 27, 0, 73) + across('cl', ['#ffe1ec', '#ffc2d8'], 0, 45, 0, 73),
      art:
        shadow(`<path d="${upper}${lower}" fill="none" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>`, 3, 0.28) +
        `<path d="${upper}" fill="none" stroke="url(#@cu)" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="${lower}" fill="none" stroke="url(#@cl)" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'date-converter': ({ dark }) => {
    const tone = tones(dark);
    const page = '<rect x="14" y="17" width="52" height="58" rx="9"/>';
    const face = '<circle cx="64" cy="62" r="21"/>';
    const ticks = [0, 90, 180, 270].map((angle) => `<path d="M64 45.5v3.5" transform="rotate(${angle} 64 62)"/>`).join('');
    return {
      background: ['#8f9bff', '#4a52e8'],
      defs:
        linear('dh', ['#ff6961', '#e5332a']) +
        linear('df', dark ? ['#3a3a3f', '#232327'] : ['#ffffff', '#eef0f5']),
      art:
        `<g transform="rotate(-8 40 46)">` +
        shadow(page, 3, 0.28) +
        `<g fill="url(#@q)">${page}</g>` +
        `<path d="M14 26a9 9 0 0 1 9-9h34a9 9 0 0 1 9 9v6H14Z" fill="url(#@dh)"/>` +
        `<g fill="${tone.rule}">${[0, 1, 2].map((row) => [0, 1, 2, 3].map((col) => `<rect x="${21 + col * 10}" y="${40 + row * 9.5}" width="6" height="5" rx="1.4"/>`).join('')).join('')}</g>` +
        `<rect x="21" y="40" width="6" height="5" rx="1.4" fill="#ff453a"/>` +
        `</g>` +
        shadow(face, 3, 0.32) +
        `<g fill="url(#@df)" stroke="url(#@e)" stroke-width=".8">${face}</g>` +
        `<circle cx="64" cy="62" r="18.2" fill="none" stroke="${tone.faint}" stroke-width=".8"/>` +
        `<g stroke="${tone.soft}" stroke-width="1.8" stroke-linecap="round">${ticks}</g>` +
        `<path d="M64 62 57 55.5M64 62l9.5-5.5" stroke="${tone.ink}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M64 62l-2.5 12" stroke="#ff9f0a" stroke-width="1.3" stroke-linecap="round"/>` +
        `<circle cx="64" cy="62" r="2.2" fill="#ff9f0a"/>`,
    };
  },
  'base-converter': () => {
    const housing = '<rect x="12" y="28" width="76" height="44" rx="12"/>';
    const drums = [19, 39.5, 60];
    const shown = ['1', '0', '1'];
    const above = ['0', '1', '0'];
    return {
      background: ['#b4ec6c', '#3f9a2a'],
      defs:
        linear('nh', ['#48484e', '#1c1c1f']) +
        linear('nd', [['#000', 0.45], ['#000', 0, 0.3], ['#000', 0, 0.7], ['#000', 0.45]]) +
        `<clipPath id="@nc">${drums.map((x) => `<rect x="${x}" y="33" width="21" height="34" rx="4"/>`).join('')}</clipPath>`,
      art:
        shadow(housing, 3.5, 0.35) +
        `<g fill="url(#@nh)" stroke="url(#@e)" stroke-width=".8">${housing}</g>` +
        `<g clip-path="url(#@nc)"><rect x="12" y="30" width="76" height="40" fill="#fafafa"/>` +
        `<g fill="none" stroke="#1c1c1e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">` +
        drums.map((x, index) => figures(shown[index], x + 5.5, 42, 16) + figures(above[index], x + 5.5, 16, 16) + figures(above[index], x + 5.5, 68, 16)).join('') +
        `</g><rect x="12" y="33" width="76" height="34" fill="url(#@nd)"/></g>` +
        `<path d="M14 50h4M82 50h4" stroke="#ff9f0a" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M24 30.5h52" stroke="#fff" stroke-width=".8" opacity=".35" stroke-linecap="round"/>`,
    };
  },
  'json-yaml': ({ dark }) => {
    const tone = tones(dark);
    const back = '<rect x="42" y="14" width="44" height="54" rx="8"/>';
    const front = '<rect x="14" y="30" width="46" height="56" rx="8"/>';
    const badge = '<circle cx="71" cy="72" r="13"/>';
    return {
      background: ['#62d5ff', '#0a78d1'],
      defs: linear('jb', ['#ffb340', '#ff7a00']),
      art:
        `<g transform="rotate(7 64 41)">${shadow(back, 2.5, 0.22)}<g fill="${dark ? '#2a2a2e' : '#eaf4ff'}">${back}</g>` +
        `<g fill="${dark ? '#5b6b80' : '#9fb8d3'}">${[24, 34, 44, 54].map((y, index) => `<rect x="49" y="${y}" width="3" height="3" rx="1.5"/><rect x="${55 + (index % 2) * 5}" y="${y}" width="${22 - (index % 2) * 5}" height="3" rx="1.5"/>`).join('')}</g></g>` +
        `<g transform="rotate(-5 37 58)">${shadow(front, 3, 0.28)}<g fill="url(#@q)" stroke="url(#@e)" stroke-width=".8">${front}</g>` +
        `<path d="M29 40.5h-2a3.5 3.5 0 0 0-3.5 3.5v6.2c0 2-1.3 3.3-3 3.8 1.7.5 3 1.8 3 3.8V64a3.5 3.5 0 0 0 3.5 3.5h2M45 40.5h2a3.5 3.5 0 0 1 3.5 3.5v6.2c0 2 1.3 3.3 3 3.8-1.7.5-3 1.8-3 3.8V64a3.5 3.5 0 0 1-3.5 3.5h-2" fill="none" stroke="${dark ? '#5ac8fa' : '#0a78d1'}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<g fill="${tone.rule}"><rect x="31" y="48" width="12" height="3" rx="1.5"/><rect x="31" y="56" width="9" height="3" rx="1.5"/></g>` +
        `<rect x="21" y="75" width="24" height="3" rx="1.5" fill="${tone.faint}"/></g>` +
        shadow(badge, 2, 0.3) +
        `<g fill="url(#@jb)" stroke="url(#@e)" stroke-width=".8">${badge}</g>` +
        `<path d="M64.5 68.5h13l-3.2-3.2M77.5 75.5h-13l3.2 3.2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'text-encoder': () => {
    const ring = (radius, length, count, offset = 0) =>
      Array.from({ length: count }, (unused, index) => `<path d="M50 ${50 - radius}v${length}" transform="rotate(${+(offset + (index * 360) / count).toFixed(2)} 50 50)"/>`).join('');
    return {
      background: ['#3b8f6b', '#0f3d2b'],
      defs:
        linear('eo', ['#fff4cf', ['#f2c464', 1, 0.5], '#b9822a']) +
        linear('ei', ['#1f5a44', '#0b2a1e']) +
        radial('ek', ['#ffffff', '#d7dde3']),
      art:
        shadow('<circle cx="50" cy="50" r="37"/>', 3.5, 0.45) +
        `<circle cx="50" cy="50" r="37" fill="url(#@eo)"/>` +
        `<circle cx="50" cy="50" r="36.4" fill="none" stroke="#fff" stroke-width="1" opacity=".6"/>` +
        `<g stroke="#6b4a12" stroke-width="2.4" stroke-linecap="round" opacity=".75">${ring(33, 5, 26)}</g>` +
        shadow('<circle cx="50" cy="50" r="24"/>', 1.2, 0.5, 's') +
        `<circle cx="50" cy="50" r="24" fill="url(#@ei)"/>` +
        `<g stroke="#bfe8d5" stroke-width="2" stroke-linecap="round" opacity=".85" transform="rotate(-24 50 50)">${ring(20.5, 4, 26, 7)}</g>` +
        `<path d="M50 50 45.2 13.3a37 37 0 0 1 9.6 0Z" fill="#fff" opacity=".3"/>` +
        `<path d="M45.2 13.3a37 37 0 0 1 9.6 0L50 50Z" fill="none" stroke="#fff" stroke-width="1.1" stroke-linejoin="round" opacity=".9"/>` +
        shadow('<circle cx="50" cy="50" r="8"/>', 1.5, 0.4, 's') +
        `<circle cx="50" cy="50" r="8" fill="url(#@ek)"/>` +
        `<circle cx="50" cy="50" r="2.4" fill="#9aa4ad"/>`,
    };
  },
  'list-converter': ({ dark }) => {
    const tone = tones(dark);
    const card = '<rect x="13" y="17" width="56" height="66" rx="10"/>';
    const pill = '<rect x="63" y="25" width="22" height="50" rx="11"/>';
    const rows = [['#0a84ff', 11], ['#30d158', 16], ['#ffd60a', 21], ['#ff375f', 26]];
    return {
      background: ['#ffa86b', '#ef4f24'],
      defs: linear('lp', dark ? ['#5a5a60', '#3a3a3f'] : ['#3a3a3f', '#1c1c1e']),
      art:
        shadow(card, 3, 0.28) +
        `<g fill="url(#@q)" stroke="url(#@e)" stroke-width=".8">${card}</g>` +
        rows.map(([colour, width], index) => `<circle cx="24" cy="${31 + index * 12.5}" r="3.6" fill="${colour}"/><rect x="31" y="${29 + index * 12.5}" width="${width}" height="4" rx="2" fill="${tone.rule}"/>`).join('') +
        shadow(pill, 2.5, 0.35) +
        `<g fill="url(#@lp)" stroke="url(#@e)" stroke-width=".8">${pill}</g>` +
        `<path d="M74 35v29M67.5 57.5 74 64l6.5-6.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'roman-numerals': () => {
    const tablet = '<rect x="13" y="24" width="74" height="52" rx="9"/>';
    const letters =
      'M24 38.5 40 61.5M40 38.5 24 61.5M21 38.5h6M37 38.5h6M21 61.5h6M37 61.5h6' +
      'M50 38.5v23M46.5 38.5h7M46.5 61.5h7' +
      'M59 38.5l8.5 23 8.5-23M56 38.5h6M73 38.5h6';
    return {
      background: ['#c24a6a', '#5e0d2a'],
      defs:
        linear('rt', ['#fffaf0', '#e4d8c3']) +
        linear('rv', [['#b9a37f', 0], ['#b9a37f', 0.35], ['#b9a37f', 0]], 0, 0, 1, 1),
      art:
        shadow(tablet, 3.5, 0.4) +
        `<g fill="url(#@rt)">${tablet}</g>` +
        `<path d="M13 44c14-3 22 6 36 2s24-10 38-4M13 63c10 1 18-5 30-2" fill="none" stroke="url(#@rv)" stroke-width="1.2"/>` +
        `<rect x="17.5" y="28.5" width="65" height="43" rx="5.5" fill="none" stroke="#c9b894" stroke-width="1"/>` +
        `<rect x="18.3" y="29.3" width="65" height="43" rx="5.5" fill="none" stroke="#fff" stroke-width=".8" opacity=".8"/>` +
        `<path d="${letters}" transform="translate(.6 .8)" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round"/>` +
        `<path d="${letters}" fill="none" stroke="#7a5f3a" stroke-width="3.8" stroke-linecap="round"/>` +
        `<path d="M24 26h52" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".9"/>`,
    };
  },
  'url-encoder': () => {
    const sign = '<circle cx="33" cy="34" r="9.5"/><circle cx="67" cy="66" r="9.5"/><path d="M71 22 29 78"/>';
    return {
      background: ['#e98bff', '#8a2ad1'],
      defs: across('ue', ['#ffffff', '#f1ddff'], 0, 22, 0, 78),
      art:
        `<g fill="none" stroke-width="8" stroke-linecap="round">${shadow(sign, 3, 0.3)}<g stroke="url(#@ue)">${sign}</g></g>`,
    };
  },
  'url-parser': () => {
    const one = '<rect x="18" y="49" width="42" height="22" rx="11" transform="rotate(-45 39 60)"/>';
    const two = '<rect x="40" y="29" width="42" height="22" rx="11" transform="rotate(-45 61 40)"/>';
    return {
      background: ['#5b95ff', '#1a3cb3'],
      defs:
        across('ua', ['#ffffff', '#dce8ff'], 0, 30, 0, 90) +
        across('ub', ['#bfe6ff', '#6cc3ff'], 0, 10, 0, 70) +
        `<clipPath id="@uc"><path d="M0 0h100L0 100Z"/></clipPath>`,
      art:
        `<g fill="none" stroke-width="7.5">` +
        shadow(one + two, 3, 0.3) +
        `<g stroke="url(#@ua)">${one}</g>` +
        `<g stroke="#10256e" opacity=".25" filter="url(#@s)" transform="translate(.8 1.2)">${two}</g>` +
        `<g stroke="url(#@ub)">${two}</g>` +
        `<g clip-path="url(#@uc)"><g stroke="#10256e" opacity=".25" filter="url(#@s)" transform="translate(.8 1.2)">${one}</g><g stroke="url(#@ua)">${one}</g></g>` +
        `</g>`,
    };
  },
  'html-entities': () => {
    const amp = '<path d="M64.5 73 38.3 45.6a8 8 0 1 1 12.3-10.4L33.4 58.6a10.2 10.2 0 0 0 8 16.4c5.6 0 10.1-3 14.3-8.8l7.6-10.6" transform="translate(-1.5 -4)"/>';
    return {
      background: ['#3d3d42', '#111113'],
      defs: across('ha', ['#ffc36b', '#ff5a1f'], 0, 26, 0, 74),
      art:
        `<ellipse cx="50" cy="52" rx="24" ry="24" fill="#ff7a1f" opacity=".28" filter="url(#@g)"/>` +
        `<g fill="none" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round">${shadow(amp, 3, 0.5)}<g stroke="url(#@ha)">${amp}</g></g>` +
        `<path d="M20 40.5 11.5 50l8.5 9.5M80 40.5l8.5 9.5-8.5 9.5" fill="none" stroke="#8e8e93" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'jwt-parser': () => {
    const parts = [['#ff2d6f', 19, 60, 22], ['#c643ff', 41, 72, 36], ['#10b5f5', 63, 52, 18]];
    return {
      background: ['#ffffff', '#e2e5ec'],
      defs: parts.map(([colour], index) => linear(`j${index}`, [light(colour, 0.15), deep(colour, 0.08)])).join(''),
      art: parts
        .map(([colour, y, width, text], index) => {
          const x = 50 - width / 2;
          const pill = `<rect x="${x}" y="${y}" width="${width}" height="18" rx="9"/>`;
          return (
            shadow(pill, 2.2, 0.22) +
            `<g fill="url(#@j${index})" stroke="url(#@e)" stroke-width=".8">${pill}</g>` +
            `<rect x="${x + 9}" y="${y + 7.4}" width="${text}" height="3.2" rx="1.6" fill="#fff" opacity=".95"/>` +
            `<rect x="${x + 13 + text}" y="${y + 7.4}" width="${width - text - 22}" height="3.2" rx="1.6" fill="#fff" opacity=".5"/>`
          );
        })
        .join(''),
    };
  },
  'keycode-info': ({ dark }) => {
    const base = '<rect x="17" y="22" width="66" height="62" rx="14"/>';
    const face = '<rect x="22" y="19" width="56" height="52" rx="11"/>';
    return {
      background: ['#8aa0bd', '#34435c'],
      defs:
        linear('kb', dark ? ['#3a3a40', '#1f1f23'] : ['#d9dee7', '#9aa5b6']) +
        linear('kf', dark ? ['#56565d', '#3c3c42'] : ['#ffffff', '#eef1f6']) +
        linear('kd', [['#000', 0], ['#000', 0.05, 0.6], ['#000', 0.12]]),
      art:
        shadow(base, 4, 0.4) +
        `<g fill="url(#@kb)">${base}</g>` +
        `<g fill="url(#@kf)">${face}</g>` +
        `<g fill="url(#@kd)">${face}</g>` +
        `<rect x="22.5" y="19.5" width="55" height="51" rx="10.5" fill="none" stroke="#fff" stroke-opacity="${dark ? 0.18 : 1}" stroke-width="1"/>` +
        `<path d="M61 34v9.5a5 5 0 0 1-5 5H38.5M45.5 41.5l-7 7 7 7" fill="none" stroke="${dark ? '#f2f2f7' : '#3a3a3c'}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  slugify: ({ dark }) => {
    const tone = tones(dark);
    const font = `font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif"`;
    const mono = `font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"`;
    const card = '<rect x="12" y="15" width="76" height="30" rx="9"/>';
    const bar = '<rect x="8" y="58" width="84" height="28" rx="14"/>';
    return {
      background: ['#5fe08a', '#11954a'],
      art:
        shadow(card, 2.5, 0.25) +
        `<g fill="url(#@q)" stroke="url(#@e)" stroke-width=".8">${card}</g>` +
        `<text x="50" y="35.5" text-anchor="middle" ${font} font-size="14" font-weight="600" fill="${tone.ink}" textLength="62" lengthAdjust="spacingAndGlyphs">Hello World!</text>` +
        `<path d="m44.5 48.5 5.5 5 5.5-5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>` +
        shadow(bar, 2.5, 0.3) +
        `<g fill="${dark ? '#1f2a23' : '#ffffff'}" stroke="url(#@e)" stroke-width=".8">${bar}</g>` +
        `<circle cx="21" cy="72" r="5.5" fill="none" stroke="${dark ? '#6ee79a' : '#11954a'}" stroke-width="1.8"/>` +
        `<path d="M15.5 72h11M21 66.5c-1.8 1.6-2.7 3.4-2.7 5.5s.9 3.9 2.7 5.5c1.8-1.6 2.7-3.4 2.7-5.5s-.9-3.9-2.7-5.5" fill="none" stroke="${dark ? '#6ee79a' : '#11954a'}" stroke-width="1.4"/>` +
        `<text x="31" y="76.4" ${mono} font-size="12" font-weight="600" fill="${dark ? '#8ff0b0' : '#0b7a3a'}" textLength="54" lengthAdjust="spacingAndGlyphs">hello-world</text>`,
    };
  },
  'http-status': () => ({
    background: ['#394556', '#111720'],
    defs: across('hs', ['#b6ffcd', '#30d158'], 0, 30, 0, 58),
    art:
      `<ellipse cx="50" cy="45" rx="32" ry="16" fill="#30d158" opacity=".16" filter="url(#@g)"/>` +
      `<g fill="none" stroke-width="4.1" stroke-linecap="round" stroke-linejoin="round">` +
      shadow(figures('200', 20.5, 30, 28), 2, 0.4, 's') +
      `<g stroke="url(#@hs)">${figures('200', 20.5, 30, 28)}</g></g>` +
      [['#30d158', 29], ['#0a84ff', 43], ['#ff9f0a', 57], ['#ff453a', 71]]
        .map(([colour, x], index) => `<circle cx="${x}" cy="72" r="${index === 0 ? 4.6 : 3.6}" fill="${colour}"${index === 0 ? '' : ' opacity=".55"'}/>`)
        .join('') +
      `<circle cx="29" cy="72" r="7.5" fill="none" stroke="#30d158" stroke-width="1.2" opacity=".6"/>`,
  }),
  'json-formatter': () => {
    const braces =
      'M33 22h-3a6 6 0 0 0-6 6v12.5c0 3.8-2.4 6.8-6 7.5 3.6.7 6 3.7 6 7.5V72a6 6 0 0 0 6 6h3' +
      'M67 22h3a6 6 0 0 1 6 6v12.5c0 3.8 2.4 6.8 6 7.5-3.6.7-6 3.7-6 7.5V72a6 6 0 0 1-6 6h-3';
    const rows = [
      [37, 31, 12, '#ffd60a', 9, '#ffffff'],
      [42, 43, 11, '#ffd60a', 7, '#7cffb2'],
      [42, 55, 13, '#ffd60a', 6, '#ff9ed2'],
      [37, 67, 8, '#ffffff', 0, ''],
    ];
    return {
      background: ['#52d9e6', '#0a7fb5'],
      defs: across('jf', ['#ffffff', '#dff6fb'], 0, 22, 0, 78),
      art:
        shadow(`<path d="${braces}" fill="none" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`, 2.5, 0.28) +
        `<path d="${braces}" fill="none" stroke="url(#@jf)" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        rows
          .map(([x, y, key, keyColour, value, valueColour]) =>
            `<rect x="${x}" y="${y}" width="${key}" height="5.4" rx="2.7" fill="${keyColour}"/>` +
            (value ? `<rect x="${x + key + 3.5}" y="${y}" width="${value}" height="5.4" rx="2.7" fill="${valueColour}"/>` : ''),
          )
          .join(''),
    };
  },
  'json-diff': ({ dark }) => {
    const tone = tones(dark);
    const sheet = (x, y, colour, sign) => {
      const card = `<rect x="${x}" y="${y}" width="37" height="56" rx="8"/>`;
      return (
        shadow(card, 2.5, 0.3) +
        `<g fill="url(#@q)" stroke="url(#@e)" stroke-width=".8">${card}</g>` +
        `<rect x="${x + 6}" y="${y + 9}" width="18" height="4" rx="2" fill="${tone.rule}"/>` +
        `<rect x="${x + 10}" y="${y + 17}" width="20" height="4" rx="2" fill="${tone.rule}"/>` +
        `<rect x="${x + 3.5}" y="${y + 25}" width="30" height="11" rx="3.5" fill="${colour}" opacity=".16"/>` +
        `<path d="${sign}" transform="translate(${x + 9} ${y + 30.5})" stroke="${colour}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<rect x="${x + 15}" y="${y + 28.5}" width="15" height="4" rx="2" fill="${colour}"/>` +
        `<rect x="${x + 6}" y="${y + 41}" width="14" height="4" rx="2" fill="${tone.rule}"/>`
      );
    };
    return {
      background: ['#6c7c96', '#27324a'],
      art: sheet(11, 25, '#ff3b30', 'M-2.6 0h5.2') + sheet(52, 19, '#28cd41', 'M-2.6 0h5.2M0-2.6v5.2'),
    };
  },
  'sql-formatter': () => {
    const body = '<path d="M22 25v51c0 5 12.5 9 28 9s28-4 28-9V25Z"/>';
    return {
      background: ['#3f7bff', '#102e8a'],
      defs:
        across('sb', ['#b9c8e3', ['#ffffff', 1, 0.38], '#dde6f5', '#9fb2d4'], 22, 0, 78, 0) +
        linear('st', ['#ffffff', '#e1e9f7']),
      art:
        shadow(body + '<ellipse cx="50" cy="25" rx="28" ry="9"/>', 3.5, 0.4) +
        `<g fill="url(#@sb)">${body}</g>` +
        `<path d="M22 42.5c0 5 12.5 9 28 9s28-4 28-9M22 59.5c0 5 12.5 9 28 9s28-4 28-9" fill="none" stroke="#8193b5" stroke-width="1.2" opacity=".6"/>` +
        `<path d="M22 43.6c0 5 12.5 9 28 9s28-4 28-9M22 60.6c0 5 12.5 9 28 9s28-4 28-9" fill="none" stroke="#fff" stroke-width=".9"/>` +
        `<ellipse cx="50" cy="25" rx="28" ry="9" fill="url(#@st)"/>` +
        `<ellipse cx="50" cy="25" rx="27.4" ry="8.5" fill="none" stroke="#fff" stroke-width="1"/>` +
        [36, 53, 70].map((y, index) => `<rect x="30" y="${y}" width="11" height="4" rx="2" fill="#ff9f0a"/><rect x="44" y="${y}" width="${[22, 16, 19][index]}" height="4" rx="2" fill="#7b8db0"/>`).join(''),
    };
  },
  'xml-formatter': ({ dark }) => {
    const tone = tones(dark);
    const nodes = [[15, 17, 40], [33, 42.5, 48], [33, 68, 40]];
    const pills = nodes.map(([x, y, width]) => `<rect x="${x}" y="${y}" width="${width}" height="15" rx="7.5"/>`).join('');
    return {
      background: ['#d49a6a', '#7a4424'],
      defs: linear('xp', dark ? tones(dark).sheet : ['#ffffff', '#f6ebe0']),
      art:
        `<g transform="translate(3 0)">` +
        `<path d="M24 32v43.5h9M24 50h9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
        shadow(pills, 2.5, 0.3) +
        `<g fill="url(#@xp)" stroke="url(#@e)" stroke-width=".8">${pills}</g>` +
        nodes
          .map(([x, y, width], index) =>
            `<path d="M${x + 9} ${y + 4.5}l-3 3 3 3M${x + 14} ${y + 4.5}l3 3-3 3" fill="none" stroke="#e0741c" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>` +
            `<rect x="${x + 21}" y="${y + 5.8}" width="${width - 29}" height="3.4" rx="1.7" fill="${index ? (dark ? tone.rule : '#c7b8aa') : dark ? '#e8c3a0' : '#7a4424'}"/>`,
          )
          .join('') +
        `</g>`,
    };
  },
  'crontab-generator': ({ dark }) => {
    const tone = tones(dark);
    const ring = '<circle cx="50" cy="50" r="33" fill="none" stroke-width="6.5" stroke-linecap="round" pathLength="100" stroke-dasharray="78 100" transform="rotate(-90 50 50)"/>';
    const head = '<path d="M7 0-4.5-7.5v15Z" transform="translate(19.6 36.2) rotate(-70)" stroke-linejoin="round" stroke-width="1.5"/>';
    const face = '<circle cx="50" cy="50" r="20.5"/>';
    return {
      background: ['#ff8a80', '#d42b4d'],
      defs: across('cr', ['#ffffff', '#ffe1e4'], 0, 17, 0, 83),
      art:
        shadow(ring + head.replace('/>', ' />'), 2.5, 0.28) +
        `<g stroke="url(#@cr)" fill="url(#@cr)">${ring}${head}</g>` +
        shadow(face, 2, 0.25) +
        `<g fill="url(#@q)">${face}</g>` +
        `<g stroke="${tone.rule}" stroke-width="2" stroke-linecap="round">${[0, 90, 180, 270].map((angle) => `<path d="M50 33.5v3" transform="rotate(${angle} 50 50)"/>`).join('')}</g>` +
        `<path d="M50 50V38.5M50 50l7.5 4.5" fill="none" stroke="${tone.ink}" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="50" cy="50" r="2.2" fill="#d42b4d"/>`,
    };
  },
  'chmod-calculator': ({ dark }) => {
    const tone = tones(dark);
    const card = '<rect x="14" y="17" width="72" height="66" rx="13"/>';
    const rows = [[31, true, '#34c759'], [50, true, '#34c759'], [69, false]];
    return {
      background: ['#b9c2cf', '#556173'],
      art:
        shadow(card, 3, 0.3) +
        `<g fill="url(#@q)" stroke="url(#@e)" stroke-width=".8">${card}</g>` +
        `<path d="M22 40.5h56M22 59.5h56" stroke="${tone.faint}" stroke-width="1"/>` +
        rows
          .map(([y, on, colour]) =>
            `<rect x="23" y="${y - 2.4}" width="${on ? 16 : 12}" height="4.8" rx="2.4" fill="${tone.rule}"/>` +
            `<rect x="52" y="${y - 7}" width="25" height="14" rx="7" fill="${on ? colour : dark ? '#55555b' : '#e5e5ea'}"/>` +
            shadow(`<circle cx="${on ? 70 : 59}" cy="${y}" r="5.6"/>`, 0.8, 0.25, 's') +
            `<circle cx="${on ? 70 : 59}" cy="${y}" r="5.6" fill="#fff"/>`,
          )
          .join(''),
    };
  },
  'regex-tester': ({ dark }) => {
    const tone = tones(dark);
    const star = [0, 60, 120].map((angle) => `<path d="M58 34v19" transform="rotate(${angle} 58 43.5)"/>`).join('');
    const glyphs = `<circle cx="39" cy="63" r="5"/><g fill="none" stroke-width="5.6" stroke-linecap="round">${star}</g>`;
    return {
      background: ['#fffef6', '#e8e1c8'],
      defs: linear('rh', dark ? ['#b8900c', '#8a6a00'] : ['#ffe45c', '#ffc300']),
      art:
        `<path d="M27.5 52.4c7.8-1.6 33.6-2.4 45.6-1 1 4.9.6 12.5-.6 17.4-15 1.2-36.6 1.6-45 .3-1.2-5.2-1.2-11.4 0-16.7Z" fill="url(#@rh)"/>` +
        `<path d="M24 26 13 74M76 74l11-48" fill="none" stroke="${dark ? '#7d7768' : '#b8ae93'}" stroke-width="5" stroke-linecap="round"/>` +
        shadow(glyphs, 1.5, 0.18, 's') +
        `<g fill="${tone.ink}" stroke="${tone.ink}">${glyphs}</g>`,
    };
  },
  'subnet-calculator': ({ dark }) => {
    const tone = tones(dark);
    const quads = [['#0a84ff', 17, 17], ['#30d158', 53, 17], ['#ff9f0a', 17, 53], ['#bf5af2', 53, 53]];
    return {
      background: ['#f2f8ff', '#c9dbef'],
      defs: quads.map(([colour], index) => linear(`q${index}`, [light(colour, 0.2), deep(colour, 0.06)])).join(''),
      art: quads
        .map(([, x, y], index) => {
          const cells = [0, 1].map((row) => [0, 1].map((col) => `<rect x="${x + col * 15.5}" y="${y + row * 15.5}" width="14" height="14" rx="4"/>`).join('')).join('');
          return shadow(cells, 2, 0.22) + `<g fill="url(#@q${index})" stroke="url(#@e)" stroke-width=".7">${cells}</g>`;
        })
        .join('') +
        shadow('<circle cx="50" cy="50" r="12.5"/>', 2, 0.32) +
        `<circle cx="50" cy="50" r="12.5" fill="url(#@q)"/>` +
        `<path d="M50 44.5v5.5M50 50l-5 4.5M50 50l5 4.5" stroke="${tone.ink}" stroke-width="1.8" stroke-linecap="round"/>` +
        `<g fill="${tone.ink}"><circle cx="50" cy="43.6" r="2.6"/><circle cx="44.2" cy="55.2" r="2.6"/><circle cx="55.8" cy="55.2" r="2.6"/></g>`,
    };
  },
  'ip-converter': () => {
    const letters = 'M31 25v38M47.5 63V25H58a10.5 10.5 0 0 1 0 21H47.5';
    return {
      background: ['#3ee0b0', '#0a7d63'],
      defs: across('ic', ['#ffffff', '#d9fbef'], 0, 25, 0, 63),
      art:
        shadow(`<path d="${letters}" fill="none" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`, 3, 0.25) +
        `<path d="${letters}" fill="none" stroke="url(#@ic)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<g fill="#fff">${[20, 40, 60, 80].map((x, index) => `<rect x="${x - 7}" y="73" width="14" height="6" rx="3" opacity="${index === 1 ? 1 : 0.55}"/>`).join('')}` +
        `${[30, 50, 70].map((x) => `<circle cx="${x}" cy="76" r="1.6" opacity=".8"/>`).join('')}</g>`,
    };
  },
  'mac-generator': ({ dark }) => {
    const tone = tones(dark);
    const chip = '<rect x="25" y="25" width="50" height="50" rx="8"/>';
    const pins = [33, 44, 56, 67]
      .map((at) => `<rect x="${at - 2.4}" y="15" width="4.8" height="12" rx="2"/><rect x="${at - 2.4}" y="73" width="4.8" height="12" rx="2"/><rect x="15" y="${at - 2.4}" width="12" height="4.8" rx="2"/><rect x="73" y="${at - 2.4}" width="12" height="4.8" rx="2"/>`)
      .join('');
    return {
      background: ['#f7f7f9', '#c6cad3'],
      defs:
        across('mp', ['#fff0b8', '#e0a526'], 0, 15, 0, 85) +
        linear('mc', dark ? ['#5c5c63', '#303035'] : ['#4a4a50', '#1d1d20']),
      art:
        shadow(pins + chip, 2.5, 0.3) +
        `<g fill="url(#@mp)">${pins}</g>` +
        `<g fill="url(#@mc)">${chip}</g>` +
        `<rect x="25.6" y="25.6" width="48.8" height="48.8" rx="7.4" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1"/>` +
        `<circle cx="32" cy="32" r="1.8" fill="#8e8e93"/>` +
        [40, 50, 60]
          .map((y, row) => [33, 47, 61].map((x, col) => `<rect x="${x}" y="${y - 2}" width="8" height="4" rx="2" fill="${row === 1 && col === 1 ? '#64d2ff' : '#ffffff'}" opacity="${row === 1 && col === 1 ? 1 : 0.8}"/>`).join('') + `<circle cx="44" cy="${y}" r="1" fill="#8e8e93"/><circle cx="58" cy="${y}" r="1" fill="#8e8e93"/>`)
          .join(''),
    };
  },
  'lorem-ipsum': ({ dark }) => {
    const tone = tones(dark);
    const page = '<rect x="18" y="14" width="64" height="72" rx="10"/>';
    const pilcrow = '<path d="M41.5 24H58v4h-3.2v24h-3.6V28h-3v24h-3.6V41.5a8.75 8.75 0 0 1-3.1-17.5Z"/>';
    return {
      background: ['#ffc59e', '#f0567a'],
      defs: linear('lp', ['#ff7a59', '#e02f6b']),
      art:
        shadow(page, 3, 0.28) +
        `<g fill="url(#@q)" stroke="url(#@e)" stroke-width=".8">${page}</g>` +
        `<g transform="translate(-9 -1)" fill="url(#@lp)">${pilcrow}</g>` +
        [[26, 18], [34, 14], [42, 18]].map(([y, width]) => `<rect x="55" y="${y}" width="${width}" height="3.8" rx="1.9" fill="${tone.rule}"/>`).join('') +
        [[57, 46], [65, 46], [73, 30]].map(([y, width]) => `<rect x="27" y="${y}" width="${width}" height="3.8" rx="1.9" fill="${tone.rule}"/>`).join(''),
    };
  },
  'text-stats': ({ dark }) => {
    const tone = tones(dark);
    const page = '<rect x="14" y="14" width="54" height="66" rx="9"/>';
    const badge = '<rect x="46" y="44" width="42" height="42" rx="11"/>';
    const bars = [[54, 70, 9, '#ffd60a'], [65, 61, 18, '#ff9f0a'], [76, 52, 27, '#ff375f']];
    return {
      background: ['#79e3fb', '#2563eb'],
      defs: linear('tb', dark ? ['#4c4c52', '#2a2a2e'] : ['#2c2c30', '#111113']),
      art:
        shadow(page, 3, 0.25) +
        `<g fill="url(#@q)" stroke="url(#@e)" stroke-width=".8">${page}</g>` +
        [[24, 34], [32, 28], [40, 34], [48, 18], [56, 26], [64, 14]].map(([y, width]) => `<rect x="22" y="${y}" width="${width}" height="3.6" rx="1.8" fill="${tone.rule}"/>`).join('') +
        shadow(badge, 3, 0.35) +
        `<g fill="url(#@tb)" stroke="url(#@e)" stroke-width=".8">${badge}</g>` +
        bars.map(([x, y, height, colour]) => `<rect x="${x - 3.5}" y="${y}" width="7" height="${height}" rx="2.5" fill="${colour}"/>`).join('') +
        `<path d="M53 79h30" stroke="#fff" stroke-opacity=".3" stroke-width="1.2" stroke-linecap="round"/>`,
    };
  },
  'text-diff': () => {
    const rows = [
      [22, null, 34],
      [35, '#ff453a', 40],
      [48, '#ff453a', 28],
      [61, '#32d74b', 42],
      [74, null, 24],
    ];
    return {
      background: ['#34343a', '#0f0f11'],
      art: rows
        .map(([y, colour, width]) =>
          colour
            ? `<rect x="10" y="${y - 4.5}" width="80" height="12" rx="3" fill="${colour}" opacity=".22"/>` +
              `<path d="${colour === '#32d74b' ? `M17 ${y + 1.5}h6M20 ${y - 1.5}v6` : `M17 ${y + 1.5}h6`}" stroke="${colour}" stroke-width="2.4" stroke-linecap="round"/>` +
              `<rect x="31" y="${y}" width="${width}" height="3.6" rx="1.8" fill="${colour}"/>`
            : `<rect x="31" y="${y}" width="${width}" height="3.6" rx="1.8" fill="#8e8e93" opacity=".7"/>`,
        )
        .join('') + `<path d="M27 14v72" stroke="#fff" stroke-opacity=".12" stroke-width="1"/>`,
    };
  },
  'markdown-preview': ({ dark }) => {
    const plate = '<rect x="11" y="26" width="78" height="48" rx="10"/>';
    return {
      background: ['#ffffff', '#d8dce3'],
      defs: linear('mk', dark ? ['#5a5a61', '#39393e'] : ['#3a3a40', '#141416']),
      art:
        shadow(plate, 3.5, 0.3) +
        `<g fill="url(#@mk)" stroke="url(#@e)" stroke-width=".8">${plate}</g>` +
        `<path d="M23 62V38l10.5 12.5L44 38v24" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M66 38v21M57 52l9 9.5 9-9.5" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'math-evaluator': () => {
    const keys = [
      [31.5, 31.5, 'mg', 'M23.5 31.5h16M31.5 23.5v16'],
      [68.5, 31.5, 'mg', 'M60.5 31.5h16'],
      [31.5, 68.5, 'mg', 'M25.8 62.8l11.4 11.4M37.2 62.8 25.8 74.2'],
      [68.5, 68.5, 'mo', 'M60.5 64.5h16M60.5 72.5h16'],
    ];
    return {
      background: ['#3f3f44', '#141416'],
      defs: linear('mg', ['#8e8e93', '#636366']) + linear('mo', ['#ffb340', '#ff8a00']),
      art: keys
        .map(([x, y, fill, glyph]) =>
          shadow(`<circle cx="${x}" cy="${y}" r="15.5"/>`, 2, 0.4) +
          `<circle cx="${x}" cy="${y}" r="15.5" fill="url(#@${fill})"/>` +
          `<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="url(#@e)" stroke-width=".8" opacity=".8"/>` +
          `<path d="${glyph}" stroke="#fff" stroke-width="4.2" stroke-linecap="round"/>`,
        )
        .join(''),
    };
  },
  'unit-converter': () => {
    const tape = '<path d="M46 55h37a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H46Z"/>';
    const body = '<rect x="12" y="26" width="46" height="46" rx="15"/>';
    return {
      background: ['#49c6cf', '#0e6574'],
      defs:
        linear('ut', ['#fff38a', '#ffcf1f']) +
        linear('ub', ['#ffd84a', '#f59e0b']) +
        radial('uc', ['#f2f2f7', '#aeaeb2'], 0.4, 0.35, 0.7) +
        across('uh', ['#e5e5ea', '#8e8e93'], 0, 52, 0, 72),
      art:
        shadow(tape, 2, 0.28) +
        `<g fill="url(#@ut)">${tape}</g>` +
        `<g stroke="#5a4600" stroke-width="1" stroke-linecap="round">${Array.from({ length: 13 }, (unused, index) => `<path d="M${50 + index * 2.6} 55v${index % 5 === 0 ? 6 : index % 5 === 2 ? 4 : 2.6}"/>`).join('')}</g>` +
        `<rect x="83" y="51.5" width="4.5" height="21" rx="1.6" fill="url(#@uh)"/>` +
        shadow(body, 3, 0.35) +
        `<g fill="url(#@ub)" stroke="url(#@e)" stroke-width=".8">${body}</g>` +
        `<rect x="25" y="22.5" width="14" height="6" rx="3" fill="#2c2c2e"/>` +
        shadow('<circle cx="35" cy="49" r="11"/>', 1.5, 0.3, 's') +
        `<circle cx="35" cy="49" r="11" fill="url(#@uc)"/>` +
        `<circle cx="35" cy="49" r="3" fill="#8e8e93"/>`,
    };
  },
  'qr-generator': ({ dark }) => {
    const grid = ['FFF.x.FFF', 'FFF..xFFF', 'FFF.x.FFF', 'x.xx.x.xx', '.xx.xxx.x', 'x..x.x.x.', 'FFF.x.xx.', 'FFF.xx.xx', 'FFF..x.x.'];
    const cell = 6.8;
    const origin = 19.4;
    const modules = grid
      .flatMap((row, y) => [...row].map((mark, x) => (mark === 'x' ? `<rect x="${+(origin + x * cell + 0.6).toFixed(2)}" y="${+(origin + y * cell + 0.6).toFixed(2)}" width="5.6" height="5.6" rx="1.9"/>` : '')))
      .join('');
    const finder = (x, y) =>
      `<path fill-rule="evenodd" d="M${x + 6} ${y}h8.4a6 6 0 0 1 6 6v8.4a6 6 0 0 1-6 6H${x + 6}a6 6 0 0 1-6-6V${y + 6}a6 6 0 0 1 6-6Zm.8 4.4a2.4 2.4 0 0 0-2.4 2.4v6.8a2.4 2.4 0 0 0 2.4 2.4h6.8a2.4 2.4 0 0 0 2.4-2.4V${y + 6.8}a2.4 2.4 0 0 0-2.4-2.4Z"/>` +
      `<rect x="${x + 6.6}" y="${y + 6.6}" width="7.2" height="7.2" rx="2.4"/>`;
    const code = modules + finder(origin, origin) + finder(origin + 6 * cell, origin) + finder(origin, origin + 6 * cell);
    return {
      background: ['#ffffff', '#dadde4'],
      defs: across('qm', dark ? ['#ffffff', '#d7d9e0'] : ['#2c2c3a', '#0b0b12'], 0, 19, 0, 81),
      art: shadow(code, 1.6, 0.18, 's') + `<g fill="url(#@qm)">${code}</g>`,
    };
  },
  'uuid-generator': () => {
    const ridges =
      'M40.5 76c2.8-5.2 4.3-11.2 4.3-17.6V52a5.2 5.2 0 0 1 10.4 0v4.8' +
      'M55.2 64.5c-.5 5.6-2 10.8-4.4 15.5' +
      'M34.2 68c.9-3.1 1.4-6.4 1.4-9.8V52a14.4 14.4 0 0 1 25-9.8' +
      'M64.1 50c.2 1 .3 2 .3 3v5.2c0 7.9-1.8 15.4-5 22' +
      'M27 60.4V52a23 23 0 0 1 37.4-17.9' +
      'M70.4 41.2A22.9 22.9 0 0 1 73 52v5' +
      'M72.6 66.5c-.6 3.2-1.5 6.3-2.6 9.3' +
      'M22.4 38.5A31.6 31.6 0 0 1 72.8 29.6' +
      'M30 21.4a31.5 31.5 0 0 1 32.5-1.2';
    return {
      background: ['#3e2f99', '#120a3a'],
      defs: across('ug', ['#7df9ff', '#b388ff', '#ff6ec7'], 20, 18, 80, 82),
      art:
        `<circle cx="50" cy="50" r="34" fill="#7c5cff" opacity=".35" filter="url(#@g)"/>` +
        `<g transform="translate(2.5 0)"><path d="${ridges}" fill="none" stroke="url(#@ug)" stroke-width="5" stroke-linecap="round" opacity=".5" filter="url(#@s)"/>` +
        `<path d="${ridges}" fill="none" stroke="url(#@ug)" stroke-width="3.8" stroke-linecap="round"/></g>`,
    };
  },
  'device-info': () => {
    const lid = '<rect x="13" y="22" width="60" height="41" rx="5"/>';
    const base = '<path d="M6 63h74v2.5c0 2.5-2 4.5-4.5 4.5h-65A4.5 4.5 0 0 1 6 65.5Z"/>';
    const phone = '<rect x="62" y="38" width="25" height="46" rx="6.5"/>';
    return {
      background: ['#d3dcea', '#7d8ca3'],
      defs:
        linear('ds', ['#64d2ff', '#5e5ce6', '#bf5af2']) +
        linear('dp', ['#ffd60a', '#ff9f0a', '#ff375f']) +
        linear('db', ['#f5f5f7', '#b9bdc6']),
      art:
        shadow(lid + base, 3, 0.3) +
        `<g fill="#1c1c1e">${lid}</g>` +
        `<rect x="16" y="25" width="54" height="35" rx="2" fill="url(#@ds)"/>` +
        `<path d="M16 49c10-8 22-2 30-8s16-4 24-1v18a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2Z" fill="#fff" opacity=".18"/>` +
        `<g fill="url(#@db)">${base}</g>` +
        `<rect x="36" y="63" width="14" height="2.2" rx="1.1" fill="#8e8e93"/>` +
        shadow(phone, 3, 0.4) +
        `<g fill="#1c1c1e">${phone}</g>` +
        `<rect x="64.5" y="40.5" width="20" height="41" rx="4.5" fill="url(#@dp)"/>` +
        `<rect x="70.5" y="43" width="8" height="2.6" rx="1.3" fill="#1c1c1e"/>` +
        `<rect x="62.5" y="38.5" width="24" height="45" rx="6" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>`,
    };
  },
  // the hands show the time the icon was drawn, as a home screen clock does
  clock: () => {
    const now = new Date();
    const minutes = now.getMinutes() + now.getSeconds() / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    const hand = (angle, length, tail, width, colour) =>
      `<path d="M50 ${50 + tail}V${50 - length}" transform="rotate(${+angle.toFixed(2)} 50 50)" stroke="${colour}" stroke-width="${width}" stroke-linecap="round"/>`;
    const ticks = Array.from({ length: 60 }, (unused, index) =>
      index % 5 ? `<path d="M50 14.5v2.2" transform="rotate(${index * 6} 50 50)" stroke-width=".9"/>` : `<path d="M50 14.5v4.4" transform="rotate(${index * 6} 50 50)" stroke-width="1.8"/>`,
    ).join('');
    return {
      live: true,
      background: ['#3a3a3c', '#050505'],
      defs: radial('cf', ['#ffffff', ['#fafafa', 1, 0.8], '#e5e5ea'], 0.5, 0.4, 0.6),
      art:
        shadow('<circle cx="50" cy="50" r="39"/>', 2.5, 0.6) +
        `<circle cx="50" cy="50" r="39" fill="url(#@cf)"/>` +
        `<g stroke="#8e8e93" stroke-linecap="round">${ticks}</g>` +
        `<g fill="none" stroke="#1c1c1e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${figures('12', 43.5, 22, 8.5, 2.2)}${figures('3', 70.8, 45.8, 8.5)}${figures('6', 47.4, 69.5, 8.5)}${figures('9', 24.4, 45.8, 8.5)}</g>` +
        shadow(hand(hours * 30, 17, 0, 4, '#000') + hand(minutes * 6, 28, 0, 2.8, '#000'), 1.2, 0.25, 's') +
        hand(hours * 30, 17, 0, 4, '#1c1c1e') +
        hand(minutes * 6, 28, 0, 2.8, '#1c1c1e') +
        hand(now.getSeconds() * 6, 31, 7, 1.1, '#ff9500') +
        `<circle cx="50" cy="50" r="2.6" fill="#ff9500"/><circle cx="50" cy="50" r="1" fill="#fff"/>`,
    };
  },
  // today's weekday and date, in the language the page is showing
  calendar: ({ dark }) => {
    const today = new Date();
    const locale = globalThis.document?.documentElement?.lang || undefined;
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(today).replace('.', '');
    const day = String(today.getDate());
    const size = 36;
    const width = day.length * 10 * (size / 16) + (day.length - 1) * 3 * (size / 16);
    return {
      live: true,
      background: ['#ffffff', '#e9eaee'],
      art:
        `<text x="50" y="30" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" font-size="15" font-weight="600" fill="${dark ? '#ff453a' : '#ff3b30'}">${weekday}</text>` +
        `<g fill="none" stroke="${dark ? '#f2f2f7' : '#1c1c1e'}" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round">${figures(day, +(50 - width / 2).toFixed(2), 40, size, 3)}</g>`,
    };
  },
  'metro-maps': ({ dark }) => {
    const tone = tones(dark);
    const lines = [
      ['#ff3b30', 'M8 30h22l40 40h22'],
      ['#0a84ff', 'M8 58h84'],
      ['#34c759', 'M36 8v30c0 6 2.4 9 6 12.5l8 7.5c4 3.8 6 6.5 6 12v22'],
      ['#ffcc00', 'M70 8v22L50 50'],
    ];
    const stops = [[70, 30], [22, 58], [80, 58], [56, 82], [80, 70]];
    return {
      background: ['#ffffff', '#e4e7ec'],
      art:
        `<path d="M0 72c18-4 30 4 48 2s34-10 52-6v32H0Z" fill="${dark ? '#1f3a5c' : '#cfe8ff'}" opacity=".7"/>` +
        lines.map(([colour, d]) => `<path d="${d}" fill="none" stroke="${dark ? '#2a2a2e' : '#fff'}" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${colour}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`).join('') +
        stops.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${tone.paper}"/>`).join('') +
        `<rect x="42" y="48" width="24" height="12" rx="6" transform="rotate(45 54 54)" fill="${tone.paper}" stroke="${tone.ink}" stroke-width="2.4"/>` +
        `<circle cx="36" cy="36" r="4.2" fill="${tone.paper}" stroke="${tone.ink}" stroke-width="2.2"/>`,
    };
  },
  'true-size': ({ dark }) => {
    const land = dark ? '#40638a' : '#eaf5ff';
    return {
      background: dark ? ['#15365c', '#06132a'] : ['#5fbfff', '#1463cf'],
      defs: linear('tl', ['#ffd66b', '#ff8a00']),
      art:
        `<path d="M0 38h100M0 81h100M25 0v100M50 0v100M75 0v100" stroke="#fff" stroke-opacity=".1" stroke-width="1"/>` +
        `<path d="M0 60h100" stroke="#fff" stroke-opacity=".3" stroke-width="1" stroke-dasharray="2.4 2.4"/>` +
        `<path d="${WORLD}" fill="${land}" stroke="${land}" stroke-width="1.1" stroke-linejoin="round"/>` +
        `<path d="${GREENLAND}" fill="#fff" fill-opacity="${dark ? 0.22 : 0.5}" stroke="${dark ? '#ffffff' : '#0a63c9'}" stroke-width="1.1" stroke-dasharray="2.2 1.6" stroke-linejoin="round"/>` +
        `<path d="M46 33c6.4 3.6 9.6 8.6 10.4 14.6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="m52.4 44.4 4 3.6 2.6-4.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<g transform="translate(57.2 59) scale(.42) translate(-36.2 -20.6)">` +
        shadow(`<path d="${GREENLAND}"/>`, 4, 0.4) +
        `<path d="${GREENLAND}" fill="url(#@tl)" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></g>`,
    };
  },
  portfolio: () => {
    const segments = [['#30d158', 0, 46], ['#64d2ff', 48, 26], ['#ffd60a', 76, 14], ['#bf5af2', 92, 6]];
    const arc = (colour, start, length, width = 13) =>
      `<circle cx="50" cy="50" r="27" fill="none" stroke="${colour}" stroke-width="${width}" pathLength="100" stroke-dasharray="${length} 100" stroke-dashoffset="${-start}" transform="rotate(-90 50 50)"/>`;
    return {
      background: ['#1b2436', '#05080f'],
      art:
        `<circle cx="50" cy="50" r="30" fill="#30d158" opacity=".22" filter="url(#@g)"/>` +
        `<circle cx="50" cy="50" r="27" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="13"/>` +
        segments.map(([colour, start, length]) => arc(colour, start, length)).join('') +
        `<circle cx="50" cy="50" r="33.5" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width=".8"/>` +
        `<path d="M37 57.5 45 49.5l6 5 11.5-12" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M56.5 42.5h6v6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  notes: () => {
    const note = '<path d="M20 17h60a3 3 0 0 1 3 3v46L66 83H20a3 3 0 0 1-3-3V20a3 3 0 0 1 3-3Z"/>';
    return {
      background: ['#fdfbf5', '#e2ddd0'],
      defs:
        linear('nn', ['#fff38f', '#ffd21f']) +
        linear('nf', ['#fff9c9', '#e6b800'], 0, 0, 1, 1),
      art:
        `<g transform="rotate(-5 50 50)">` +
        shadow(note, 3.5, 0.3) +
        `<g fill="url(#@nn)">${note}</g>` +
        `<path d="M17 28h66" stroke="#e0b200" stroke-width="1" opacity=".5"/>` +
        `<path d="M27 42c4-2.6 7 1.8 11-.4s6.4-2.6 10-.2 7.4 1.6 11-.6 6.6-1.2 9 .4M27 54c4.4-2 7.2 1.4 11.4-.6s6.6-1.8 10 .2 6 1.4 9.4-.6M27 66c3.6-2 6.4 1.2 9.8-.6s5.4-1.4 8.2.2" fill="none" stroke="#6b5200" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>` +
        shadow('<path d="M66 83V70a4 4 0 0 1 4-4h13Z"/>', 1, 0.25, 's') +
        `<path d="M66 83V70a4 4 0 0 1 4-4h13Z" fill="url(#@nf)"/>` +
        `</g>`,
    };
  },
  todo: ({ dark }) => {
    const tone = tones(dark);
    const rows = [[28, '#0a84ff', true, 40], [50, '#ff9f0a', true, 32], [72, null, false, 38]];
    return {
      background: ['#ffffff', '#e1e4ea'],
      defs: linear('tb', ['#5eb2ff', '#0a6fe0']) + linear('to', ['#ffc15e', '#ff8a00']),
      art: rows
        .map(([y, colour, done, width]) =>
          done
            ? shadow(`<circle cx="26" cy="${y}" r="9"/>`, 1.5, 0.25, 's') +
              `<circle cx="26" cy="${y}" r="9" fill="url(#@${colour === '#0a84ff' ? 'tb' : 'to'})"/>` +
              `<path d="m21.8 ${y}.2 3 3 5.4-6" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>` +
              `<rect x="42" y="${y - 2.5}" width="${width}" height="5" rx="2.5" fill="${tone.rule}"/>`
            : `<circle cx="26" cy="${y}" r="8" fill="${tone.paper}" stroke="${tone.rule}" stroke-width="2.4"/>` +
              `<rect x="42" y="${y - 2.8}" width="${width}" height="5.6" rx="2.8" fill="${tone.ink}"/>`,
        )
        .join('') + `<path d="M42 39h40M42 61h40" stroke="${tone.faint}" stroke-width="1"/>`,
    };
  },
  'image-converter': () => {
    const back = '<rect x="30" y="14" width="56" height="44" rx="7"/>';
    const photo = '<rect x="14" y="36" width="60" height="48" rx="8"/>';
    return {
      background: ['#ffd1e3', '#ff5c98'],
      defs:
        linear('is', ['#74c7ff', '#c9ecff']) +
        linear('im', ['#34c759', '#1f8f3d']) +
        linear('ib', ['#bf5af2', '#7d2ae8']),
      art:
        shadow(back, 2.5, 0.22) +
        `<g fill="#fff" opacity=".55">${back}</g>` +
        shadow(photo, 3, 0.3) +
        `<g fill="#fff">${photo}</g>` +
        `<clipPath id="@ic"><rect x="18" y="40" width="52" height="40" rx="4.5"/></clipPath>` +
        `<g clip-path="url(#@ic)"><rect x="18" y="40" width="52" height="40" fill="url(#@is)"/>` +
        `<circle cx="56" cy="51" r="5" fill="#ffd60a"/>` +
        `<path d="M18 80V70l12-12 10 10 7-6 23 18Z" fill="url(#@im)"/>` +
        `<path d="M30 58l5 5-4 2-5-3Z" fill="#fff" opacity=".85"/></g>` +
        `<g fill="#fff" stroke="#7d2ae8" stroke-width="1.6">${[[14, 36], [74, 36], [14, 84], [74, 84]].map(([x, y]) => `<rect x="${x - 3.2}" y="${y - 3.2}" width="6.4" height="6.4" rx="1.6"/>`).join('')}</g>`,
    };
  },
  'png-outline': ({ dark }) => {
    const tone = tones(dark);
    const shape = 'M50 20c17 9 26 24 22.5 40C70 72 61 80 50 80s-20-8-22.5-20C24 44 33 29 50 20Z';
    const nodes = [[50, 12], [81, 60], [50, 88], [19, 60]];
    return {
      background: ['#ffffff', '#e8eaef'],
      defs:
        `<pattern id="@pk" width="12.5" height="12.5" patternUnits="userSpaceOnUse"><rect width="6.25" height="6.25" fill="${dark ? '#48484e' : '#dfe1e6'}"/><rect x="6.25" y="6.25" width="6.25" height="6.25" fill="${dark ? '#48484e' : '#dfe1e6'}"/></pattern>` +
        linear('pl', ['#ff9f0a', '#ff375f', '#bf5af2']),
      art:
        `<rect width="100" height="100" fill="url(#@pk)" opacity=".7"/>` +
        shadow(`<path d="${shape}"/>`, 2.5, 0.25) +
        `<path d="${shape}" fill="url(#@pl)"/>` +
        `<path d="M50 12c21.5 11 33 29.6 29 49.5C76 76 64.5 88 50 88S24 76 21 61.5C17 41.6 28.5 23 50 12Z" fill="none" stroke="#0a84ff" stroke-width="2" stroke-dasharray="4 3"/>` +
        `<path d="M50 12h16M50 88H34" stroke="#0a84ff" stroke-width="1.2"/>` +
        `<circle cx="66" cy="12" r="2.4" fill="#0a84ff"/><circle cx="34" cy="88" r="2.4" fill="#0a84ff"/>` +
        nodes.map(([x, y]) => `<rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" rx="1.5" fill="${tone.paper}" stroke="#0a84ff" stroke-width="2"/>`).join(''),
    };
  },
  'gif-maker': () => {
    const frame = (x, y) => `<rect x="${x}" y="${y}" width="50" height="42" rx="7"/>`;
    return {
      background: ['#ff8a4c', '#d6204e'],
      defs: radial('gb', ['#fff27a', '#ffb800', '#ff7a00'], 0.35, 0.3, 0.7),
      art:
        `<g fill="#fff" opacity=".35">${frame(36, 14)}</g>` +
        `<g fill="#fff" opacity=".6">${frame(25, 26)}</g>` +
        shadow(frame(14, 38), 3, 0.3) +
        `<g fill="#fff">${frame(14, 38)}</g>` +
        `<path d="M20 72h38" stroke="#e5e5ea" stroke-width="2" stroke-linecap="round"/>` +
        `<g fill="#ffb800"><circle cx="66" cy="27" r="3" opacity=".5"/><circle cx="55" cy="42" r="4" opacity=".7"/></g>` +
        shadow('<circle cx="39" cy="58" r="8"/>', 1.5, 0.25, 's') +
        `<circle cx="39" cy="58" r="8" fill="url(#@gb)"/>` +
        `<ellipse cx="39" cy="70.5" rx="7" ry="1.4" fill="#000" opacity=".12"/>` +
        shadow('<circle cx="76" cy="72" r="12"/>', 2, 0.3) +
        `<circle cx="76" cy="72" r="12" fill="#1c1c1e"/>` +
        `<path d="M71 72a5 5 0 0 1 8.6-3.5M81 72a5 5 0 0 1-8.6 3.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>` +
        `<path d="m80.6 65.4-.6 3.6-3.6-.4M71.4 78.6l.6-3.6 3.6.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'media-converter': () => {
    const body = '<rect x="15" y="40" width="70" height="44" rx="8"/>';
    const stick = '<rect x="15" y="27" width="70" height="11" rx="3"/>';
    const stripes = [0, 1, 2, 3, 4].map((index) => `<path d="M${22 + index * 14} 27h7l-6 11h-7Z"/>`).join('');
    const bars = [6, 12, 20, 14, 26, 18, 10, 22, 16, 8, 12];
    return {
      background: ['#6ed8ff', '#5b3fe0'],
      defs: linear('mw', ['#ff9f0a', '#ff375f']) + linear('md', ['#3a3a40', '#141416']),
      art:
        shadow(body, 3, 0.35) +
        `<g fill="url(#@md)">${body}</g>` +
        `<g transform="rotate(-12 17 38)">${shadow(stick, 1.5, 0.3, 's')}<g fill="#1c1c1e">${stick}</g><clipPath id="@mc">${stick}</clipPath><g fill="#fff" clip-path="url(#@mc)">${stripes}</g></g>` +
        `<rect x="15" y="40" width="70" height="4" fill="#fff" opacity=".08"/>` +
        `<g fill="url(#@mw)">${bars.map((height, index) => `<rect x="${22.5 + index * 5.3}" y="${62 - height / 2}" width="3" height="${height}" rx="1.5"/>`).join('')}</g>`,
    };
  },
  'ai-chat': ({ dark }) => {
    const tone = tones(dark);
    const back = '<path d="M47 16h30a9 9 0 0 1 9 9v17a9 9 0 0 1-9 9h-2v8l-10-8H47a9 9 0 0 1-9-9V25a9 9 0 0 1 9-9Z"/>';
    const front = '<path d="M23 38h32a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H35l-11 9v-9h-1a10 10 0 0 1-10-10V48a10 10 0 0 1 10-10Z"/>';
    return {
      background: ['#f8f5ff', '#d9d0f2'],
      defs: aurora('aa'),
      art:
        shadow(back, 2.5, 0.18) +
        `<g fill="url(#@q)">${back}</g>` +
        `<g fill="${dark ? '#6e6880' : '#c7bfe0'}">${[54, 62, 70].map((x) => `<circle cx="${x}" cy="33.5" r="2.4"/>`).join('')}</g>` +
        `<g fill="url(#@aa)" opacity=".55" filter="url(#@f)" transform="translate(0 3)">${front}</g>` +
        `<g fill="url(#@aa)">${front}</g>` +
        `<g fill="none" stroke="url(#@e)" stroke-width=".9">${front}</g>` +
        `<g fill="#fff">${spark(39, 57, 20)}${spark(52.5, 47.5, 8)}</g>`,
    };
  },
  'ai-code': () => {
    const glyph = 'M34 33 17 50l17 17M66 33l17 17-17 17M56 25 44 75';
    return {
      background: ['#2e2748', '#0c0a18'],
      defs: aurora('ac'),
      art:
        `<path d="${glyph}" fill="none" stroke="url(#@ac)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".55" filter="url(#@f)"/>` +
        `<path d="${glyph}" fill="none" stroke="url(#@ac)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<g fill="#fff">${spark(77, 23, 16)}${spark(88, 35, 7)}</g>`,
    };
  },
  'ai-writer': () => {
    const nib = '<path fill-rule="evenodd" d="M38.5 26h23a3.5 3.5 0 0 1 3.5 3.5V41l-5.5 23L50 86l-9.5-22L35 41V29.5a3.5 3.5 0 0 1 3.5-3.5Zm11.5 25a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z"/>';
    return {
      background: ['#f4f8ff', '#cddaf3'],
      defs: aurora('aw') + linear('ak', ['#4a4a55', '#1c1c22']),
      art:
        `<path d="M14 84c8-6 14-6 20-2s12 3 18-2" fill="none" stroke="url(#@aw)" stroke-width="3.6" stroke-linecap="round"/>` +
        `<g transform="rotate(38 50 52) translate(0 -4)">` +
        shadow(nib, 3, 0.3) +
        `<g fill="url(#@aw)">${nib}</g>` +
        `<path d="M50 59.4V85" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>` +
        `<rect x="33" y="13" width="34" height="14" rx="4" fill="url(#@ak)"/>` +
        `<path d="M36 16h28" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".35"/>` +
        `</g>` +
        `<g fill="#8a6bff">${spark(76, 74, 14)}${spark(86, 62, 6)}</g>`,
    };
  },
  'ai-translate': ({ dark }) => {
    const tone = tones(dark);
    const left = '<path d="M22 14h30a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H34l-10 8v-8h-2a10 10 0 0 1-10-10V24a10 10 0 0 1 10-10Z"/>';
    const right = '<path d="M48 42h30a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10h-2v8l-10-8H48a10 10 0 0 1-10-10V52a10 10 0 0 1 10-10Z"/>';
    return {
      background: ['#effbff', '#c2e1ef'],
      defs: aurora('at'),
      art:
        shadow(left, 2.5, 0.2) +
        `<g fill="url(#@q)">${left}</g>` +
        `<path d="M27 45.5 37 22l10 23.5M30.6 37h12.8" fill="none" stroke="${tone.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<g fill="url(#@at)" opacity=".5" filter="url(#@f)" transform="translate(0 3)">${right}</g>` +
        `<g fill="url(#@at)">${right}</g>` +
        `<g fill="none" stroke="url(#@e)" stroke-width=".9">${right}</g>` +
        `<path d="M63 48.5v4.5M51 55.5h24M57 55.5c1.5 8 6 14 16 19M69 55.5c-1.5 8-6 14-16 19" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'ai-regex': () => {
    const star = [0, 60, 120].map((angle) => `<path d="M58 32v28" transform="rotate(${angle} 58 46)"/>`).join('');
    const glyphs = `<circle cx="33" cy="69" r="7" stroke="none"/><g fill="none" stroke-width="8" stroke-linecap="round">${star}</g>`;
    return {
      background: ['#2e2748', '#0c0a18'],
      defs: aurora('ar'),
      art:
        `<g fill="url(#@ar)" stroke="url(#@ar)" opacity=".55" filter="url(#@f)">${glyphs}</g>` +
        `<g fill="url(#@ar)" stroke="url(#@ar)">${glyphs}</g>` +
        `<g fill="#fff">${spark(80, 73, 15)}${spark(88, 60, 6)}</g>`,
    };
  },
  'dns-lookup': ({ dark }) => {
    const rows = [
      [22, 'A', '#0a84ff', 30],
      [40, 'MX', '#ff9f0a', 22],
      [58, 'TXT', '#30d158', 26],
    ];
    const mono = `font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace"`;
    const tone = tones(dark);
    return {
      background: ['#6a8dff', '#3b2fd0'],
      defs:
        radial('dl', [['#ffffff', dark ? 0.28 : 0.42], ['#ffffff', 0.1]], 0.35, 0.3, 0.75) +
        linear('dr', [['#ffffff', 1], ['#ffffff', 0.55]]),
      art:
        rows
          .map(([y, label, colour, width]) => {
            const row = `<rect x="12" y="${y}" width="62" height="14" rx="7"/>`;
            return (
              shadow(row, 2, 0.22) +
              `<g fill="url(#@q)">${row}</g>` +
              `<rect x="15" y="${y + 3}" width="${label.length > 1 ? 17 : 11}" height="8" rx="4" fill="${colour}"/>` +
              `<text x="${15 + (label.length > 1 ? 8.5 : 5.5)}" y="${y + 9.1}" text-anchor="middle" ${mono} font-size="6.2" font-weight="700" fill="#fff">${label}</text>` +
              `<rect x="${label.length > 1 ? 36 : 30}" y="${y + 5.4}" width="${width}" height="3.2" rx="1.6" fill="${tone.rule}"/>`
            );
          })
          .join('') +
        `<path d="m68 68 16 16" stroke="#000" stroke-opacity=".25" stroke-width="9" stroke-linecap="round" filter="url(#@f)" transform="translate(0 3)"/>` +
        `<path d="m69.5 69.5 14 14" stroke="url(#@dr)" stroke-width="8" stroke-linecap="round"/>` +
        shadow('<circle cx="60" cy="60" r="18"/>', 3, 0.3) +
        `<circle cx="60" cy="60" r="18" fill="url(#@dl)"/>` +
        `<circle cx="60" cy="60" r="16.5" fill="none" stroke="#fff" stroke-width="4"/>` +
        `<path d="M48.5 53.5a13 13 0 0 1 9-7.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>`,
    };
  },
  'speed-test': () => {
    const ticks = Array.from({ length: 11 }, (unused, index) => {
      const angle = 150 + index * 24;
      return `<path d="M${50 + 34} 58h-${index % 5 ? 3 : 5.5}" transform="rotate(${angle} 50 58)"/>`;
    }).join('');
    return {
      background: ['#232a4d', '#070a1a'],
      defs: across('sg', ['#30d158', '#ffd60a', '#ff9f0a', '#ff375f'], 18, 0, 82, 0),
      art:
        `<path d="M22.3 74A32 32 0 1 1 77.7 74" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="8" stroke-linecap="round"/>` +
        `<path d="M22.3 74A32 32 0 1 1 71.4 34.2" fill="none" stroke="url(#@sg)" stroke-width="8" stroke-linecap="round" opacity=".6" filter="url(#@f)"/>` +
        `<path d="M22.3 74A32 32 0 1 1 71.4 34.2" fill="none" stroke="url(#@sg)" stroke-width="8" stroke-linecap="round"/>` +
        `<g stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" transform="translate(0 0) scale(1)">${ticks.replaceAll('M84 58', 'M76 58')}</g>` +
        shadow('<path d="M50 58 69 40"/>', 1.5, 0.5, 's') +
        `<path d="M50 58 69 40" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>` +
        `<circle cx="50" cy="58" r="6" fill="#fff"/><circle cx="50" cy="58" r="2.4" fill="#ff375f"/>` +
        `<rect x="38" y="76" width="24" height="5" rx="2.5" fill="#fff" opacity=".35"/>`,
    };
  },
  'barcode-generator': () => {
    const label = '<rect x="12" y="22" width="76" height="56" rx="9"/>';
    const widths = [2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 2, 1, 3, 1, 2];
    let x = 24.1;
    const bars = widths
      .map((width, index) => {
        const bar = index % 2 === 0 ? `<rect x="${x.toFixed(2)}" y="30" width="${(width * 1.3).toFixed(2)}" height="${index === 0 || index === widths.length - 2 ? 34 : 30}"/>` : '';
        x += width * 1.3 + 0.1;
        return bar;
      })
      .join('');
    return {
      background: ['#eef0f3', '#a9b0ba'],
      art:
        shadow(label, 3, 0.3) +
        `<g fill="#fff">${label}</g>` +
        `<g fill="#1c1c1e">${bars}</g>` +
        `<g fill="none" stroke="#3a3a3c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${figures('4006', 26.6, 66, 7, 3)}${figures('3812', 52, 66, 7, 3)}</g>` +
        `<rect x="6" y="45" width="88" height="3" rx="1.5" fill="#ff3b30" opacity=".5" filter="url(#@s)"/>` +
        `<rect x="6" y="45.6" width="88" height="1.8" rx=".9" fill="#ff453a"/>`,
    };
  },
  'timezone-planner': ({ dark }) => {
    const tone = tones(dark);
    const face = (x, y, r, fill, hand, hour, minute) =>
      shadow(`<circle cx="${x}" cy="${y}" r="${r}"/>`, 2.5, 0.28) +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>` +
      `<circle cx="${x}" cy="${y}" r="${r - 0.5}" fill="none" stroke="url(#@e)" stroke-width=".9"/>` +
      `<g stroke="${hand}" stroke-linecap="round"><path d="M${x} ${y}v-${r * 0.45}" transform="rotate(${hour} ${x} ${y})" stroke-width="${r / 6}"/><path d="M${x} ${y}v-${r * 0.68}" transform="rotate(${minute} ${x} ${y})" stroke-width="${r / 9}"/></g>` +
      `<circle cx="${x}" cy="${y}" r="${r / 10}" fill="${hand}"/>`;
    return {
      background: ['#8cf0ff', '#3d7eff'],
      defs: linear('zn', ['#3a3f6b', '#141733']) + linear('zs', ['#ffb35c', '#ff6a3d']) + linear('zd', dark ? ['#3c3c41', '#26262a'] : ['#ffffff', '#e9eef5']),
      art:
        face(21, 54, 14, 'url(#@zn)', '#fff', 60, 180) +
        face(79, 54, 14, 'url(#@zs)', '#fff', 200, 90) +
        face(50, 48, 21, 'url(#@zd)', tone.ink, 300, 0) +
        `<circle cx="16" cy="47" r="2" fill="#ffe680"/>` +
        `<rect x="26" y="78" width="48" height="5" rx="2.5" fill="#fff" opacity=".45"/><rect x="42" y="78" width="16" height="5" rx="2.5" fill="#fff"/>`,
    };
  },
  'currency-converter': () => {
    const coin = (x, y, r, rim, face, ink, glyph) =>
      shadow(`<circle cx="${x}" cy="${y}" r="${r}"/>`, 3, 0.35) +
      `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#@${rim})"/>` +
      `<circle cx="${x}" cy="${y}" r="${r * 0.8}" fill="url(#@${face})"/>` +
      `<circle cx="${x}" cy="${y}" r="${r * 0.8}" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width="1"/>` +
      `<path d="${glyph}" transform="translate(${x} ${y})" fill="none" stroke="${ink}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    return {
      background: ['#5ee27f', '#0e7a35'],
      defs:
        linear('cg', ['#ffe38a', '#d99a1e']) +
        linear('cf', ['#fff1b0', '#f2c24a']) +
        linear('cs', ['#f2f4f7', '#9aa3b0']) +
        linear('cw', ['#ffffff', '#d5dae2']),
      art:
        coin(36, 38, 22, 'cs', 'cw', '#5b6472', 'M7-6.5a7 7 0 1 0 0 13M-7-2.2h9M-7 2.8h9') +
        coin(64, 62, 24, 'cg', 'cf', '#8a5a00', 'M5.8-7.4C4.6-9.4 2.6-10.2 0-10.2c-3.6 0-6 1.8-6 4.6s2.4 3.8 6 4.7 6.4 2 6.4 5.2-2.6 5-6.4 5c-2.9 0-5.3-1.1-6.6-3.5M0-14v28'),
    };
  },
  'http-headers': ({ dark }) => {
    const tone = tones(dark);
    const card = '<rect x="12" y="16" width="62" height="62" rx="10"/>';
    const badge = '<circle cx="70" cy="70" r="17"/>';
    return {
      background: ['#ffb14a', '#d9480f'],
      defs: linear('hg', ['#5ee27f', '#16a34a']),
      art:
        shadow(card, 3, 0.28) +
        `<g fill="url(#@q)">${card}</g>` +
        [26, 38, 50, 62]
          .map((y, index) => `<rect x="20" y="${y}" width="${[14, 18, 12, 16][index]}" height="4.4" rx="2.2" fill="#ff8a00" opacity=".85"/><rect x="${[37, 41, 35, 39][index]}" y="${y}" width="${[28, 22, 30, 12][index]}" height="4.4" rx="2.2" fill="${tone.rule}"/>`)
          .join('') +
        shadow(badge, 2.5, 0.35) +
        `<g fill="url(#@hg)" stroke="#fff" stroke-width="2.5">${badge}</g>` +
        `<path d="M62.5 78.5 70 60l7.5 18.5M65.2 72h9.6" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'csv-studio': ({ dark }) => {
    const tone = tones(dark);
    const sheet = '<rect x="12" y="18" width="76" height="64" rx="10"/>';
    return {
      background: ['#3ddc84', '#0b7a43'],
      defs: linear('cv', ['#34c759', '#1f9d48']),
      art:
        shadow(sheet, 3, 0.3) +
        `<g fill="url(#@q)">${sheet}</g>` +
        `<clipPath id="@cc">${sheet}</clipPath>` +
        `<g clip-path="url(#@cc)"><rect x="12" y="18" width="76" height="15" fill="url(#@cv)"/><rect x="12" y="33" width="15" height="49" fill="${dark ? '#2a2a2e' : '#f2f2f7'}"/></g>` +
        `<path d="M27 18v64M50 18v64M69 18v64M12 33h76M12 49h76M12 65h76" stroke="${tone.faint}" stroke-width="1"/>` +
        `<path d="M27 18v15M50 18v15M69 18v15" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>` +
        [[41], [57], [73]].map(([y]) => `<rect x="31" y="${y - 1.8}" width="${y === 57 ? 10 : 14}" height="3.6" rx="1.8" fill="${tone.soft}"/><rect x="54" y="${y - 1.8}" width="${y === 41 ? 8 : 11}" height="3.6" rx="1.8" fill="${tone.soft}"/>`).join('') +
        `<rect x="49.5" y="48.5" width="20" height="17" rx="1.5" fill="#0a84ff" fill-opacity=".1" stroke="#0a84ff" stroke-width="2.2"/>` +
        `<circle cx="69.5" cy="65.5" r="2.4" fill="#0a84ff" stroke="#fff" stroke-width="1"/>` +
        `<g fill="#fff" opacity=".9"><rect x="33" y="23.7" width="11" height="3.6" rx="1.8"/><rect x="54" y="23.7" width="10" height="3.6" rx="1.8"/><rect x="73" y="23.7" width="9" height="3.6" rx="1.8"/></g>`,
    };
  },
  'mock-data': ({ dark }) => {
    const tone = tones(dark);
    const card = '<rect x="-24" y="-17" width="48" height="34" rx="7"/>';
    const person = (colour) =>
      `<circle cx="-12" cy="-3" r="8" fill="${colour}"/><circle cx="-12" cy="-5.2" r="3" fill="#fff"/><path d="M-17.4 2.6c1.2-2.4 3-3.6 5.4-3.6s4.2 1.2 5.4 3.6a8 8 0 0 1-10.8 0Z" fill="#fff"/>` +
      `<rect x="0" y="-8" width="17" height="4" rx="2" fill="${tone.ink}"/><rect x="0" y="0" width="12" height="3.4" rx="1.7" fill="${tone.rule}"/><rect x="0" y="7" width="15" height="3.4" rx="1.7" fill="${tone.rule}"/>`;
    return {
      background: ['#ff7ad9', '#7b3ff2'],
      art:
        `<g transform="translate(55 33) rotate(9)">${shadow(card, 2, 0.2)}<g fill="${tone.paper}" opacity=".6">${card}</g></g>` +
        `<g transform="translate(47 45) rotate(-4)">${shadow(card, 2.5, 0.25)}<g fill="${tone.paper}" opacity=".85">${card}</g></g>` +
        `<g transform="translate(41 59) rotate(-10)">${shadow(card, 3, 0.3)}<g fill="url(#@q)">${card}</g>${person('#0a84ff')}</g>` +
        die(74, 73, 20, 14, [[-1, -1], [0, 0], [1, 1]]),
    };
  },
  'json-schema': () => {
    const grid = Array.from({ length: 9 }, (unused, index) => `M${10 + index * 10} 0v100M0 ${10 + index * 10}h100`).join('');
    const sheet = '<path d="M22 14h36l18 18v50a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V20a6 6 0 0 1 6-6Z"/>';
    const badge = '<circle cx="72" cy="72" r="15"/>';
    return {
      background: ['#3a8ee6', '#0d3b80'],
      art:
        `<path d="${grid}" stroke="#fff" stroke-opacity=".08" stroke-width="1"/>` +
        shadow(sheet, 3, 0.3) +
        `<g fill="#fff" fill-opacity=".12" stroke="#fff" stroke-width="2" stroke-linejoin="round">${sheet}</g>` +
        `<path d="M58 14v12a6 6 0 0 0 6 6h12" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>` +
        `<path d="M31 42h-2a3 3 0 0 0-3 3v5c0 1.6-1 2.8-2.4 3.1C25 53.4 26 54.6 26 56.2v5a3 3 0 0 0 3 3h2M49 42h2a3 3 0 0 1 3 3v5c0 1.6 1 2.8 2.4 3.1-1.4.3-2.4 1.5-2.4 3.1v5a3 3 0 0 1-3 3h-2" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M35 49h10M35 57h7" stroke="#9fd0ff" stroke-width="2.6" stroke-linecap="round"/>` +
        `<path d="M24 26h22" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="4 3"/>` +
        shadow(badge, 2, 0.35) +
        `<circle cx="72" cy="72" r="15" fill="#30d158" stroke="#fff" stroke-width="2.4"/>` +
        `<path d="m65.5 72.5 4.5 4.5 8.5-9" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'icon-studio': () => {
    const circle = '<circle cx="32" cy="32" r="14"/>';
    const square = '<rect x="54" y="18" width="28" height="28" rx="8"/>';
    const triangle = '<path d="M32 55.5a3.5 3.5 0 0 1 6 0l12.8 22.5a3.5 3.5 0 0 1-3 5.3H22.2a3.5 3.5 0 0 1-3-5.3Z" transform="translate(-6 -2)"/>';
    const star = '<path d="m68 52 4.4 9.4 10.3 1.2-7.6 7 2.1 10.2-9.2-5.2-9.2 5.2 2.1-10.2-7.6-7 10.3-1.2Z"/>';
    return {
      background: ['#ffffff', '#dde1e8'],
      defs:
        linear('ib', ['#6ac4ff', '#0a6fe0']) +
        linear('ip', ['#ff8ab4', '#ff2d6f']) +
        linear('io', ['#ffcf5c', '#ff8a00']) +
        linear('ig', ['#6ef08f', '#1fb14b']),
      art:
        `<path d="M50 12v76M12 50h76" stroke="#c7ccd6" stroke-width="1" stroke-dasharray="2.5 2.5"/>` +
        shadow(circle, 2, 0.22) + `<g fill="url(#@ib)">${circle}</g>` +
        shadow(triangle, 2, 0.22) + `<g fill="url(#@io)">${triangle}</g>` +
        shadow(star, 2, 0.22) + `<g fill="url(#@ig)">${star}</g>` +
        `<g transform="rotate(-10 68 32) translate(2 -2)">${shadow(square, 5, 0.3)}<g fill="url(#@ip)">${square}</g>` +
        `<rect x="51.5" y="15.5" width="33" height="33" rx="10" fill="none" stroke="#0a84ff" stroke-width="1.6"/>` +
        `${[[51.5, 15.5], [84.5, 15.5], [51.5, 48.5], [84.5, 48.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="#fff" stroke="#0a84ff" stroke-width="1.4"/>`).join('')}</g>`,
    };
  },
  'favicon-generator': ({ dark }) => {
    const tone = tones(dark);
    const frame = '<rect x="10" y="18" width="80" height="66" rx="10"/>';
    const mark = (x, y, size) =>
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${+(size * 0.26).toFixed(2)}" fill="url(#@fv)"/>` +
      `<g fill="#fff">${spark(x + size / 2, y + size / 2, +(size * 0.62).toFixed(2))}</g>`;
    return {
      background: ['#ffe066', '#ff8a00'],
      defs: linear('fv', ['#8a7dff', '#4b2fd6']),
      art:
        shadow(frame, 3, 0.3) +
        `<g fill="url(#@q)">${frame}</g>` +
        `<clipPath id="@fc">${frame}</clipPath>` +
        `<rect x="10" y="18" width="80" height="17" fill="${dark ? '#232327' : '#e9e9ee'}" clip-path="url(#@fc)"/>` +
        `<path d="M18 35v-7a5 5 0 0 1 5-5h26a5 5 0 0 1 5 5v7Z" fill="${tone.paper}"/>` +
        mark(22, 26, 6) +
        `<rect x="31" y="27.4" width="17" height="3.2" rx="1.6" fill="${tone.rule}"/>` +
        `<g fill="${tone.rule}"><circle cx="80" cy="26.5" r="1.8"/><circle cx="74" cy="26.5" r="1.8"/></g>` +
        shadow('<rect x="19" y="44" width="30" height="30" rx="7.8"/>', 2, 0.22) +
        mark(19, 44, 30) +
        shadow('<rect x="55" y="54" width="20" height="20" rx="5.2"/>', 1.5, 0.2) +
        mark(55, 54, 20) +
        mark(79, 64, 10).replace('<rect x="79"', '<rect x="78"'),
    };
  },
  'function-plotter': ({ dark }) => {
    const tone = tones(dark);
    const grid = Array.from({ length: 9 }, (unused, index) => `M${10 + index * 10} 0v100M0 ${10 + index * 10}h100`).join('');
    const curve = 'M8.0 50.0L10.1 45.7L12.2 41.6L14.3 37.8L16.4 34.4L18.5 31.7L20.6 29.7L22.7 28.4L24.8 28.0L26.9 28.4L29.0 29.7L31.1 31.7L33.2 34.4L35.3 37.8L37.4 41.6L39.5 45.7L41.6 50.0L43.7 54.3L45.8 58.4L47.9 62.2L50.0 65.6L52.1 68.3L54.2 70.3L56.3 71.6L58.4 72.0L60.5 71.6L62.6 70.3L64.7 68.3L66.8 65.6L68.9 62.2L71.0 58.4L73.1 54.3L75.2 50.0L77.3 45.7L79.4 41.6L81.5 37.8L83.6 34.4L85.7 31.7L87.8 29.7L89.9 28.4L92.0 28.0';
    return {
      background: ['#ffffff', '#e2e6ed'],
      defs: across('fp', ['#0a84ff', '#bf5af2', '#ff375f'], 8, 0, 92, 0),
      art:
        `<path d="${grid}" stroke="${dark ? '#3e3e44' : '#d5dbe5'}" stroke-width=".8"/>` +
        `<path d="M8 50h84M22 12v76" stroke="${tone.ink}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M92 50l-5-3.2v6.4ZM22 12l-3.2 5h6.4Z" fill="${tone.ink}"/>` +
        `<path d="M10 80 88 24" stroke="#ff9f0a" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>` +
        `<path d="${curve}" fill="none" stroke="url(#@fp)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".35" filter="url(#@f)"/>` +
        `<path d="${curve}" fill="none" stroke="url(#@fp)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
        shadow('<circle cx="29.0" cy="29.7" r="5"/>', 1, 0.25, 's') +
        `<circle cx="29.0" cy="29.7" r="5" fill="${tone.paper}" stroke="#0a84ff" stroke-width="2.6"/>`,
    };
  },
  statistics: () => {
    const heights = [6, 14, 28, 44, 50, 42, 26, 13, 6];
    const bars = heights.map((height, index) => `<rect x="${14.5 + index * 8}" y="${78 - height}" width="6.4" height="${height}" rx="2"/>`).join('');
    return {
      background: ['#3cc3da', '#0b5566'],
      defs: linear('sb', [['#fff', 0.95], ['#fff', 0.6]]) + across('sl', ['#ffe45c', '#ff9f0a'], 0, 26, 0, 78),
      art:
        shadow(bars, 2, 0.22) +
        `<g fill="url(#@sb)">${bars}</g>` +
        `<path d="M50 20v60" stroke="#fff" stroke-width="1.4" stroke-dasharray="3 3" opacity=".7"/>` +
        `<path d="M10.0 74.6L11.9 74.0L13.8 73.3L15.7 72.3L17.6 71.1L19.5 69.7L21.4 67.9L23.3 65.7L25.2 63.2L27.1 60.3L29.0 57.2L31.0 53.7L32.9 50.0L34.8 46.2L36.7 42.3L38.6 38.6L40.5 35.1L42.4 32.1L44.3 29.5L46.2 27.6L48.1 26.4L50.0 26.0L51.9 26.4L53.8 27.6L55.7 29.5L57.6 32.0L59.5 35.1L61.4 38.6L63.3 42.3L65.2 46.2L67.1 50.0L69.0 53.7L71.0 57.1L72.9 60.3L74.8 63.2L76.7 65.7L78.6 67.8L80.5 69.7L82.4 71.1L84.3 72.3L86.2 73.3L88.1 74.0L90.0 74.6" fill="none" stroke="#1c1c1e" stroke-opacity=".25" stroke-width="5" stroke-linecap="round" filter="url(#@s)" transform="translate(0 1.5)"/>` +
        `<path d="M10.0 74.6L11.9 74.0L13.8 73.3L15.7 72.3L17.6 71.1L19.5 69.7L21.4 67.9L23.3 65.7L25.2 63.2L27.1 60.3L29.0 57.2L31.0 53.7L32.9 50.0L34.8 46.2L36.7 42.3L38.6 38.6L40.5 35.1L42.4 32.1L44.3 29.5L46.2 27.6L48.1 26.4L50.0 26.0L51.9 26.4L53.8 27.6L55.7 29.5L57.6 32.0L59.5 35.1L61.4 38.6L63.3 42.3L65.2 46.2L67.1 50.0L69.0 53.7L71.0 57.1L72.9 60.3L74.8 63.2L76.7 65.7L78.6 67.8L80.5 69.7L82.4 71.1L84.3 72.3L86.2 73.3L88.1 74.0L90.0 74.6" fill="none" stroke="url(#@sl)" stroke-width="4" stroke-linecap="round"/>` +
        `<rect x="12" y="79" width="76" height="3" rx="1.5" fill="#fff" opacity=".85"/>`,
    };
  },
  'rdap-lookup': ({ dark }) => {
    const tone = tones(dark);
    const tag = '<path fill-rule="evenodd" d="M30 30h46a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H30L14 58.5a8 8 0 0 1 0-13Zm-4 16.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/>';
    return {
      background: ['#b19bff', '#5227c4'],
      defs: radial('rg', ['#7fd4ff', '#1e88e5', '#0b4fb0'], 0.35, 0.3, 0.75),
      art:
        `<path d="M26.8 57.6C16 44 14 28 22 16" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>` +
        `<g transform="rotate(-14 50 52)">` +
        shadow(tag, 3, 0.3) +
        `<g fill="url(#@q)">${tag}</g>` +
        `<g fill="${dark ? '#b19bff' : '#5227c4'}">${[40, 47.5, 55].map((x) => `<circle cx="${x}" cy="45" r="2.6"/>`).join('')}</g>` +
        `<rect x="61" y="42.5" width="16" height="5" rx="2.5" fill="${dark ? '#b19bff' : '#5227c4'}" opacity=".35"/>` +
        `<rect x="37" y="56" width="32" height="4" rx="2" fill="${tone.rule}"/><rect x="37" y="64" width="20" height="4" rx="2" fill="${tone.rule}"/>` +
        `</g>` +
        globe(72, 72, 14, 'url(#@rg)'),
    };
  },
  'websocket-tester': () => {
    const plug = '<path d="M12 42h14a12 12 0 0 1 12 12v0a12 12 0 0 1-12 12H12a4 4 0 0 1-4-4V46a4 4 0 0 1 4-4Z"/><rect x="37" y="46" width="11" height="4.2" rx="2.1"/><rect x="37" y="57.8" width="11" height="4.2" rx="2.1"/>';
    const socket = '<path d="M88 42H72a12 12 0 0 0-12 12v0a12 12 0 0 0 12 12h16a4 4 0 0 0 4-4V46a4 4 0 0 0-4-4Z"/>';
    return {
      background: ['#29d0ff', '#0850d6'],
      defs: across('wp', ['#ffffff', '#d6e6f5'], 0, 42, 0, 66),
      art:
        `<path d="M30 28h36M60 22l6 6-6 6" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M70 80H34M40 74l-6 6 6 6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M-2 54h14M88 54h14" stroke="#dce9f7" stroke-width="7"/>` +
        shadow(plug + socket, 2.5, 0.3) +
        `<g fill="url(#@wp)">${plug}${socket}</g>` +
        `<g fill="#0a4bb8" opacity=".55"><rect x="62" y="46" width="8" height="4.2" rx="2.1"/><rect x="62" y="57.8" width="8" height="4.2" rx="2.1"/></g>` +
        `<path d="M52.5 46.5 49 54h5l-3.5 7.5" fill="none" stroke="#ffd60a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'cert-decoder': () => {
    const paper = '<rect x="10" y="18" width="80" height="58" rx="7"/>';
    const petals = Array.from({ length: 16 }, (unused, index) => `<circle cx="${+(68 + 13 * Math.cos((index * Math.PI) / 8)).toFixed(2)}" cy="${+(66 + 13 * Math.sin((index * Math.PI) / 8)).toFixed(2)}" r="4.2"/>`).join('');
    return {
      background: ['#e6f2ff', '#98bde6'],
      defs:
        linear('cp', ['#fffdf6', '#f1e8d2']) +
        radial('cr', ['#ff6b5e', '#d7261e'], 0.4, 0.35, 0.7) +
        linear('ct', ['#e5352b', '#a3150e']),
      art:
        shadow(paper, 3, 0.28) +
        `<g fill="url(#@cp)">${paper}</g>` +
        `<rect x="15" y="23" width="70" height="48" rx="4" fill="none" stroke="#c9b27a" stroke-width="1.2"/>` +
        `<rect x="30" y="30" width="40" height="5" rx="2.5" fill="#8a6d2f"/>` +
        `<rect x="22" y="42" width="56" height="3.2" rx="1.6" fill="#d8c9a3"/><rect x="22" y="49" width="40" height="3.2" rx="1.6" fill="#d8c9a3"/>` +
        `<path d="M22 64h22" stroke="#8a6d2f" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M61 74 56 90l6-3 4 5 3-16M75 74l5 16-6-3-4 5-3-16" fill="url(#@ct)"/>` +
        shadow(petals, 1.5, 0.3) +
        `<g fill="url(#@cr)">${petals}</g>` +
        `<circle cx="68" cy="66" r="10" fill="#ff5147" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>` +
        `<path d="m63.5 66 3 3 6-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'typing-test': ({ dark }) => {
    const tone = tones(dark);
    const board = '<rect x="8" y="44" width="76" height="42" rx="9"/>';
    const keys = [0, 1, 2]
      .map((row) => Array.from({ length: 6 - (row === 2 ? 0 : 0) }, (unused, col) => `<rect x="${14 + col * 11.4 + (row === 1 ? 3 : 0)}" y="${50 + row * 10}" width="8.6" height="7.4" rx="2"/>`).slice(0, row === 2 ? 1 : 6).join(''))
      .join('');
    return {
      background: ['#ffb84d', '#ff3d6e'],
      defs: linear('tk', ['#3a3a40', '#1c1c1f']) + linear('tw', dark ? ['#5c5c63', '#44444a'] : ['#ffffff', '#e5e7ec']),
      art:
        `<g transform="translate(4 0)">` +
        shadow(board, 3, 0.35) +
        `<g fill="url(#@tk)">${board}</g>` +
        `<g fill="url(#@tw)">${keys}<rect x="28.8" y="70" width="42" height="7.4" rx="2"/><rect x="74" y="70" width="8.6" height="7.4" rx="2"/></g>` +
        `<rect x="48.2" y="60" width="8.6" height="7.4" rx="2" fill="#ff9f0a"/></g>` +
        shadow('<circle cx="70" cy="30" r="16"/>', 2.5, 0.3) +
        `<circle cx="70" cy="30" r="16" fill="url(#@q)"/>` +
        `<rect x="66.5" y="9" width="7" height="5" rx="1.5" fill="${tone.paper}"/>` +
        `<path d="M70 30 76 22" stroke="#ff3d6e" stroke-width="2.8" stroke-linecap="round"/>` +
        `<circle cx="70" cy="30" r="12" fill="none" stroke="#ff9f0a" stroke-width="2.4" pathLength="100" stroke-dasharray="62 100" transform="rotate(-90 70 30)" stroke-linecap="round"/>` +
        `<circle cx="70" cy="30" r="2" fill="${tone.ink}"/>` +
        `<path d="M14 24h26M20 32h24M26 40h14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
    };
  },
  chess: () => {
    const squares = Array.from({ length: 16 }, (unused, index) => ((Math.floor(index / 4) + index) % 2 ? `<rect x="${(index % 4) * 25}" y="${Math.floor(index / 4) * 25}" width="25" height="25"/>` : '')).join('');
    const knight =
      '<path d="M35 72c0-9 4-15.5 10.5-21.5-4.5.3-9.4 2-14 3.8-4.2 1.6-8-1.4-7.2-5.6.7-3.6 5-7.6 10.4-12 3.4-8.6 9-14.4 16.8-16.7l2.5-7 4 6.4C69.6 23 75.5 34.5 73.8 49c-1 8.6-5 15.4-8.3 23Z"/>' +
      '<rect x="31" y="71" width="38" height="6" rx="3"/><rect x="26" y="77" width="48" height="8" rx="4"/>';
    return {
      background: ['#f0d9b5', '#e2c79c'],
      defs: linear('kn', ['#ffffff', '#dcdce2']) + linear('kd', [['#b58863', 1], ['#9c7050', 1]]),
      art:
        `<g fill="url(#@kd)">${squares}</g>` +
        `<rect width="100" height="100" fill="url(#@t)"/>` +
        shadow(knight, 4, 0.4) +
        `<g fill="url(#@kn)" stroke="#2c2c2e" stroke-opacity=".35" stroke-width="1">${knight}</g>` +
        `<circle cx="50" cy="32" r="2.4" fill="#2c2c2e"/>` +
        `<path d="M58 20.5c8 3.6 12.4 12 12 24" fill="none" stroke="#b9b9c2" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M29 48.5c1.8-1.6 4.4-2.4 6.6-2.6" fill="none" stroke="#8e8e93" stroke-width="1.6" stroke-linecap="round"/>`,
    };
  },
  'game-sudoku': ({ dark }) => {
    const tone = tones(dark);
    const board = '<rect x="14" y="14" width="72" height="72" rx="12"/>';
    const at = (col) => 14 + col * 24;
    const digit = (value, col, row, colour) =>
      `<g fill="none" stroke="${colour}" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round">${figures(value, at(col) + 8.4, at(row) + 5.6, 12.8)}</g>`;
    return {
      background: ['#6cc9ff', '#1b5fd9'],
      art:
        shadow(board, 3.5, 0.32) +
        `<g fill="url(#@q)">${board}</g>` +
        `<path d="M${at(1)} 18v64M${at(2)} 18v64M18 ${at(1)}h64M18 ${at(2)}h64" stroke="${tone.rule}" stroke-width="1.4"/>` +
        `<rect x="${at(2) + 2}" y="${at(1) + 2}" width="20" height="20" rx="4" fill="#0a84ff" opacity=".14"/>` +
        digit('5', 0, 0, tone.ink) +
        digit('3', 1, 1, tone.ink) +
        digit('9', 2, 0, tone.ink) +
        digit('7', 0, 2, tone.ink) +
        digit('4', 2, 1, dark ? '#64d2ff' : '#0a84ff') +
        `<g fill="${tone.soft}">${[[1, 2, 5, 5], [1, 2, 13, 5], [1, 2, 5, 13], [1, 2, 13, 18]].map(([col, row, dx, dy]) => `<circle cx="${at(col) + dx + 1}" cy="${at(row) + dy + 1}" r="1.6"/>`).join('')}</g>`,
    };
  },
  'game-tetris': () => {
    const size = 13;
    const left = 11;
    const top = 11;
    const pieces = [
      ['#ff375f', [[2, 0], [3, 0], [4, 0], [3, 1]]],
      ['#ffd60a', [[0, 4], [1, 4], [0, 5], [1, 5]]],
      ['#0a84ff', [[2, 3], [2, 4], [2, 5], [3, 5]]],
      ['#30d158', [[3, 4], [4, 4], [4, 5], [5, 5]]],
      ['#ff9f0a', [[1, 1], [1, 2], [1, 3], [0, 3]]],
      ['#bf5af2', [[5, 1], [5, 2], [5, 3], [5, 4]]],
    ];
    const cell = ([x, y], colour, dy = 0) => {
      const px = left + x * size;
      const py = top + y * size + dy;
      return (
        `<rect x="${px + 0.6}" y="${py + 0.6}" width="${size - 1.2}" height="${size - 1.2}" rx="2.6" fill="${colour}"/>` +
        `<rect x="${px + 0.6}" y="${py + 0.6}" width="${size - 1.2}" height="${size - 1.2}" rx="2.6" fill="url(#@tb)"/>` +
        `<rect x="${px + 3.4}" y="${py + 3.4}" width="${size - 6.8}" height="${size - 6.8}" rx="1.4" fill="#fff" opacity=".22"/>`
      );
    };
    return {
      background: ['#2a2657', '#08071a'],
      defs: linear('tb', [['#fff', 0.35], ['#fff', 0, 0.5], ['#000', 0.2]]),
      art:
        `<rect x="${left - 1}" y="${top - 1}" width="${6 * size + 2}" height="${6 * size + 2}" rx="6" fill="#fff" opacity=".04"/>` +
        pieces.map(([colour, cells], index) => cells.map((position) => cell(position, colour, index === 0 ? -4 : 0)).join('')).join(''),
    };
  },
  'game-memory': ({ dark }) => {
    const tone = tones(dark);
    const card = '<rect x="-17" y="-24" width="34" height="48" rx="6"/>';
    const star = '<path d="m0-12.5 3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L0 6.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2Z"/>';
    return {
      background: ['#ffa6d9', '#c21c86'],
      defs:
        linear('ms', ['#ffe066', '#ffab00']),
      art:
        [[31, 50, -12], [69, 50, 12]]
          .map(([x, y, angle]) => `<g transform="translate(${x} ${y}) rotate(${angle})">${shadow(card, 3.5, 0.32)}<g fill="url(#@q)">${card}</g>${shadow(star, 1.2, 0.2, 's')}<g fill="url(#@ms)">${star}</g></g>`)
          .join('') +
        `<g fill="#fff">${spark(50, 22, 11)}${spark(59, 16, 4.5)}</g>`,
    };
  },
  'game-word': () => {
    const rows = ['xyxgx', 'gyxgg', 'ggggg', '.....'];
    const colours = { x: '#5a5a5f', y: '#e5b93a', g: '#4caf50' };
    const size = 14;
    const gap = 3.2;
    const left = 50 - (5 * size + 4 * gap) / 2;
    const top = 50 - (4 * size + 3 * gap) / 2;
    return {
      background: ['#38383c', '#111113'],
      defs: linear('wt', [['#fff', 0.2], ['#fff', 0]]),
      art: rows
        .map((row, y) =>
          [...row]
            .map((mark, x) => {
              const px = +(left + x * (size + gap)).toFixed(2);
              const py = +(top + y * (size + gap)).toFixed(2);
              return mark === '.'
                ? `<rect x="${px + 0.6}" y="${py + 0.6}" width="${size - 1.2}" height="${size - 1.2}" rx="3" fill="none" stroke="#5a5a5f" stroke-width="1.4"/>`
                : `<rect x="${px}" y="${py}" width="${size}" height="${size}" rx="3.4" fill="${colours[mark]}"/><rect x="${px}" y="${py}" width="${size}" height="${size / 2}" rx="3.4" fill="url(#@wt)"/>`;
            })
            .join(''),
        )
        .join(''),
    };
  },
  'emoji-picker': () => ({
    background: ['#8fe0ff', '#3478f6'],
    defs:
      radial('ef', ['#fff27a', '#ffd21f', '#f5a200'], 0.42, 0.34, 0.72) +
      radial('ec', [['#ff7a8a', 0.55], ['#ff7a8a', 0]]),
    art:
      shadow('<circle cx="50" cy="50" r="34"/>', 3.5, 0.35) +
      `<circle cx="50" cy="50" r="34" fill="url(#@ef)"/>` +
      `<ellipse cx="50" cy="30" rx="20" ry="10" fill="#fff" opacity=".35" filter="url(#@s)"/>` +
      `<ellipse cx="39" cy="44" rx="4.2" ry="6" fill="#5b3a00"/><ellipse cx="61" cy="44" rx="4.2" ry="6" fill="#5b3a00"/>` +
      `<circle cx="40.2" cy="41.6" r="1.4" fill="#fff" opacity=".8"/><circle cx="62.2" cy="41.6" r="1.4" fill="#fff" opacity=".8"/>` +
      `<circle cx="30" cy="58" r="7" fill="url(#@ec)"/><circle cx="70" cy="58" r="7" fill="url(#@ec)"/>` +
      `<path d="M35.5 59c3 7.2 8 11 14.5 11s11.5-3.8 14.5-11c-4.6 1.6-9.4 2.4-14.5 2.4S40.1 60.6 35.5 59Z" fill="#5b3a00"/>` +
      `<path d="M41 65.4c2.6 2 5.6 3 9 3s6.4-1 9-3c-2.8.6-5.8.9-9 .9s-6.2-.3-9-.9Z" fill="#ff6b81"/>`,
  }),
  'unicode-tables': () => {
    const tiles = [['A', 14, 14, '#0a84ff'], ['Ω', 52, 14, '#bf5af2'], ['Ж', 14, 52, '#ff9f0a'], ['∑', 52, 52, '#30d158']];
    const font = `font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"`;
    return {
      background: ['#f3f4f8', '#c9ced8'],
      defs: tiles.map(([, , , colour], index) => linear(`u${index}`, [light(colour, 0.15), deep(colour, 0.1)])).join(''),
      art: tiles
        .map(([glyph, x, y], index) => {
          const tile = `<rect x="${x}" y="${y}" width="34" height="34" rx="9"/>`;
          return (
            shadow(tile, 2.5, 0.25) +
            `<g fill="url(#@u${index})" stroke="url(#@e)" stroke-width=".8">${tile}</g>` +
            `<text x="${x + 17}" y="${y + 25.5}" text-anchor="middle" ${font} font-size="23" font-weight="600" fill="#fff">${glyph}</text>`
          );
        })
        .join(''),
    };
  },
  'drum-kit': () => {
    const lit = { 0: '#ff375f', 4: '#ff9f0a', 5: '#ffd60a', 7: '#64d2ff', 2: '#bf5af2' };
    return {
      background: ['#34343a', '#0a0a0c'],
      defs: linear('dp', ['#4a4a50', '#2c2c30']) + linear('dl', [['#fff', 0.45], ['#fff', 0]]),
      art: Array.from({ length: 9 }, (unused, index) => {
        const x = 15 + (index % 3) * 24.5;
        const y = 15 + Math.floor(index / 3) * 24.5;
        const colour = lit[index];
        const pad = `<rect x="${x}" y="${y}" width="21" height="21" rx="5.5"/>`;
        return colour
          ? `<rect x="${x - 2}" y="${y - 2}" width="25" height="25" rx="7" fill="${colour}" opacity=".55" filter="url(#@f)"/>` +
              `<g fill="${colour}">${pad}</g><rect x="${x}" y="${y}" width="21" height="10" rx="5.5" fill="url(#@dl)"/>`
          : shadow(pad, 1.5, 0.5, 's') + `<g fill="url(#@dp)">${pad}</g><rect x="${x + 0.5}" y="${y + 0.5}" width="20" height="20" rx="5" fill="none" stroke="#fff" stroke-opacity=".08"/>`;
      }).join(''),
    };
  },
  'api-spec': ({ dark }) => {
    const tone = tones(dark);
    const rows = [['#0a84ff', 21, 30], ['#30d158', 40.5, 22], ['#ff9f0a', 60, 26], ['#ff453a', 79.5, 18]];
    return {
      background: ['#2c3d6e', '#0b1226'],
      art: rows
        .map(([colour, y, width], index) => {
          const row = `<rect x="12" y="${y - 8.5}" width="76" height="17" rx="6"/>`;
          return (
            (index === 3 ? '' : shadow(row, 2, 0.35)) +
            `<g fill="${index === 3 ? '#fff' : dark ? '#3d3d42' : '#fff'}" opacity="${index === 3 ? 0.14 : 1}">${row}</g>` +
            `<rect x="16" y="${y - 5}" width="19" height="10" rx="3.5" fill="${colour}"/>` +
            `<rect x="20" y="${y - 1.4}" width="11" height="2.8" rx="1.4" fill="#fff" opacity=".9"/>` +
            `<rect x="40" y="${y - 2}" width="${width}" height="4" rx="2" fill="${index === 3 ? '#fff' : tone.soft}" opacity="${index === 3 ? 0.3 : 1}"/>` +
            `<path d="M78 ${y - 2.5}l3 2.5-3 2.5" fill="none" stroke="${index === 3 ? '#fff' : tone.rule}" stroke-opacity="${index === 3 ? 0.3 : 1}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
          );
        })
        .join(''),
    };
  },
  'exif-editor': () => ({
    background: ['#d2dcff', '#6475d6'],
    defs: cameraPaint(),
    art:
      camera(46, 52, 66) +
      shadow('<circle cx="74" cy="72" r="14"/>', 2, 0.35) +
      `<circle cx="74" cy="72" r="14" fill="#0a84ff" stroke="#fff" stroke-width="2.4"/>` +
      `<circle cx="74" cy="65.5" r="2" fill="#fff"/><path d="M74 70.5v8" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`,
  }),
  'mp3-metadata': () => {
    const tag = '<path fill-rule="evenodd" d="M60 58h22a5 5 0 0 1 5 5v18a5 5 0 0 1-5 5H60l-10-14Zm-2 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>';
    return {
      background: ['#ff7aa2', '#5a6cf0'],
      defs:
        radial('vr', ['#3a3a40', '#141416', '#050505'], 0.45, 0.4, 0.65) +
        linear('vl', ['#ffcf5c', '#ff6a3d']) +
        linear('vs', [['#fff', 0], ['#fff', 0.35, 0.5], ['#fff', 0]], 0, 0, 1, 1),
      art:
        shadow('<circle cx="44" cy="44" r="32"/>', 3.5, 0.4) +
        `<circle cx="44" cy="44" r="32" fill="url(#@vr)"/>` +
        [28, 24, 20, 16].map((r) => `<circle cx="44" cy="44" r="${r}" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".8"/>`).join('') +
        `<path d="M22 22a31 31 0 0 1 44 0L44 44Z" fill="url(#@vs)" opacity=".5"/>` +
        `<circle cx="44" cy="44" r="12" fill="url(#@vl)"/><circle cx="44" cy="44" r="2.4" fill="#1c1c1e"/>` +
        shadow(tag, 2.5, 0.3) +
        `<g fill="#fff">${tag}</g>` +
        `<path d="M70 79V65.5l9-2v12" fill="none" stroke="#e8175d" stroke-width="2.4" stroke-linejoin="round"/>` +
        `<ellipse cx="67.6" cy="79" rx="3" ry="2.4" fill="#e8175d"/><ellipse cx="76.6" cy="75.5" rx="3" ry="2.4" fill="#e8175d"/>`,
    };
  },
  'docker-compose': () => ({
    background: ['#5cc2ff', '#1557c9'],
    defs: linear('kr', [['#fff', 0.28], ['#fff', 0, 0.45], ['#000', 0.18]]),
    art:
      `<rect x="10" y="80" width="80" height="4" rx="2" fill="#0b3c8f" opacity=".45"/>` +
      container(12, 57, 36, 22, '#ff9f0a') +
      container(52, 57, 36, 22, '#30b0c7') +
      container(30, 33, 40, 22, '#ff453a') +
      container(35, 12, 30, 19, '#f2f2f7'),
  }),
  'compose-to-k8s': () => ({
    background: ['#7ab4ff', '#2a4fc4'],
    defs: linear('kr', [['#fff', 0.28], ['#fff', 0, 0.45], ['#000', 0.18]]) + across('kh', ['#ffffff', '#d7e3f7'], 0, 36, 0, 84),
    art:
      container(9, 52, 26, 15, '#ff9f0a') +
      container(9, 70, 26, 15, '#30b0c7') +
      container(13, 34, 22, 15, '#ff453a') +
      `<path d="M40 60h10M46 55l5 5-5 5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      helm(72, 58, 14, 'url(#@kh)'),
  }),
  kubernetes: () => ({
    background: ['#5a9bff', '#173a9e'],
    defs: across('kw', ['#ffffff', '#d4e1f7'], 0, 16, 0, 84),
    art:
      `<circle cx="50" cy="50" r="36" fill="#fff" opacity=".08"/>` +
      helm(50, 50, 24, 'url(#@kw)'),
  }),
  'morse-code': () => {
    const signal = '<rect x="16" y="22" width="11" height="11" rx="5.5"/><rect x="33" y="22" width="24" height="11" rx="5.5"/><rect x="63" y="22" width="11" height="11" rx="5.5"/><rect x="80" y="22" width="11" height="11" rx="5.5" opacity=".45"/>';
    const base = '<rect x="14" y="68" width="72" height="16" rx="6"/>';
    return {
      background: ['#ffbe55', '#e2480f'],
      defs:
        linear('mw', ['#8a5a36', '#4a2c16']) +
        across('mb', ['#fff1b0', '#f2b43a', '#b67918'], 0, 50, 0, 62) +
        radial('mk', ['#5a5a60', '#141416'], 0.4, 0.35, 0.7),
      art:
        `<g transform="translate(-3.5 0)">${shadow(signal, 2, 0.25)}<g fill="#fff">${signal}</g></g>` +
        shadow(base, 3, 0.35) +
        `<g fill="url(#@mw)">${base}</g>` +
        `<path d="M18 70.5h64" stroke="#fff" stroke-opacity=".25" stroke-width="1" stroke-linecap="round"/>` +
        `<rect x="34" y="58" width="8" height="12" rx="2" fill="url(#@mb)"/>` +
        `<rect x="66" y="62" width="7" height="8" rx="2" fill="url(#@mb)"/>` +
        shadow('<path d="M22 60 72 52.5"/>', 1.5, 0.3, 's') +
        `<path d="M22 60 72 52.5" stroke="url(#@mb)" stroke-width="5" stroke-linecap="round"/>` +
        shadow('<ellipse cx="74" cy="50" rx="10" ry="6"/>', 1.5, 0.35, 's') +
        `<ellipse cx="74" cy="50" rx="10" ry="6" fill="url(#@mk)"/>` +
        `<ellipse cx="71.5" cy="47.8" rx="4.5" ry="1.6" fill="#fff" opacity=".35"/>`,
    };
  },
  'iban-validator': () => {
    const card = '<rect x="10" y="24" width="72" height="48" rx="8"/>';
    return {
      background: ['#f4f6fa', '#c3ccd9'],
      defs:
        linear('ic', ['#6d6bff', '#b04ee8'], 0, 0, 1, 1) +
        linear('ig', ['#fff1b0', '#e0a526']),
      art:
        `<g transform="rotate(-6 46 48)">` +
        shadow(card, 3.5, 0.3) +
        `<g fill="url(#@ic)">${card}</g>` +
        `<path d="M10 58c20-10 44-14 72-8v14a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8Z" fill="#fff" opacity=".1"/>` +
        `<rect x="18" y="34" width="14" height="10" rx="2.4" fill="url(#@ig)"/>` +
        `<path d="M18 39h14M25 34v10" stroke="#b67918" stroke-width=".7" opacity=".6"/>` +
        `<g fill="#fff">${[18, 34, 50].map((x) => [0, 1, 2, 3].map((index) => `<circle cx="${x + index * 3.4}" cy="55" r="1.3"/>`).join('')).join('')}<rect x="66" y="53.4" width="8" height="3.2" rx="1.6"/></g>` +
        `<rect x="18" y="62" width="22" height="3" rx="1.5" fill="#fff" opacity=".6"/>` +
        `</g>` +
        shadow('<circle cx="72" cy="70" r="15"/>', 2.5, 0.35) +
        `<circle cx="72" cy="70" r="15" fill="#30d158" stroke="#fff" stroke-width="2.6"/>` +
        `<path d="m65.5 70.5 4.5 4.5 8.5-9" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'svg-placeholder': ({ dark }) => {
    const tone = tones(dark);
    const box = '<rect x="10" y="30" width="80" height="45" rx="6"/>';
    return {
      background: ['#fcd6f0', '#c86dd7'],
      defs: linear('sp', dark ? ['#44444a', '#303035'] : ['#f1f2f6', '#d9dce3']),
      art:
        `<path d="M10 20h80M10 16.5v7M90 16.5v7" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>` +
        shadow(box, 3, 0.28) +
        `<g fill="url(#@sp)">${box}</g>` +
        `<path d="M30 75 50 55l10 10 8-8 22 18Z" fill="${dark ? '#5e5e66' : '#c5c9d2'}" opacity=".55"/><circle cx="72" cy="42" r="5" fill="${dark ? '#5e5e66' : '#c5c9d2'}" opacity=".55"/>` +
        `<rect x="10.5" y="30.5" width="79" height="44" rx="5.5" fill="none" stroke="${dark ? '#6e6e76' : '#b8bcc6'}" stroke-width="1" stroke-dasharray="3 2.5"/>` +
        shadow('<rect x="29" y="43.5" width="42" height="18" rx="9"/>', 1.5, 0.3, 's') +
        `<rect x="29" y="43.5" width="42" height="18" rx="9" fill="${dark ? '#f2f2f7' : '#1c1c1e'}"/>` +
        `<g fill="none" stroke="${dark ? '#1c1c1e' : '#fff'}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${figures('16', 35, 47.5, 10, 2.5)}${figures('9', 58.5, 47.5, 10)}<path d="M50.5 50.3l4.4 4.4M54.9 50.3l-4.4 4.4"/></g>`,
    };
  },
  // a lit sphere in character cells: heavier glyphs where the light falls
  'ascii-art': () => {
    const cells = [];
    for (let row = 0; row < 11; row += 1) {
      for (let col = 0; col < 11; col += 1) {
        const x = (col - 5) / 5;
        const y = (row - 5) / 5;
        const depth = 1 - x * x - y * y;
        if (depth <= 0.02) continue;
        const light = Math.max(0, -0.55 * x - 0.6 * y + 0.58 * Math.sqrt(depth));
        const cx = 20 + col * 6;
        const cy = 20 + row * 6;
        if (light > 0.75) cells.push(`<rect x="${cx - 2.3}" y="${cy - 2.3}" width="4.6" height="4.6" rx=".8"/>`);
        else if (light > 0.5) cells.push(`<path d="M${cx - 2} ${cy - 1.2}h4M${cx - 2} ${cy + 1.2}h4M${cx - 1.2} ${cy - 2.2}v4.4M${cx + 1.2} ${cy - 2.2}v4.4" stroke-width="1"/>`);
        else if (light > 0.28) cells.push(`<path d="M${cx - 2} ${cy}h4M${cx} ${cy - 2}v4" stroke-width="1.1"/>`);
        else if (light > 0.1) cells.push(`<path d="M${cx - 1.6} ${cy}h3.2" stroke-width="1.1"/>`);
        else cells.push(`<circle cx="${cx}" cy="${cy + 1}" r=".8" stroke="none"/>`);
      }
    }
    return {
      background: ['#26332b', '#070b08'],
      art:
        `<circle cx="50" cy="50" r="30" fill="#30d158" opacity=".16" filter="url(#@g)"/>` +
        `<g fill="#7dffa1" stroke="#7dffa1" stroke-linecap="round">${cells.join('')}</g>` +
        `<rect x="74" y="80" width="7" height="2.4" rx="1" fill="#7dffa1"/>`,
    };
  },
  'css-gradient': () => {
    const bar = '<rect x="12" y="62" width="76" height="16" rx="8"/>';
    const stops = [[22, '#ffd166'], [50, '#ff4d8d'], [78, '#5b5bff']];
    return {
      background: ['#ffd166', '#5b5bff'],
      defs:
        across('cg', ['#ffd166', '#ff4d8d', '#5b5bff'], 0, 0, 100, 100) +
        radial('cw', [['#fff', 0.45], ['#fff', 0]], 0.3, 0.25, 0.6) +
        across('cb', ['#ffd166', '#ff4d8d', '#5b5bff'], 16, 0, 84, 0),
      art:
        `<rect width="100" height="100" fill="url(#@cg)"/>` +
        `<rect width="100" height="100" fill="url(#@cw)"/>` +
        shadow(bar, 3, 0.3) +
        `<g fill="#fff" fill-opacity=".55" stroke="url(#@e)" stroke-width="1">${bar}</g>` +
        `<rect x="18" y="67" width="64" height="6" rx="3" fill="url(#@cb)"/>` +
        stops.map(([x, colour]) => shadow(`<circle cx="${x}" cy="70" r="6"/>`, 1.2, 0.3, 's') + `<circle cx="${x}" cy="70" r="6" fill="${colour}" stroke="#fff" stroke-width="2.6"/>`).join(''),
    };
  },
  'css-animation': () => {
    const point = (t) => {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = [18, 80, 62, 84, 38, 18, 82, 20];
      const u = 1 - t;
      return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3];
    };
    const trail = [0.18, 0.3, 0.42, 0.54, 0.66]
      .map((t, index) => {
        const [x, y] = point(t);
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${3 + index * 0.9}" fill="#ff5fb0" opacity="${0.12 + index * 0.12}"/>`;
      })
      .join('');
    const [bx, by] = point(0.8);
    return {
      background: ['#2c2766', '#0b0920'],
      defs: radial('ab', ['#ffc2e2', '#ff5fb0', '#c21c86'], 0.35, 0.3, 0.7),
      art:
        `<path d="M18 80H82M18 20v60" stroke="#fff" stroke-opacity=".12" stroke-width="1.2"/>` +
        `<path d="M18 80 62 84M82 20 38 18" stroke="#8e8cff" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="M18 80C62 84 38 18 82 20" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="62" cy="84" r="4" fill="#64d2ff"/><circle cx="38" cy="18" r="4" fill="#64d2ff"/>` +
        `<circle cx="18" cy="80" r="3" fill="#fff"/><circle cx="82" cy="20" r="3" fill="#fff"/>` +
        trail +
        `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="10" fill="#ff5fb0" opacity=".5" filter="url(#@f)"/>` +
        `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="8.5" fill="url(#@ab)"/>`,
    };
  },
  'jsx-svg': () => {
    const orbits = [0, 60, 120].map((angle) => `<ellipse cx="50" cy="50" rx="36" ry="13.5" transform="rotate(${angle} 50 50)"/>`).join('');
    return {
      background: ['#2b2f3a', '#0a0b10'],
      defs: across('jo', ['#7df3ff', '#3aa0ff'], 14, 14, 86, 86),
      art:
        `<circle cx="50" cy="50" r="30" fill="#3aa0ff" opacity=".18" filter="url(#@g)"/>` +
        `<g fill="none" stroke="url(#@jo)" stroke-width="3.4">${orbits}</g>` +
        `<path d="M30 50h40" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` +
        `<circle cx="30" cy="50" r="3.6" fill="#fff"/><circle cx="70" cy="50" r="3.6" fill="#fff"/>` +
        shadow('<rect x="42" y="42" width="16" height="16" rx="3"/>', 1.5, 0.4, 's') +
        `<rect x="42" y="42" width="16" height="16" rx="3" fill="#fff"/>` +
        `<rect x="46" y="46" width="8" height="8" rx="1.6" fill="#3aa0ff"/>`,
    };
  },
  'svg-editor': ({ dark }) => {
    const tone = tones(dark);
    const nib = '<path fill-rule="evenodd" d="M0-26 12-6 6 16h-12L-12-6Zm0 14a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z"/>';
    return {
      background: ['#ffffff', '#dfe3ea'],
      defs: across('sv', ['#ff9f0a', '#ff375f', '#bf5af2'], 12, 0, 88, 0) + linear('sn', dark ? ['#f2f2f7', '#aeb3be'] : ['#48484e', '#141416']),
      art:
        `<path d="M14 72C30 72 30 36 50 36s20 20 36 20" fill="none" stroke="url(#@sv)" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M34 36h32" stroke="#0a84ff" stroke-width="1.6"/>` +
        `<circle cx="34" cy="36" r="3.2" fill="${tone.paper}" stroke="#0a84ff" stroke-width="1.8"/><circle cx="66" cy="36" r="3.2" fill="${tone.paper}" stroke="#0a84ff" stroke-width="1.8"/>` +
        [[14, 72], [50, 36], [86, 56]].map(([x, y]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" rx="1.6" fill="${tone.paper}" stroke="#0a84ff" stroke-width="2"/>`).join('') +
        `<g transform="translate(62 70) rotate(-35)">${shadow(nib, 3, 0.35)}<g fill="url(#@sn)">${nib}</g><path d="M0-8.6V-26" stroke="${dark ? '#1c1c1e' : '#fff'}" stroke-width="1.2" opacity=".7"/><rect x="-7" y="16" width="14" height="10" rx="2.5" fill="${dark ? '#8e8e96' : '#1c1c1e'}"/></g>`,
    };
  },
  'voice-recorder': () => {
    const capsule = '<rect x="38" y="14" width="24" height="42" rx="12"/>';
    const wave = [[14, 8], [21, 16], [28, 10], [72, 12], [79, 18], [86, 8]];
    return {
      background: ['#ff6b7d', '#b3122f'],
      defs:
        across('vm', ['#b9bec8', '#ffffff', '#d7dbe2', '#9aa1ad'], 38, 0, 62, 0),
      art:
        `<g fill="#fff" opacity=".75">${wave.map(([x, height]) => `<rect x="${x - 2}" y="${38 - height}" width="4" height="${height * 2}" rx="2"/>`).join('')}</g>` +
        `<path d="M29 40a21 21 0 0 0 42 0" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>` +
        `<path d="M50 61v13M38 80h24" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>` +
        shadow(capsule, 2.5, 0.35) +
        `<g fill="url(#@vm)">${capsule}</g>` +
        `<g stroke="#6b7280" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round">${[22, 27, 32, 37, 42].map((y) => `<path d="M42 ${y}h16"/>`).join('')}</g>` +
        `<rect x="38.6" y="14.6" width="22.8" height="40.8" rx="11.4" fill="none" stroke="#fff" stroke-width="1"/>` +
        `<circle cx="50" cy="50" r="3" fill="#ff3b30"/>`,
    };
  },
  mirror: () => ({
    background: ['#3a3a46', '#08080c'],
    defs:
      linear('mg', ['#e8f0ff', '#a9b8d6', '#6e7fa6'], 0, 0, 1, 1) +
      linear('ms', [['#fff', 0], ['#fff', 0.75, 0.5], ['#fff', 0]], 0, 0, 1, 1),
    art:
      `<circle cx="50" cy="50" r="36" fill="none" stroke="#ffe7c2" stroke-width="10" opacity=".55" filter="url(#@g)"/>` +
      `<circle cx="50" cy="50" r="35" fill="none" stroke="#fff6e6" stroke-width="8"/>` +
      `<circle cx="50" cy="50" r="35" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="1.4 3.2" opacity=".9"/>` +
      shadow('<circle cx="50" cy="50" r="24"/>', 2, 0.5) +
      `<circle cx="50" cy="50" r="24" fill="url(#@mg)"/>` +
      `<clipPath id="@mc"><circle cx="50" cy="50" r="24"/></clipPath>` +
      `<g clip-path="url(#@mc)"><path d="M26 58 58 26h8L34 66Z" fill="url(#@ms)"/><path d="M40 72 72 40h4L44 76Z" fill="url(#@ms)" opacity=".6"/></g>` +
      `<circle cx="50" cy="50" r="23.4" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>`,
  }),
  screenshot: ({ dark }) => {
    const tone = tones(dark);
    const window = '<rect x="12" y="20" width="70" height="52" rx="8"/>';
    return {
      background: ['#5ee7df', '#1f7fb8'],
      art:
        shadow(window, 3, 0.25) +
        `<g fill="url(#@q)" opacity=".96">${window}</g>` +
        `<g fill="#ff5f57"><circle cx="20" cy="28" r="2.2"/></g><circle cx="27" cy="28" r="2.2" fill="#febc2e"/><circle cx="34" cy="28" r="2.2" fill="#28c840"/>` +
        `<rect x="20" y="38" width="30" height="4" rx="2" fill="${tone.rule}"/><rect x="20" y="47" width="42" height="4" rx="2" fill="${tone.rule}"/><rect x="20" y="56" width="24" height="4" rx="2" fill="${tone.rule}"/>` +
        `<rect x="34" y="34" width="50" height="40" rx="3" fill="#0a84ff" fill-opacity=".14" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 3"/>` +
        `<path d="M34 44V34h10M74 34h10v10M84 64v10H74M44 74H34V64" fill="none" stroke="#0a84ff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>` +
        shadow('<path d="M78 70v16M70 78h16"/>', 1.2, 0.35, 's') +
        `<path d="M78 69v18M69 78h18" stroke="${tone.ink}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<circle cx="78" cy="78" r="3" fill="none" stroke="${tone.ink}" stroke-width="1.8"/>`,
    };
  },
  tuner: () => {
    const face = '<rect x="12" y="16" width="76" height="68" rx="14"/>';
    const ticks = Array.from({ length: 13 }, (unused, index) => {
      const angle = -60 + index * 10;
      const long = index % 3 === 0;
      const colour = index === 6 ? '#30d158' : '#fff';
      return `<path d="M50 ${long ? 25 : 28}v${long ? 8 : 5}" transform="rotate(${angle} 50 66)" stroke="${colour}" stroke-opacity="${index === 6 ? 1 : 0.6}"/>`;
    }).join('');
    return {
      background: ['#f5c77e', '#b8661f'],
      defs: linear('tf', ['#2e2e33', '#0d0d0f']),
      art:
        shadow(face, 3.5, 0.35) +
        `<g fill="url(#@tf)">${face}</g>` +
        `<g stroke-width="2" stroke-linecap="round">${ticks}</g>` +
        `<path d="M44 26a41 41 0 0 1 12 0" fill="none" stroke="#30d158" stroke-width="5" stroke-linecap="round" opacity=".45" filter="url(#@s)"/>` +
        `<path d="M50 66 53 30" stroke="#ff453a" stroke-width="2.4" stroke-linecap="round"/>` +
        `<circle cx="50" cy="66" r="4" fill="#fff"/>` +
        `<path d="M45 81.5 50 73l5 8.5M46.9 78.3h6.2" fill="none" stroke="#30d158" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    };
  },
  'midi-keyboard': () => {
    const whites = Array.from({ length: 6 }, (unused, index) => 14 + index * 12);
    const blacks = [0, 1, 3, 4].map((index) => 14 + (index + 1) * 12 - 3.8);
    const board = '<rect x="10" y="24" width="80" height="60" rx="10"/>';
    return {
      background: ['#b39cff', '#4b2bb8'],
      defs:
        linear('mb', ['#2c2c32', '#0e0e10']) +
        linear('mw', ['#ffffff', '#e8e8ee']) +
        linear('mp', ['#9ae6ff', '#0a84ff']) +
        linear('mk', ['#3a3a40', '#050505']),
      art:
        shadow(board, 3.5, 0.35) +
        `<g fill="url(#@mb)">${board}</g>` +
        `<g fill="#30d158"><circle cx="18" cy="31" r="1.8"/></g><rect x="24" y="29.6" width="20" height="2.8" rx="1.4" fill="#fff" opacity=".25"/>` +
        whites.map((x, index) => `<rect x="${x + 0.5}" y="36" width="11" height="42" rx="2.4" fill="url(#@${index === 3 ? 'mp' : 'mw'})"/>`).join('') +
        `<rect x="${whites[3] + 0.5}" y="36" width="11" height="42" rx="2.4" fill="#64d2ff" opacity=".5" filter="url(#@f)"/>` +
        blacks.map((x) => `<rect x="${x}" y="36" width="7.6" height="25" rx="1.8" fill="url(#@mk)"/><rect x="${x + 1.4}" y="37" width="4.8" height="2" rx="1" fill="#fff" opacity=".2"/>`).join(''),
    };
  },
  'game-2048': () => {
    const tiles = [
      ['2', 13, 13, '#eee4da', '#776e65', 18],
      ['4', 53, 13, '#ede0c8', '#776e65', 18],
      ['8', 13, 53, '#f2b179', '#ffffff', 18],
      ['2048', 53, 53, '#edc22e', '#ffffff', 9.4],
    ];
    return {
      background: ['#c9bcae', '#8f7a66'],
      defs: linear('tg', [['#fff', 0.35], ['#fff', 0]]),
      art: tiles
        .map(([value, x, y, fill, ink, size]) => {
          const tile = `<rect x="${x}" y="${y}" width="34" height="34" rx="7"/>`;
          const width = value.length * 10 * (size / 16) + (value.length - 1) * 3 * (size / 16);
          return (
            shadow(tile, 2.5, 0.25) +
            (value === '2048' ? `<rect x="${x - 3}" y="${y - 3}" width="40" height="40" rx="10" fill="#edc22e" opacity=".55" filter="url(#@f)"/>` : '') +
            `<g fill="${fill}">${tile}</g>` +
            `<rect x="${x}" y="${y}" width="34" height="16" rx="7" fill="url(#@tg)"/>` +
            `<g fill="none" stroke="${ink}" stroke-width="${value.length > 1 ? 3.2 : 3}" stroke-linecap="round" stroke-linejoin="round">${figures(value, +(x + 17 - width / 2).toFixed(2), +(y + 17 - size / 2).toFixed(2), size)}</g>`
          );
        })
        .join(''),
    };
  },
  'game-minesweeper': ({ dark }) => {
    const tone = tones(dark);
    const spikes = Array.from({ length: 8 }, (unused, index) => `<path d="M46 20v52" transform="rotate(${index * 22.5} 46 46)"/>`).join('');
    const grid = [0, 1, 2, 3].map((index) => `M${index * 25} 0v100M0 ${index * 25}h100`).join('');
    return {
      background: ['#dfe6ef', '#a9b6c6'],
      defs:
        radial('mm', dark ? ['#9a9aa3', '#4a4a52', '#1c1c1f'] : ['#6b6b73', '#1c1c1f', '#050505'], 0.35, 0.3, 0.7) +
        linear('mf', ['#ff6b5e', '#d7261e']),
      art:
        `<path d="${grid}" stroke="#fff" stroke-opacity="${dark ? 0.08 : 0.55}" stroke-width="1.5"/>` +
        `<path d="${grid}" stroke="#7d8a9b" stroke-opacity=".25" stroke-width="1" transform="translate(1 1)"/>` +
        `<g fill="none" stroke="#1c1c1f" stroke-width="2" stroke-linecap="round" transform="translate(1.5 3)" opacity=".25" filter="url(#@s)">${spikes}</g>` +
        `<g fill="none" stroke="${dark ? '#6a6a72' : '#1c1c1f'}" stroke-width="4.2" stroke-linecap="round">${spikes}</g>` +
        shadow('<circle cx="46" cy="46" r="19"/>', 3, 0.35) +
        `<circle cx="46" cy="46" r="19" fill="url(#@mm)"/>` +
        `<circle cx="39.5" cy="39.5" r="4.6" fill="#fff" opacity=".85"/>` +
        `<path d="M72 60v26" stroke="${tone.ink}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M73.5 59.5 88 66l-14.5 6.5Z" fill="url(#@mf)"/>` +
        `<rect x="64" y="84" width="16" height="4" rx="2" fill="${tone.ink}"/>`,
    };
  },
  'game-snake': () => {
    const body = 'M18 78h26V52h32V26';
    const grid = Array.from({ length: 7 }, (unused, index) => `M${13 + index * 13} 0v100M0 ${13 + index * 13}h100`).join('');
    return {
      background: ['#20352a', '#07120c'],
      defs:
        across('sk', ['#2fbf5a', '#8dff7a'], 18, 78, 76, 26) +
        radial('sa', ['#ff8a80', '#e5261e', '#9e0f0a'], 0.35, 0.3, 0.7),
      art:
        `<path d="${grid}" stroke="#7dffa1" stroke-opacity=".05" stroke-width="1"/>` +
        `<path d="${body}" fill="none" stroke="#30d158" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity=".3" filter="url(#@f)"/>` +
        `<path d="${body}" fill="none" stroke="url(#@sk)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="${body}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="translate(-2 -2)"/>` +
        `<circle cx="72" cy="24" r="2" fill="#0b2a12"/><circle cx="80" cy="24" r="2" fill="#0b2a12"/>` +
        `<path d="M76 18.5v-5l-2.5-2.5M76 13.5l2.5-2.5" fill="none" stroke="#ff453a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<circle cx="28" cy="30" r="10" fill="#ff453a" opacity=".35" filter="url(#@f)"/>` +
        `<circle cx="28" cy="31" r="8" fill="url(#@sa)"/>` +
        `<path d="M28 23c.5-2.6 2.2-4.2 4.6-4.6" fill="none" stroke="#3ddc84" stroke-width="2" stroke-linecap="round"/>`,
    };
  },
  'game-breakout': () => {
    const rows = [['#ff453a', 'xxxxx'], ['#ff9f0a', 'xx.xx'], ['#ffd60a', 'x..xx'], ['#30d158', 'x...x']];
    const bricks = rows
      .map(([colour, row], y) =>
        [...row]
          .map((mark, x) => (mark === 'x' ? `<rect x="${12 + x * 15.6}" y="${16 + y * 9}" width="13.6" height="7" rx="2" fill="${colour}"/><rect x="${12 + x * 15.6}" y="${16 + y * 9}" width="13.6" height="3" rx="1.5" fill="#fff" opacity=".3"/>` : ''))
          .join(''),
      )
      .join('');
    return {
      background: ['#262a55', '#070814'],
      art:
        bricks +
        `<path d="M46 76 60 58l-8-14" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1.4" stroke-dasharray="2 3" stroke-linecap="round"/>` +
        `<circle cx="60" cy="58" r="6" fill="#fff" opacity=".6" filter="url(#@f)"/>` +
        `<circle cx="60" cy="58" r="4.2" fill="#fff"/>` +
        `<rect x="30" y="78" width="32" height="6" rx="3" fill="#64d2ff" opacity=".5" filter="url(#@f)"/>` +
        `<rect x="30" y="78" width="32" height="6" rx="3" fill="#64d2ff"/><rect x="32" y="78.6" width="28" height="2" rx="1" fill="#fff" opacity=".5"/>`,
    };
  },
  'game-pong': () => {
    const pieces = '<rect x="14" y="26" width="8" height="30" rx="4"/><rect x="78" y="46" width="8" height="30" rx="4"/><rect x="55" y="36" width="9" height="9" rx="2.5"/>';
    return {
      background: ['#ff9a3c', '#e3246f'],
      art:
        `<path d="M50 10v80" stroke="#fff" stroke-opacity=".5" stroke-width="2.6" stroke-dasharray="5 5" stroke-linecap="round"/>` +
        `<g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".85">${figures('3', 30, 14, 12)}${figures('5', 62, 14, 12)}</g>` +
        `<path d="M26 44 55 40" stroke="#fff" stroke-opacity=".3" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/>` +
        shadow(pieces, 2.5, 0.25) +
        `<g fill="#fff">${pieces}</g>`,
    };
  },
  'game-invaders': () => {
    const sprite = ['...x...x...', '....x.x....', '..xxxxxxx..', '.xx..x..xx.', 'xxxxxxxxxxx', '.x.xxxxx.x.', '.x.......x.', '..xx...xx..'];
    const cell = 5.6;
    const pixels = sprite.flatMap((row, y) => [...row].map((mark, x) => (mark === 'x' ? `<rect x="${+(19.2 + x * cell).toFixed(2)}" y="${+(16 + y * cell).toFixed(2)}" width="${cell + 0.4}" height="${cell + 0.4}"/>` : ''))).join('');
    return {
      background: ['#3a1a78', '#0b0420'],
      defs: across('ia', ['#b8ff6e', '#30d158'], 0, 16, 0, 61),
      art:
        [[14, 12], [84, 30], [22, 60], [80, 70], [50, 8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#fff" opacity=".6"/>`).join('') +
        `<g fill="#30d158" opacity=".55" filter="url(#@f)">${pixels}</g>` +
        `<g fill="url(#@ia)">${pixels}</g>` +
        `<rect x="48.8" y="64" width="2.4" height="9" rx="1.2" fill="#ff5fb0"/>` +
        `<rect x="47" y="62" width="6" height="13" rx="3" fill="#ff5fb0" opacity=".45" filter="url(#@s)"/>` +
        `<path d="M40 88v-4h6v-4h8v4h6v4Z" fill="#64d2ff"/>`,
    };
  },
  'game-solitaire': () => {
    const card = '<rect x="-17" y="-25" width="34" height="50" rx="5"/>';
    const spade = 'M0-13C-4.4-7.4-12-3-12 3.2c0 3.6 2.6 6.2 6 6.2 2 0 3.6-.8 4.6-2.2L-3.6 13h7.2L1.4 7.2c1 1.4 2.6 2.2 4.6 2.2 3.4 0 6-2.6 6-6.2C12-3 4.4-7.4 0-13Z';
    const heart = 'M0 9.5C-7.6 4.6-11 .6-11-4.2c0-3.6 2.7-6.3 6-6.3 2.2 0 3.9 1.1 5 2.9 1.1-1.8 2.8-2.9 5-2.9 3.3 0 6 2.7 6 6.3 0 4.8-3.4 8.8-11 13.7Z';
    const corner = (glyph, colour) => `<path d="${glyph}" transform="translate(-10.5 -14) scale(.34)" fill="${colour}"/><path d="${glyph}" transform="translate(10.5 14) rotate(180) scale(.34)" fill="${colour}"/>`;
    return {
      background: ['#39b56a', '#0c4f2a'],
      defs: radial('sf', [['#fff', 0.18], ['#fff', 0]], 0.5, 0.35, 0.6),
      art:
        `<rect width="100" height="100" fill="url(#@sf)"/>` +
        `<g transform="translate(36 54) rotate(-16)">${shadow(card, 2.5, 0.3)}<g fill="#fff">${card}</g>${corner(heart, '#ff3b30')}<path d="${heart}" transform="scale(1.2)" fill="#ff3b30"/></g>` +
        `<g transform="translate(62 50) rotate(12)">${shadow(card, 3.5, 0.35)}<g fill="#fff">${card}</g>${corner(spade, '#1c1c1e')}<path d="${spade}" transform="scale(1.3)" fill="#1c1c1e"/></g>`,
    };
  },
  'game-dino': ({ dark }) => {
    const tone = tones(dark);
    const sprite = ['......xxxxx.', '.....xx.xxxx', '.....xxxxxxx', '.....xxxx...', 'x...xxxxxx..', 'xx.xxxxx.x..', 'xxxxxxxx....', '.xxxxxxx....', '..xxxxx.....', '...x..x.....', '...xx.xx....'];
    const cell = 4.2;
    const pixels = sprite.flatMap((row, y) => [...row].map((mark, x) => (mark === 'x' ? `<rect x="${+(14 + x * cell).toFixed(2)}" y="${+(14 + y * cell).toFixed(2)}" width="${cell + 0.4}" height="${cell + 0.4}"/>` : ''))).join('');
    const cactus = '<path d="M68 82V52a4 4 0 0 1 8 0v30ZM62 70v-8a3 3 0 0 1 6 0v6h2v4h-5a3 3 0 0 1-3-2ZM82 64v-6a3 3 0 0 0-6 0v4h-2v4h5a3 3 0 0 0 3-2Z"/>';
    return {
      background: ['#fff7ea', '#e6cfae'],
      defs: linear('dc', ['#4cd964', '#1f8f3a']),
      art:
        `<circle cx="80" cy="24" r="8" fill="#ffcf5c"/>` +
        `<path d="M8 82h84" stroke="${dark ? '#8f7a5e' : '#8a6d4a'}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M14 88h6M30 86h3M50 89h8M74 87h4" stroke="#8a6d4a" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>` +
        `<ellipse cx="38" cy="83" rx="14" ry="2" fill="#000" opacity=".12"/>` +
        shadow(cactus, 1.5, 0.2, 's') +
        `<g fill="url(#@dc)">${cactus}</g>` +
        shadow(pixels, 2, 0.2, 's') +
        `<g fill="${dark ? '#e8e8ed' : '#3a3a3c'}">${pixels}</g>` +
        `<rect x="${14 + 8 * cell}" y="${14 + cell}" width="${cell}" height="${cell}" fill="${dark ? '#2b2b30' : '#fff'}"/>`,
    };
  },
  'periodic-table': ({ dark }) => {
    const tone = tones(dark);
    const tile = '<rect x="18" y="18" width="58" height="66" rx="11"/>';
    const back = '<rect x="36" y="12" width="52" height="60" rx="10"/>';
    return {
      background: ['#4fd1a5', '#1b5aa6'],
      defs: linear('pb', ['#ffcf5c', '#ff8a00']),
      art:
        `<g transform="rotate(9 62 42)">${shadow(back, 2.5, 0.25)}<g fill="url(#@pb)">${back}</g>` +
        `<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9">${figures('2', 75, 17, 8)}</g></g>` +
        shadow(tile, 3.5, 0.32) +
        `<g fill="url(#@q)">${tile}</g>` +
        `<g fill="none" stroke="${dark ? '#7cc4ff' : '#1b5aa6'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${figures('1', 26, 25, 9)}</g>` +
        `<path d="M35 38v30M59 38v30M35 53h24" fill="none" stroke="${tone.ink}" stroke-width="7" stroke-linecap="round"/>` +
        `<rect x="33" y="75" width="28" height="4" rx="2" fill="${tone.rule}"/>`,
    };
  },
  // a double helix built in depth: every tube, rung and bead is placed on the
  // turning strands and painted from the back to the front
  // a double helix in depth: the far side of each strand, then the rungs, then
  // the near side, so the strands pass in front of and behind each other
  'molecule-viewer': ({ dark }) => {
    const steps = 120;
    const radius = 15;
    const top = 10;
    const bottom = 90;
    const turn = (Math.PI * 2 * 1.45) / steps;
    const point = (index, phase) => {
      const angle = index * turn + phase;
      return [50 + radius * Math.sin(angle), top + ((bottom - top) * index) / steps, Math.cos(angle)];
    };
    const runs = (phase) => {
      const front = [];
      const back = [];
      let current = [];
      let side = null;
      for (let index = 0; index <= steps; index += 1) {
        const [x, y, z] = point(index, phase);
        const facing = z >= 0;
        if (side !== null && facing !== side) {
          current.push([x, y]);
          (side ? front : back).push(current);
          current = [];
        }
        side = facing;
        current.push([x, y]);
      }
      (side ? front : back).push(current);
      const path = (list) => list.map((run) => `M${run.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}`).join('');
      return { front: path(front), back: path(back) };
    };
    const blue = runs(0);
    const pink = runs(Math.PI);
    const rungs = [];
    const beads = [];
    for (let index = 6, count = 0; index < steps - 3; index += 9, count += 1) {
      const [ax, y, az] = point(index, 0);
      const [bx] = point(index, Math.PI);
      const mid = (ax + bx) / 2;
      rungs.push(`<path d="M${ax.toFixed(2)} ${y.toFixed(2)}H${mid.toFixed(2)}" stroke-opacity=".9"/><path d="M${mid.toFixed(2)} ${y.toFixed(2)}H${bx.toFixed(2)}" stroke-opacity=".55"/>`);
      if (count % 3 === 1) beads.push(az >= 0 ? [ax, y, 'ha'] : [bx, y, 'hb']);
    }
    const strand = (d, colour, width) => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const shine = (d) => `<path d="${d}" transform="translate(-1.2 -.8)" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/>`;
    return {
      background: dark ? ['#26315a', '#0a0f24'] : ['#4661e0', '#16215e'],
      defs:
        radial('ha', ['#ffffff', '#8fd6ff', '#1f6fe0'], 0.35, 0.3, 0.7) +
        radial('hb', ['#ffffff', '#c9ecff', '#5aa9e6'], 0.35, 0.3, 0.7),
      art:
        `<circle cx="50" cy="50" r="32" fill="#64d2ff" opacity=".2" filter="url(#@g)"/>` +
        `<g transform="rotate(34 50 50)">` +
        `<g opacity=".4" filter="url(#@f)" transform="translate(2 4)">${strand(blue.front + blue.back + pink.front + pink.back, '#000', 7)}</g>` +
        strand(blue.back, '#2356b8', 5.2) +
        strand(pink.back, '#4b86c9', 5.2) +
        `<g stroke="#dff2ff" stroke-width="3" stroke-linecap="round">${rungs.join('')}</g>` +
        strand(blue.front, '#6cc3ff', 7) +
        shine(blue.front) +
        strand(pink.front, '#d6efff', 7) +
        shine(pink.front) +
        beads.map(([x, y, paint]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.4" fill="url(#@${paint})"/>`).join('') +
        `</g>`,
    };
  },
  'circuit-lab': () => {
    const resistor = '<rect x="36" y="18" width="28" height="12" rx="6"/>';
    const battery = '<rect x="13" y="38" width="14" height="30" rx="3.5"/>';
    return {
      background: ['#17805a', '#063323'],
      defs:
        across('ct', ['#ffe9a3', '#d9a43a'], 0, 20, 0, 80) +
        linear('cr', ['#f7e3c0', '#d7b98a']) +
        linear('cb', ['#3a3a40', '#141416']) +
        radial('cl', ['#ffd1cc', '#ff3b30', '#a0120b'], 0.4, 0.3, 0.7),
      art:
        `<path d="M${[20, 40, 60, 80].map((y) => `12 ${y}h76`).join('M')}" stroke="#fff" stroke-opacity=".04" stroke-width="8"/>` +
        `<path d="M20 38V24h60v28M80 68v10H20V68" fill="none" stroke="url(#@ct)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>` +
        [[20, 24], [80, 24], [80, 78], [20, 78]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="#d9a43a" stroke="#063323" stroke-width="1.4"/>`).join('') +
        shadow(resistor, 1.5, 0.35, 's') +
        `<g fill="url(#@cr)">${resistor}</g>` +
        [['#8b4513', 42], ['#1c1c1e', 47], ['#ff3b30', 52], ['#d9a43a', 58]].map(([colour, x]) => `<rect x="${x}" y="18" width="2.6" height="12" fill="${colour}"/>`).join('') +
        shadow(battery, 2, 0.35, 's') +
        `<g fill="url(#@cb)">${battery}</g><rect x="13" y="38" width="14" height="8" rx="3.5" fill="#ff9f0a"/><rect x="17" y="34.5" width="6" height="4" rx="1.2" fill="#c7c7cc"/>` +
        `<path d="M17.5 55h5M20 52.5v5M17.5 63h5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>` +
        `<circle cx="80" cy="60" r="14" fill="#ff3b30" opacity=".55" filter="url(#@g)"/>` +
        `<path d="M72 68v-9a8 8 0 0 1 16 0v9Z" fill="url(#@cl)"/>` +
        `<rect x="70" y="67" width="20" height="3.4" rx="1.4" fill="#e5e5ea"/>` +
        `<path d="M76 56a4.5 4.5 0 0 1 3-3.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>`,
    };
  },
  paint: () => {
    const board = '<path fill-rule="evenodd" d="M48 16c20 0 38 12 38 29 0 10-7 15-15 15-6 0-9 3-9 8 0 3 2 5 2 8 0 5-5 8-14 8-21 0-38-15-38-34S27 16 48 16Zm-12 44a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/>';
    const blobs = [[34, 32, '#ff3b30'], [50, 26, '#ffd60a'], [66, 32, '#30d158'], [72, 46, '#0a84ff'], [24, 46, '#bf5af2']];
    return {
      background: ['#fff4ea', '#f0c9a8'],
      defs:
        linear('pp', ['#f3c98b', '#c98a4b']) +
        across('ph', ['#e04e39', '#9c2a1c'], 0, 50, 0, 90) +
        across('pf', ['#f2f2f7', '#9aa1ad'], 0, 58, 0, 66),
      art:
        shadow(board, 3, 0.3) +
        `<g fill="url(#@pp)">${board}</g>` +
        blobs.map(([x, y, colour]) => `<circle cx="${x}" cy="${y}" r="5.8" fill="${colour}"/><circle cx="${x - 1.8}" cy="${y - 1.8}" r="1.6" fill="#fff" opacity=".55"/>`).join('') +
        `<g transform="rotate(-42 62 64)">` +
        shadow('<rect x="40" y="60" width="44" height="8" rx="4"/>', 2.5, 0.35) +
        `<rect x="56" y="60" width="36" height="8" rx="4" fill="url(#@ph)"/>` +
        `<rect x="44" y="59" width="14" height="10" rx="1.5" fill="url(#@pf)"/>` +
        `<path d="M44 59c-7 .5-12 3-16 5 4 2 9 4.5 16 5Z" fill="#1c1c1e"/>` +
        `<path d="M34 61.5c-3 1-5 2-6.5 2.5 1.5.8 3.5 1.6 6.5 2.5Z" fill="#0a84ff"/>` +
        `</g>`,
    };
  },
  'poster-studio': ({ dark }) => {
    const tone = tones(dark);
    const poster = '<rect x="22" y="14" width="56" height="74" rx="4"/>';
    return {
      background: ['#9be7ff', '#3a7bd5'],
      defs: linear('ps', ['#ff6a88', '#ff9a44']) + radial('pn', ['#ff8a80', '#d7261e'], 0.35, 0.3, 0.7),
      art:
        `<g transform="rotate(-5 50 50)">` +
        shadow(poster, 3.5, 0.3) +
        `<g fill="${dark ? '#3a3a3f' : '#fffdf8'}">${poster}</g>` +
        `<rect x="27" y="19" width="46" height="36" rx="2" fill="url(#@ps)"/>` +
        `<circle cx="58" cy="32" r="9" fill="#ffe066"/>` +
        `<path d="M27 55 42 38l10 10 7-6 14 13Z" fill="#7a2a4a" opacity=".55"/>` +
        `<rect x="27" y="60" width="34" height="6" rx="1.5" fill="${tone.ink}"/>` +
        `<rect x="27" y="70" width="24" height="3.4" rx="1.7" fill="${tone.rule}"/><rect x="27" y="76" width="18" height="3.4" rx="1.7" fill="${tone.rule}"/>` +
        `<g fill="${tone.ink}"><rect x="61" y="70" width="12" height="12" rx="1.5"/></g>` +
        `<g fill="${dark ? '#3a3a3f' : '#fff'}"><rect x="62.6" y="71.6" width="3.6" height="3.6" rx=".6"/><rect x="67.8" y="71.6" width="3.6" height="3.6" rx=".6"/><rect x="62.6" y="76.8" width="3.6" height="3.6" rx=".6"/><rect x="68.4" y="77.4" width="2" height="2"/></g>` +
        `</g>` +
        shadow('<circle cx="50" cy="15" r="4.6"/>', 1.5, 0.35, 's') +
        `<circle cx="50" cy="15" r="4.6" fill="url(#@pn)"/><circle cx="48.6" cy="13.6" r="1.4" fill="#fff" opacity=".7"/>`,
    };
  },
  'physics-lab': ({ dark }) => {
    const ground = 78;
    const bounces = [
      [6, 22, 38],
      [38, 40, 64],
      [64, 50, 92],
    ];
    const along = ([x1, peak, x2], t) => {
      const mx = (x1 + x2) / 2;
      const my = 2 * peak - ground;
      return [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) ** 2 * ground + 2 * (1 - t) * t * my + t * t * ground];
    };
    // the trail: from the middle of the second bounce up to the ball, widening as it goes
    const points = [];
    for (let step = 0; step <= 16; step += 1) points.push(along(bounces[1], 0.35 + (step / 16) * 0.65));
    for (let step = 1; step <= 14; step += 1) points.push(along(bounces[2], (step / 14) * 0.38));
    // one tapered ribbon: each point pushed out to both sides along the path's normal
    const left = [];
    const right = [];
    points.forEach(([x, y], index) => {
      const [ax, ay] = points[Math.max(0, index - 1)];
      const [cx, cy] = points[Math.min(points.length - 1, index + 1)];
      const length = Math.hypot(cx - ax, cy - ay) || 1;
      const half = 0.3 + (index / (points.length - 1)) ** 1.2 * 10.5;
      const nx = (-(cy - ay) / length) * half;
      const ny = ((cx - ax) / length) * half;
      left.push(`${(x + nx).toFixed(2)} ${(y + ny).toFixed(2)}`);
      right.unshift(`${(x - nx).toFixed(2)} ${(y - ny).toFixed(2)}`);
    });
    const [bx, by] = points[points.length - 1];
    const [sx, sy] = points[0];
    const [hx, hy] = along(bounces[1], 0.35);
    const dashes = `M6 ${ground}Q22 ${2 * 22 - ground} 38 ${ground}M38 ${ground}Q${(38 + (51 - 38) * 0.35).toFixed(2)} ${(ground + (2 * 40 - ground - ground) * 0.35).toFixed(2)} ${hx.toFixed(2)} ${hy.toFixed(2)}`;
    return {
      background: dark ? ['#2d3a8c', '#0c1133'] : ['#6f8dff', '#3036c9'],
      defs:
        radial('pb', ['#fff1d6', '#ffa347', '#e2461c'], 0.34, 0.28, 0.74) +
        linear('pg', [['#fff', 0.7], ['#fff', 0.25]]) +
        `<linearGradient id="@pt" gradientUnits="userSpaceOnUse" x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}"><stop offset="0" stop-color="#ffd9b0" stop-opacity="0"/><stop offset="1" stop-color="#ffd9b0" stop-opacity=".7"/></linearGradient>`,
      art:
        `<rect x="6" y="${ground + 2}" width="88" height="4" rx="2" fill="url(#@pg)"/>` +
        `<path d="${dashes}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.6" stroke-dasharray="2.4 3" stroke-linecap="round"/>` +
        [38, 64].map((x) => `<ellipse cx="${x}" cy="${ground}" rx="4.6" ry="1.6" fill="#fff" opacity=".6"/>`).join('') +
        `<path d="M${left.join('L')}L${right.join('L')}Z" fill="url(#@pt)"/>` +
        `<ellipse cx="${bx.toFixed(1)}" cy="${ground + 2}" rx="8" ry="2.2" fill="#070b3a" opacity="${dark ? 0.55 : 0.35}" filter="url(#@s)"/>` +
        shadow(`<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="11.5"/>`, 2.5, 0.3) +
        `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="11.5" fill="url(#@pb)"/>` +
        `<ellipse cx="${(bx - 3.9).toFixed(1)}" cy="${(by - 4.3).toFixed(1)}" rx="4.1" ry="2.7" fill="#fff" opacity=".78" transform="rotate(-32 ${(bx - 3.9).toFixed(1)} ${(by - 4.3).toFixed(1)})"/>`,
    };
  },
  'logic-lab': () => {
    const gate = '<path d="M30 28h20a22 22 0 0 1 0 44H30Z"/>';
    return {
      background: ['#253750', '#070a12'],
      defs: linear('lg', ['#ffffff', '#d6deea']),
      art:
        `<path d="M8 40h22M8 60h22M72 50h20" stroke="#30d158" stroke-width="7" stroke-linecap="round" opacity=".5" filter="url(#@f)"/>` +
        `<path d="M8 40h22M8 60h22M72 50h20" stroke="#5cff8a" stroke-width="3.6" stroke-linecap="round"/>` +
        shadow(gate, 3, 0.5) +
        `<g fill="url(#@lg)">${gate}</g>` +
        `<path d="M32 30.5h18a19.5 19.5 0 0 1 17.8 11.6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>` +
        `<g fill="none" stroke="#253750" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${figures('1', 36, 43, 13)}</g>` +
        `<circle cx="16" cy="40" r="3.4" fill="#fff"/><circle cx="16" cy="60" r="3.4" fill="#fff"/>` +
        `<circle cx="86" cy="50" r="7" fill="#5cff8a" opacity=".6" filter="url(#@f)"/><circle cx="86" cy="50" r="4.6" fill="#b8ffcb"/>`,
    };
  },
  'pdf-studio': ({ dark }) => {
    const tone = tones(dark);
    const page = (x, y) => `<path d="M${x} ${y + 6}a6 6 0 0 1 6-6h28l14 14v44a6 6 0 0 1-6 6H${x + 6}a6 6 0 0 1-6-6Z"/>`;
    const fold = (x, y) => `<path d="M${x + 34} ${y}v9a5 5 0 0 0 5 5h9Z"/>`;
    return {
      background: ['#ff7a70', '#c0161f'],
      defs: linear('pl', ['#ff453a', '#c0161f']),
      art:
        `<g transform="translate(3 0)">` +
        `<g opacity=".55">${shadow(page(34, 10), 2, 0.2)}<g fill="${tone.paper}">${page(34, 10)}</g></g>` +
        shadow(page(20, 20), 3, 0.3) +
        `<g fill="url(#@q)">${page(20, 20)}</g>` +
        `<g fill="${tone.faint}">${fold(20, 20)}</g>` +
        `<rect x="14" y="48" width="44" height="18" rx="4" fill="url(#@pl)"/>` +
        `<path d="M21 62V52h4.2a3 3 0 0 1 0 6H21M31.5 62V52h3a5 5 0 0 1 0 10ZM44.5 62V52h6.5M44.5 57h5" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<rect x="28" y="72" width="26" height="3.4" rx="1.7" fill="${tone.rule}"/><rect x="28" y="36" width="20" height="3.4" rx="1.7" fill="${tone.rule}"/>` +
        `</g>`,
    };
  },
  'ssh-keys': ({ dark }) => {
    const tone = tones(dark);
    const window = '<rect x="10" y="16" width="70" height="56" rx="10"/>';
    const key =
      '<path fill-rule="evenodd" d="M27 36a14 14 0 1 0 0 28 14 14 0 0 0 0-28Zm0 9a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/>' +
      '<rect x="38" y="46" width="47" height="8" rx="2.4"/><path d="M66 52h19v10.5a2 2 0 0 1-2 2h-3.8v-4.8h-4v4.8H68a2 2 0 0 1-2-2Z"/>';
    return {
      background: ['#e9edf3', '#98a4b5'],
      defs:
        linear('st', dark ? ['#4a4a51', '#2a2a2e'] : ['#3a3a40', '#121214']) +
        across('sg', ['#fff3c4', ['#f9c950', 1, 0.45], '#c7841b'], 0, 36, 0, 66),
      art:
        shadow(window, 3, 0.35) +
        `<g fill="url(#@st)">${window}</g>` +
        `<rect x="10" y="16" width="70" height="12" rx="10" fill="#fff" opacity=".06"/>` +
        `<circle cx="19" cy="22" r="2" fill="#ff5f57"/><circle cx="26" cy="22" r="2" fill="#febc2e"/><circle cx="33" cy="22" r="2" fill="#28c840"/>` +
        `<path d="m20 38 7 6-7 6M31 51h12" fill="none" stroke="#5cff8a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<rect x="20" y="58" width="30" height="3" rx="1.5" fill="#fff" opacity=".2"/>` +
        `<g transform="translate(64 70) scale(.68) rotate(-35) translate(-54 -50)">${shadow(key, 4, 0.45)}<g fill="url(#@sg)">${key}</g>` +
        `<path d="M15.5 43a13 13 0 0 1 15-6.6M40 48h43" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/></g>`,
    };
  },
  'serial-console': () => ({
    background: ['#3cc6c0', '#0b4f6c'],
    defs:
      across('us', ['#b9bec8', '#ffffff', '#d7dbe2', '#9aa1ad'], 24, 0, 48, 0) +
      linear('ub', ['#3a3a40', '#141416']),
    art:
      `<path d="M36 98V76" stroke="#1c1c1e" stroke-width="7" stroke-linecap="round"/>` +
      shadow('<rect x="22" y="44" width="28" height="36" rx="6"/><rect x="25" y="16" width="22" height="30" rx="2"/>', 3, 0.35) +
      `<rect x="25" y="16" width="22" height="30" rx="2" fill="url(#@us)"/>` +
      `<rect x="30" y="22" width="4.5" height="4.5" rx=".8" fill="#5f6673"/><rect x="37.5" y="22" width="4.5" height="4.5" rx=".8" fill="#5f6673"/>` +
      `<rect x="22" y="44" width="28" height="36" rx="6" fill="url(#@ub)"/>` +
      `<path d="M31 56v10M31 58l-3-3M31 61l3-3" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M56 64h6V40h8v24h8V40h8" fill="none" stroke="#5cff8a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".45" filter="url(#@f)"/>` +
      `<path d="M56 64h6V40h8v24h8V40h8" fill="none" stroke="#b8ffcb" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  }),
  'bluetooth-scanner': () => ({
    background: ['#1d2b64', '#060b24'],
    defs:
      `<linearGradient id="@bw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#64d2ff" stop-opacity=".05"/><stop offset="1" stop-color="#64d2ff" stop-opacity=".85"/></linearGradient>`,
    art:
      [36, 26, 16].map((r) => `<circle cx="50" cy="50" r="${r}" fill="none" stroke="#64d2ff" stroke-opacity=".45" stroke-width="1.8"/>`).join('') +
      `<path d="M14 50h72M50 14v72" stroke="#64d2ff" stroke-opacity=".14" stroke-width="1"/>` +
      `<path d="M50 50 50 14a36 36 0 0 1 31.2 18Z" fill="url(#@bw)"/>` +
      `<path d="M50 50 81.2 32" stroke="#b8ecff" stroke-width="2" stroke-linecap="round"/>` +
      [[66, 30, 4.6], [30, 62, 4], [70, 66, 3.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="#64d2ff" opacity=".45" filter="url(#@s)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#e6f8ff"/>`).join('') +
      `<circle cx="50" cy="50" r="4" fill="#fff"/>`,
  }),
  'gamepad-tester': () => {
    const pad = '<path d="M30 30h40c10.5 0 17 6.4 19.2 17l4.4 21.6c1.6 8-3 13.4-9.2 13.4-4.4 0-7.6-2.6-10-6.4L69 68H31l-5.4 7.6c-2.4 3.8-5.6 6.4-10 6.4-6.2 0-10.8-5.4-9.2-13.4L10.8 47C13 36.4 19.5 30 30 30Z"/>';
    return {
      background: ['#9d8cff', '#3a24b0'],
      defs:
        linear('gp', ['#ffffff', '#d9dce6']) +
        radial('gs', ['#5a5a60', '#1c1c1f'], 0.4, 0.35, 0.7),
      art:
        shadow(pad, 4, 0.4) +
        `<g fill="url(#@gp)">${pad}</g>` +
        `<path d="M24 32.5c-5.6 2.6-9 7.6-10.4 14.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="M24.5 40h5v6h6v5h-6v6h-5v-6h-6v-5h6Z" fill="#3a3a40" stroke="#3a3a40" stroke-width="1.6" stroke-linejoin="round"/>` +
        [[73, 40, '#30d158'], [81, 48, '#ff453a'], [73, 56, '#0a84ff'], [65, 48, '#ffd60a']].map(([x, y, colour]) => `<circle cx="${x}" cy="${y}" r="4.4" fill="${colour}"/><circle cx="${x - 1.2}" cy="${y - 1.4}" r="1.3" fill="#fff" opacity=".6"/>`).join('') +
        [[40, 61], [60, 61]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#c7cbd6"/><circle cx="${x}" cy="${y - 0.8}" r="6" fill="url(#@gs)"/>`).join('') +
        `<rect x="45" y="42" width="4" height="2.6" rx="1.3" fill="#8e8e93"/><rect x="51" y="42" width="4" height="2.6" rx="1.3" fill="#8e8e93"/>` +
        `<circle cx="81" cy="48" r="9" fill="none" stroke="#ff453a" stroke-width="1.4" opacity=".6"/>`,
    };
  },
  // not an app: the dock's way into the library, a grid of little app tiles
  'app-library': ({ dark }) => {
    const colours = ['#ff5e57', '#ff9f0a', '#ffcc00', '#34c759', '#2ac3de', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f'];
    const tile = 21;
    const gap = 6.5;
    const start = (100 - tile * 3 - gap * 2) / 2;
    const scale = tile / 100;
    return {
      background: ['#fbfbfd', '#dcdee5'],
      defs: colours.map((colour, index) => lit(`l${index}`, colour, 0.2, 0.12)).join('') +
        linear('lh', [['#fff', 0.38], ['#fff', 0, 0.42]]),
      art: colours
        .map((colour, index) => {
          const x = start + (index % 3) * (tile + gap);
          const y = start + Math.floor(index / 3) * (tile + gap);
          const shape = `<path d="${SQUIRCLE}" transform="translate(${x} ${y}) scale(${scale})"/>`;
          return (
            shadow(shape, 1.2, dark ? 0.4 : 0.2, 's') +
            `<g fill="url(#@l${index})">${shape}</g>` +
            `<path d="${SQUIRCLE}" transform="translate(${x} ${y}) scale(${scale})" fill="url(#@lh)"/>`
          );
        })
        .join(''),
    };
  },
  settings: () => {
    const gear = (cx, cy, outer, inner, teeth) => {
      const points = [];
      for (let index = 0; index < teeth; index += 1) {
        const base = (index / teeth) * Math.PI * 2;
        const step = (Math.PI * 2) / teeth;
        for (const [offset, radius] of [[0.08, inner], [0.2, outer], [0.8, outer], [0.92, inner]]) {
          const angle = base + step * offset;
          points.push(`${+(cx + radius * Math.cos(angle)).toFixed(2)} ${+(cy + radius * Math.sin(angle)).toFixed(2)}`);
        }
      }
      return `M${points.join('L')}Z`;
    };
    const big = gear(50, 50, 36, 29.5, 16);
    return {
      background: ['#b8bec9', '#5b6371'],
      defs:
        linear('sg', ['#f7f8fa', '#aab1bd']) +
        linear('sd', ['#3a3d44', '#1a1c20']) +
        linear('si', ['#e5e8ee', '#8e96a3']),
      art:
        shadow(`<path d="${big}"/>`, 3, 0.35) +
        `<path d="${big}" fill="url(#@sg)" stroke="#fff" stroke-opacity=".6" stroke-width=".8" stroke-linejoin="round"/>` +
        `<circle cx="50" cy="50" r="23" fill="url(#@sd)"/>` +
        `<path d="${gear(50, 50, 18, 14.5, 10)}" fill="url(#@si)" stroke-linejoin="round"/>` +
        `<circle cx="50" cy="50" r="7" fill="url(#@sd)"/>` +
        `<circle cx="50" cy="50" r="22.4" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>`,
    };
  },
  'coin-flipper': () => {
    const star = '<path d="m0-12 3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.9L0 6.1l-7 3.7 1.3-7.9-5.7-5.6 7.9-1.1Z"/>';
    return {
      background: ['#3be8a0', '#0577d6'],
      defs:
        linear('ce', ['#c9861c', '#8a5200']) +
        linear('cf', ['#fff1b0', '#f5c342', '#d9921e'], 0, 0, 1, 1) +
        linear('cs', ['#b0730f', '#e8b040']),
      art:
        `<path d="M22 30c6-12 18-18 30-18M78 70c-6 12-18 18-30 18" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>` +
        `<path d="m49 8 4 4-4 4M51 84l-4 4 4 4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>` +
        `<ellipse cx="50" cy="80" rx="20" ry="3" fill="#000" opacity=".2" filter="url(#@f)"/>` +
        `<g transform="rotate(-24 50 50)">` +
        `<ellipse cx="50" cy="55" rx="28" ry="17" fill="url(#@ce)"/>` +
        `<rect x="22" y="48" width="56" height="7" fill="url(#@ce)"/>` +
        `<ellipse cx="50" cy="48" rx="28" ry="17" fill="url(#@cf)"/>` +
        `<ellipse cx="50" cy="48" rx="22" ry="12.6" fill="none" stroke="#b67918" stroke-opacity=".55" stroke-width="1.4"/>` +
        `<g transform="translate(50 48) scale(1 .6)"><g fill="url(#@cs)">${star}</g></g>` +
        `<path d="M30 42a26 15 0 0 1 22-9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>` +
        `</g>`,
    };
  },
  'dice-roller': () => ({
    background: ['#ff7a8a', '#c81d5a'],
    art:
      `<ellipse cx="50" cy="84" rx="30" ry="3.5" fill="#000" opacity=".2" filter="url(#@f)"/>` +
      die(36, 58, 34, -14, [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) +
      die(66, 40, 30, 18, [[0, 0]], '#ff3b30').replace('r="2.55"', 'r="4.2"') +
      `<path d="M78 70c3 2 5 5 6 9M84 64c2 1.4 3.4 3.4 4 6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>`,
  }),
  'doc-editor': ({ dark }) => {
    const tone = tones(dark);
    const page = '<rect x="18" y="20" width="56" height="70" rx="7"/>';
    const bar = '<rect x="30" y="10" width="52" height="18" rx="9"/>';
    const pencil = '<path d="M-4-28h8v40l-4 8-4-8Z"/>';
    return {
      background: ['#7ad3ff', '#2463c9'],
      defs: linear('dp', ['#ffd60a', '#ff9f0a']) + linear('dt', dark ? ['#5a5a61', '#36363b'] : ['#3a3a40', '#141416']),
      art:
        shadow(page, 3, 0.3) +
        `<g fill="url(#@q)">${page}</g>` +
        `<rect x="26" y="36" width="30" height="6" rx="3" fill="${tone.ink}"/>` +
        [[48, 40], [56, 36], [64, 40], [72, 26]].map(([y, width]) => `<rect x="26" y="${y}" width="${width}" height="3.6" rx="1.8" fill="${tone.rule}"/>`).join('') +
        shadow(bar, 2, 0.35) +
        `<g fill="url(#@dt)">${bar}</g>` +
        `<path d="M40 14.5v9h4.6a2.4 2.4 0 0 0 0-4.8H40m0 0h4a2.1 2.1 0 0 0 0-4.2H40" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M55 14.5h4.4M53 23.5h4.4M57.2 14.5l-2 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M66 14.5v5.5a3.2 3.2 0 0 0 6.4 0v-5.5M65 24.5h8.4" fill="none" stroke="#64d2ff" stroke-width="2" stroke-linecap="round"/>` +
        `<g transform="translate(78 62) rotate(28)">${shadow(pencil, 2.5, 0.35)}<g fill="url(#@dp)">${pencil}</g><path d="M-4 12h8l-4 8Z" fill="#f2d3a5"/><path d="M-1.4 17.2h2.8L0 20Z" fill="#1c1c1e"/><rect x="-4" y="-32" width="8" height="5" rx="1.6" fill="#ff8fa3"/></g>`,
    };
  },
  'gitignore-generator': () => {
    const graph = '<path d="M30 16v68M30 50c0-12 22-10 22-24V18" fill="none" stroke-width="5" stroke-linecap="round"/>';
    const commits = [[30, 24], [30, 50], [30, 76], [52, 22]];
    return {
      background: ['#ff9a6b', '#d6361c'],
      art:
        shadow(graph, 2, 0.25) +
        `<g stroke="#fff">${graph}</g>` +
        commits.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5" fill="#fff"/><circle cx="${x}" cy="${y}" r="3.2" fill="#d6361c"/>`).join('') +
        shadow('<circle cx="68" cy="66" r="18"/>', 3, 0.35) +
        `<circle cx="68" cy="66" r="18" fill="#1c1c1e"/>` +
        `<path d="M56 66s4.8-7.5 12-7.5S80 66 80 66s-4.8 7.5-12 7.5S56 66 56 66Z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>` +
        `<circle cx="68" cy="66" r="3.2" fill="#fff"/>` +
        `<path d="M58 76 78 56" stroke="#1c1c1e" stroke-width="6" stroke-linecap="round"/><path d="M58 76 78 56" stroke="#ff6b4a" stroke-width="2.6" stroke-linecap="round"/>`,
    };
  },
  inspector: ({ dark }) => {
    const tone = tones(dark);
    const page = '<path d="M20 12h32l16 16v52a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6Z"/>';
    return {
      background: ['#f7f4ff', '#cfc3ef'],
      defs: aurora('ia') + radial('il', [['#ffffff', 0.7], ['#efe8ff', 0.3]], 0.4, 0.35, 0.7),
      art:
        shadow(page, 3, 0.22) +
        `<g fill="url(#@q)">${page}</g>` +
        `<path d="M52 12v12a4 4 0 0 0 4 4h12" fill="${tone.faint}"/>` +
        [[26, 26], [34, 34], [42, 30], [50, 36], [58, 22], [66, 28]].map(([y, width]) => `<rect x="22" y="${y}" width="${width}" height="3.6" rx="1.8" fill="${tone.rule}"/>`).join('') +
        `<rect x="22" y="42" width="30" height="3.6" rx="1.8" fill="url(#@ia)" opacity=".8"/>` +
        shadow('<path d="m74 74 14 14"/>', 2, 0.35) +
        `<path d="m74 74 13 13" stroke="${dark ? '#8e8e96' : '#3a3a40'}" stroke-width="8" stroke-linecap="round"/>` +
        `<circle cx="60" cy="60" r="21" fill="#8a6bff" opacity=".35" filter="url(#@f)"/>` +
        `<circle cx="60" cy="60" r="18" fill="url(#@il)" stroke="url(#@ia)" stroke-width="5"/>` +
        `<g fill="url(#@ia)">${spark(60, 60, 18)}</g>` +
        `<path d="M49 53a13 13 0 0 1 8-6.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
    };
  },
  letters: () => {
    const font = `font-family="-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', 'Noto Sans JP', 'Segoe UI', sans-serif"`;
    const block = (x, y, size, angle, colour, glyph) =>
      `<g transform="translate(${x} ${y}) rotate(${angle})">` +
      shadow(`<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="${size * 0.2}"/>`, 3, 0.3) +
      `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="${size * 0.2}" fill="${colour}"/>` +
      `<rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#@lb)"/>` +
      `<rect x="${-size / 2 + 4}" y="${-size / 2 + 4}" width="${size - 8}" height="${size - 8}" rx="${size * 0.14}" fill="#fff" opacity=".92"/>` +
      `<text y="${size * 0.2}" text-anchor="middle" ${font} font-size="${size * 0.5}" font-weight="700" fill="${colour}">${glyph}</text></g>`;
    return {
      background: ['#fff3d6', '#f2a65a'],
      defs: linear('lb', [['#fff', 0.3], ['#000', 0.15]]),
      art: block(31, 66, 34, -8, '#0a84ff', 'Б') + block(68, 64, 34, 7, '#ff375f', 'あ') + block(50, 32, 32, -3, '#30b94f', 'α'),
    };
  },
  'optics-lab': () => {
    const lens = '<path d="M46 16c-7 10-10 21.5-10 34s3 24 10 34h8c7-10 10-21.5 10-34s-3-24-10-34Z"/>';
    const rays = [30, 50, 70].map((y) => `<path d="M6 ${y}H50L84 50"/>`).join('');
    return {
      background: ['#1f3b73', '#060c1f'],
      defs: linear('ol', [['#ffffff', 0.55], ['#bfe9ff', 0.15]], 0, 0, 1, 0),
      art:
        `<path d="M6 50h88" stroke="#fff" stroke-opacity=".15" stroke-width="1" stroke-dasharray="3 3"/>` +
        `<g fill="none" stroke="#ffb340" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity=".45" filter="url(#@f)">${rays}</g>` +
        `<g fill="none" stroke="#ffd27a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${rays}</g>` +
        shadow(lens, 2.5, 0.4) +
        `<g fill="url(#@ol)" stroke="#fff" stroke-opacity=".85" stroke-width="1.4">${lens}</g>` +
        `<path d="M44 22c-4.6 8.4-6.6 17.6-6.6 28" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
        `<circle cx="84" cy="50" r="9" fill="#ffd27a" opacity=".6" filter="url(#@f)"/>` +
        `<circle cx="84" cy="50" r="3.4" fill="#fff"/>`,
    };
  },
  scanner: () => {
    const finder = (x, y) => `<path fill-rule="evenodd" d="M${x + 3} ${y}h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V${y + 3}a3 3 0 0 1 3-3Zm1.4 3a1.4 1.4 0 0 0-1.4 1.4v4.2a1.4 1.4 0 0 0 1.4 1.4h4.2a1.4 1.4 0 0 0 1.4-1.4V${y + 4.4}a1.4 1.4 0 0 0-1.4-1.4Z"/><rect x="${x + 4.6}" y="${y + 4.6}" width="3.8" height="3.8" rx="1"/>`;
    const dots = [[36, 50], [43, 57], [50, 50], [57, 57], [64, 50], [50, 64], [64, 64], [47, 36], [47, 43], [57, 64]]
      .map(([x, y]) => `<rect x="${x}" y="${y}" width="4.4" height="4.4" rx="1.2"/>`)
      .join('');
    return {
      background: ['#ffe066', '#ff9f0a'],
      art:
        `<path d="M14 32V20a6 6 0 0 1 6-6h12M68 14h12a6 6 0 0 1 6 6v12M86 68v12a6 6 0 0 1-6 6H68M32 86H20a6 6 0 0 1-6-6V68" fill="none" stroke="#1c1c1e" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        shadow('<rect x="28" y="28" width="44" height="44" rx="7"/>', 2.5, 0.25) +
        `<rect x="28" y="28" width="44" height="44" rx="7" fill="#fff"/>` +
        `<g fill="#1c1c1e">${finder(33, 33)}${finder(54, 33)}${finder(33, 54)}${dots}</g>` +
        `<rect x="10" y="48" width="80" height="4" rx="2" fill="#ff3b30" opacity=".6" filter="url(#@s)"/>` +
        `<rect x="12" y="49" width="76" height="2.2" rx="1.1" fill="#ff453a"/>`,
    };
  },
  'tax-calculator': () => {
    const receipt = `<path d="M20 12h48v72${Array.from({ length: 8 }, () => 'l-3-4-3 4').join('')}V12Z"/>`;
    return {
      background: ['#7f8cff', '#6a3fb0'],
      defs: linear('tb', ['#ffcf5c', '#ff8a00']),
      art:
        shadow(receipt, 3, 0.3) +
        `<g fill="#fff">${receipt}</g>` +
        `<rect x="28" y="22" width="20" height="4" rx="2" fill="#3a3a3c"/>` +
        [34, 42, 50].map((y, index) => `<rect x="28" y="${y}" width="${[18, 14, 20][index]}" height="3.2" rx="1.6" fill="#d1d1d6"/><rect x="${52 + (index % 2) * 3}" y="${y}" width="${8 - (index % 2) * 3}" height="3.2" rx="1.6" fill="#d1d1d6"/>`).join('') +
        `<path d="M28 59h32" stroke="#c7c7cc" stroke-width="1.2" stroke-dasharray="2 2"/>` +
        `<rect x="28" y="64" width="12" height="4.4" rx="2.2" fill="#3a3a3c"/><rect x="43" y="64" width="9" height="4.4" rx="2.2" fill="#30b94f"/>` +
        shadow('<circle cx="73" cy="72" r="15"/>', 2.5, 0.35) +
        `<circle cx="73" cy="72" r="15" fill="url(#@tb)" stroke="#fff" stroke-width="2.4"/>` +
        `<path d="M79.5 64.5 66.5 79.5" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="68" cy="67" r="2.9" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="78" cy="77" r="2.9" fill="none" stroke="#fff" stroke-width="2.5"/>`,
    };
  },
};

export const artNames = Object.keys(ART);

const drawn = new Map();

// the finished drawing for an app, or null when it has none yet
export const appArt = (id, { dark = false } = {}) => {
  if (!ART[id]) return null;
  const key = `${id}:${dark ? 'dark' : 'light'}`;
  if (drawn.has(key)) return drawn.get(key);
  const { background, defs = '', art, live } = ART[id]({ dark });
  const markup =
    `<defs>${plate(background, dark)}${defs}</defs>` +
    `<g clip-path="url(#@c)"><rect width="100" height="100" fill="url(#@b)"/><rect width="100" height="100" fill="url(#@t)"/>${art}</g>` +
    `<path d="${SQUIRCLE}" fill="none" stroke="url(#@r)" stroke-width="1.5" clip-path="url(#@c)"/>`;
  if (!live) drawn.set(key, markup);
  return markup;
};
