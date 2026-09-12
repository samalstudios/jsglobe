// Tracing the outline of a picture. Which pixels are the subject is decided
// first, then tidied, and the edge round what is left is walked as closed
// rings of points, ready to become an SVG path.
//
// Nothing here touches the page. A picture arrives as its pixels, in the same
// shape canvas ImageData has, so all of it runs, and is checked, without a
// browser.

export const MODES = ['alpha', 'dark', 'light', 'colour'];

export const DEFAULT_THRESHOLD = { alpha: 128, dark: 128, light: 128, colour: 48 };

const clampNumber = (value, low, high) => Math.min(high, Math.max(low, value));

// ---- which pixels are the subject ---------------------------------------

/** The colour most of the border is, which is nearly always the background. */
export const borderColour = ({ data, width, height }) => {
  const channels = [[], [], [], []];
  const take = (x, y) => {
    const at = (y * width + x) * 4;
    for (let channel = 0; channel < 4; channel += 1) channels[channel].push(data[at + channel]);
  };
  for (let x = 0; x < width; x += 1) {
    take(x, 0);
    if (height > 1) take(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    take(0, y);
    if (width > 1) take(width - 1, y);
  }
  // the middle value of each channel, so a subject touching the edge in one
  // place does not drag the answer towards itself
  const [r, g, b, a] = channels.map((list) => list.sort((p, q) => p - q)[list.length >> 1] ?? 0);
  return { r, g, b, a };
};

/** A see-through border means the picture was cut out already; otherwise tell the subject by colour. */
export const guessMode = (image) => (borderColour(image).a < 128 ? 'alpha' : 'colour');

/**
 * How much each pixel is the subject, from 0 to 1, and the level the edge is
 * drawn at. Keeping the amount rather than a yes or no is what lets the edge
 * land between pixels on a soft, anti-aliased border.
 */
export const fieldFrom = (image, options = {}) => {
  const { data, width, height } = image;
  const mode = MODES.includes(options.mode) ? options.mode : 'alpha';
  const threshold = clampNumber(Math.round(options.threshold ?? DEFAULT_THRESHOLD[mode]), 1, 254);
  const background = options.background ?? borderColour(image);
  const field = new Float32Array(width * height);
  // where the raw measure is cut; for dark parts, the darkness they need
  const cut = mode === 'dark' ? 1 - threshold / 255 : threshold / 255;
  const below = 0.5 / cut;
  const above = 0.5 / (1 - cut);

  for (let index = 0, at = 0; index < field.length; index += 1, at += 4) {
    const alpha = data[at + 3] / 255;
    let raw;
    if (mode === 'alpha') {
      raw = alpha;
    } else if (mode === 'colour') {
      const dr = data[at] - background.r;
      const dg = data[at + 1] - background.g;
      const db = data[at + 2] - background.b;
      // whatever the test, a see-through pixel is not part of the subject
      raw = Math.min(1, Math.sqrt(dr * dr + dg * dg + db * db) / 255) * alpha;
    } else {
      const luma = (0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2]) / 255;
      raw = (mode === 'dark' ? 1 - luma : luma) * alpha;
    }
    // Stretched so the threshold sits at a half. A hard edge, which jumps from
    // nothing to everything between two pixels, then crosses on the pixel
    // boundary whatever the threshold, while a soft one still crosses where it
    // reaches the threshold. Unstretched, a hard edge drifted by up to a third
    // of a pixel as the threshold moved.
    field[index] = raw < cut ? raw * below : 0.5 + (raw - cut) * above;
  }

  return { field, level: 0.5, width, height, mode, threshold, background };
};

export const maskFrom = (field, level) => {
  const mask = new Uint8Array(field.length);
  for (let index = 0; index < field.length; index += 1) mask[index] = field[index] >= level ? 1 : 0;
  return mask;
};

// ---- tidying the decision up --------------------------------------------

/** Every run of touching pixels of one value, with its size and whether it reaches the border. */
const regions = (mask, width, height, value) => {
  const label = new Int32Array(mask.length).fill(-1);
  const sizes = [];
  const edges = [];
  const stack = new Int32Array(mask.length);

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== value || label[start] !== -1) continue;
    const id = sizes.length;
    let top = 0;
    let size = 0;
    let touches = false;
    stack[top++] = start;
    label[start] = id;

    while (top) {
      const at = stack[--top];
      size += 1;
      const x = at % width;
      const y = (at - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touches = true;
      if (x > 0 && mask[at - 1] === value && label[at - 1] === -1) {
        label[at - 1] = id;
        stack[top++] = at - 1;
      }
      if (x < width - 1 && mask[at + 1] === value && label[at + 1] === -1) {
        label[at + 1] = id;
        stack[top++] = at + 1;
      }
      if (y > 0 && mask[at - width] === value && label[at - width] === -1) {
        label[at - width] = id;
        stack[top++] = at - width;
      }
      if (y < height - 1 && mask[at + width] === value && label[at + width] === -1) {
        label[at + width] = id;
        stack[top++] = at + width;
      }
    }
    sizes.push(size);
    edges.push(touches);
  }
  return { label, sizes, edges };
};

/** Islands of subject smaller than this many pixels are dust, and go. */
export const dropSpecks = (mask, width, height, minArea) => {
  if (!(minArea > 1)) return mask;
  const out = mask.slice();
  const { label, sizes } = regions(mask, width, height, 1);
  for (let index = 0; index < out.length; index += 1) {
    if (out[index] && sizes[label[index]] < minArea) out[index] = 0;
  }
  return out;
};

/** Gaps inside the subject that do not reach the border are filled, up to a size. */
export const fillHoles = (mask, width, height, maxArea = Infinity) => {
  const out = mask.slice();
  const { label, sizes, edges } = regions(mask, width, height, 0);
  for (let index = 0; index < out.length; index += 1) {
    if (!out[index] && !edges[label[index]] && sizes[label[index]] <= maxArea) out[index] = 1;
  }
  return out;
};

// ---- growing and shrinking ----------------------------------------------

const FAR = 1e20;

// Felzenszwalb and Huttenlocher's distance transform along one line: the lower
// envelope of the parabolas rooted at every sample, walked once.
const envelope = (f, n, d, v, z) => {
  let k = 0;
  v[0] = 0;
  z[0] = -FAR;
  z[1] = FAR;
  for (let q = 1; q < n; q += 1) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k -= 1;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = FAR;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1] < q) k += 1;
    const step = q - v[k];
    d[q] = step * step + f[v[k]];
  }
};

/** Squared distance from every pixel to the nearest pixel holding `value`. */
const distanceTo = (mask, width, height, value) => {
  const grid = new Float64Array(width * height);
  for (let index = 0; index < grid.length; index += 1) grid[index] = mask[index] === value ? 0 : FAR;
  const longest = Math.max(width, height);
  const f = new Float64Array(longest);
  const d = new Float64Array(longest);
  const v = new Int32Array(longest);
  const z = new Float64Array(longest + 1);

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) f[y] = grid[y * width + x];
    envelope(f, height, d, v, z);
    for (let y = 0; y < height; y += 1) grid[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) f[x] = grid[row + x];
    envelope(f, width, d, v, z);
    for (let x = 0; x < width; x += 1) grid[row + x] = d[x];
  }
  return grid;
};

/**
 * The subject grown outwards, or shrunk inwards for a negative radius, as a
 * field rather than a yes or no. Measuring the distance and drawing the edge
 * at the right one keeps a grown corner round instead of stepped.
 */
export const offsetField = (mask, width, height, radius) => {
  const out = new Float32Array(mask.length);
  if (radius > 0) {
    const near = distanceTo(mask, width, height, 1);
    for (let index = 0; index < out.length; index += 1) {
      out[index] = clampNumber(radius + 0.5 - Math.sqrt(near[index]), -1, 1) * 0.5 + 0.5;
    }
  } else {
    const near = distanceTo(mask, width, height, 0);
    for (let index = 0; index < out.length; index += 1) {
      out[index] = clampNumber(Math.sqrt(near[index]) + radius - 0.5, -1, 1) * 0.5 + 0.5;
    }
  }
  return out;
};

const padded = (values, width, height, pad) => {
  const wide = width + pad * 2;
  const out = new values.constructor(wide * (height + pad * 2));
  for (let y = 0; y < height; y += 1) {
    out.set(values.subarray(y * width, (y + 1) * width), (y + pad) * wide + pad);
  }
  return out;
};

// ---- walking the edge ---------------------------------------------------

/**
 * Marching squares over a field sampled at pixel centres, with the picture
 * framed in nothing so every edge comes back to where it started. Each
 * crossing is placed where the field actually reaches the level, not halfway.
 */
export const contours = (values, width, height, level) => {
  const across = width + 2;
  const sample = (i, j) => (i < 0 || j < 0 || i >= width || j >= height ? 0 : values[j * width + i]);
  const inside = (i, j) => sample(i, j) >= level;
  const key = (i, j, vertical) => ((j + 1) * across + (i + 1)) * 2 + (vertical ? 1 : 0);

  // every crossing is met by exactly two cells, so joining the pair each cell
  // draws gives a set of closed loops with no loose ends
  const links = new Map();
  const add = (from, to) => {
    const list = links.get(from);
    if (list) list.push(to);
    else links.set(from, [to]);
  };
  const link = (a, b) => {
    add(a, b);
    add(b, a);
  };

  for (let j = -1; j < height; j += 1) {
    for (let i = -1; i < width; i += 1) {
      const code =
        (inside(i, j) ? 8 : 0) | (inside(i + 1, j) ? 4 : 0) | (inside(i + 1, j + 1) ? 2 : 0) | (inside(i, j + 1) ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const top = key(i, j, false);
      const bottom = key(i, j + 1, false);
      const left = key(i, j, true);
      const right = key(i + 1, j, true);

      switch (code) {
        case 1: case 14: link(left, bottom); break;
        case 2: case 13: link(bottom, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(top, right); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(top, left); break;
        default: {
          // Two corners inside, facing each other across the cell. Whether
          // they join depends on the middle, or the outline crosses itself.
          // A middle exactly on the level keeps them apart, so two pixels
          // touching only at a corner are two shapes, as the dust count sees
          // them too.
          const middle = (sample(i, j) + sample(i + 1, j) + sample(i + 1, j + 1) + sample(i, j + 1)) / 4 > level;
          if ((code === 5) === middle) {
            link(top, left);
            link(bottom, right);
          } else {
            link(top, right);
            link(left, bottom);
          }
        }
      }
    }
  }

  const place = (edge) => {
    const vertical = edge % 2;
    const cell = (edge - vertical) / 2;
    const i = (cell % across) - 1;
    const j = Math.floor(cell / across) - 1;
    const i2 = vertical ? i : i + 1;
    const j2 = vertical ? j + 1 : j;
    const a = sample(i, j);
    const b = sample(i2, j2);
    const share = a === b ? 0.5 : (level - a) / (b - a);
    return { x: i + 0.5 + (i2 - i) * share, y: j + 0.5 + (j2 - j) * share };
  };

  const rings = [];
  const seen = new Set();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const ring = [];
    let previous = -1;
    let at = start;
    while (!seen.has(at)) {
      seen.add(at);
      ring.push(place(at));
      const [first, second] = links.get(at);
      const next = first !== previous ? first : second;
      previous = at;
      at = next;
    }
    if (ring.length >= 3) rings.push(ring);
  }
  return rings;
};

// ---- shaping the rings --------------------------------------------------

export const signedArea = (points) => {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    total += a.x * b.y - b.x * a.y;
  }
  return total / 2;
};

const holds = (points, point) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (a.y > point.y === b.y > point.y) continue;
    if (a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x) > point.x) inside = !inside;
  }
  return inside;
};

export const boundsOf = (rings) => {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const ring of rings) {
    for (const point of ring.points ?? ring) {
      if (point.x < left) left = point.x;
      if (point.x > right) right = point.x;
      if (point.y < top) top = point.y;
      if (point.y > bottom) bottom = point.y;
    }
  }
  return left === Infinity ? null : { left, top, right, bottom };
};

/**
 * Which rings are holes, found by how many others each sits inside, and every
 * ring turned the same way as the rest of its kind: outlines one way round and
 * holes the other, as anything filling them by winding expects.
 */
export const arrange = (rings) => {
  const boxes = rings.map((ring) => boundsOf([ring]));
  return rings.map((ring, index) => {
    const probe = ring[0];
    let depth = 0;
    rings.forEach((other, at) => {
      const box = boxes[at];
      if (at === index || probe.x < box.left || probe.x > box.right || probe.y < box.top || probe.y > box.bottom) return;
      if (holds(other, probe)) depth += 1;
    });
    const hole = depth % 2 === 1;
    const area = signedArea(ring);
    return { points: (hole ? area > 0 : area < 0) ? ring.slice().reverse() : ring, hole };
  });
};

const nearest = (point, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = dx * dx + dy * dy;
  if (!span) return Math.hypot(point.x - a.x, point.y - a.y);
  const along = clampNumber(((point.x - a.x) * dx + (point.y - a.y) * dy) / span, 0, 1);
  return Math.hypot(point.x - (a.x + dx * along), point.y - (a.y + dy * along));
};

// Douglas-Peucker on an open run: keep the point furthest from the chord if it
// is further than the tolerance, and look again either side of it.
const thin = (points, tolerance) => {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let worst = tolerance;
    let at = -1;
    for (let index = start + 1; index < end; index += 1) {
      const gap = nearest(points[index], points[start], points[end]);
      if (gap > worst) {
        worst = gap;
        at = index;
      }
    }
    if (at < 0) continue;
    keep[at] = 1;
    stack.push([start, at], [at, end]);
  }
  return points.filter((point, index) => keep[index]);
};

const thinRing = (points, tolerance) => {
  if (points.length < 4) return points;
  // split at the point furthest from the first, so both halves are open runs
  // whose ends are certain to stay
  let far = 0;
  let best = -1;
  for (let index = 1; index < points.length; index += 1) {
    const gap = (points[index].x - points[0].x) ** 2 + (points[index].y - points[0].y) ** 2;
    if (gap > best) {
      best = gap;
      far = index;
    }
  }
  const first = thin(points.slice(0, far + 1), tolerance);
  const second = thin([...points.slice(far), points[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
};

const meeting = (a, b, c, d) => {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const cross = rx * sy - ry * sx;
  if (Math.abs(cross) < 1e-9) return null;
  const along = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
  return { x: a.x + rx * along, y: a.y + ry * along };
};

// A hard corner comes out of the tracer with its tip cut off, half a pixel on
// a side. Simplifying keeps one end of that cut and drops the other, which
// moved a whole side of a square inwards by half a pixel. Where two long
// straight runs meet through a short step, the step becomes the corner they
// would have met at. A curve is left alone: its runs are all short.
const squareCorners = (points) => {
  const count = points.length;
  if (count < 5) return points;
  const span = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const used = new Uint8Array(count);
  const corners = new Map();

  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    if (used[index] || used[next]) continue;
    const from = points[index];
    const to = points[next];
    if (span(from, to) > 1.5) continue;
    const before = points[(index - 1 + count) % count];
    const after = points[(next + 1) % count];
    if (span(before, from) < 2 || span(to, after) < 2) continue;
    const corner = meeting(before, from, to, after);
    if (!corner || span(corner, { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }) > 1.5) continue;
    used[index] = 1;
    used[next] = 1;
    corners.set(index, corner);
  }
  if (!corners.size) return points;
  const out = [];
  for (let index = 0; index < count; index += 1) {
    if (corners.has(index)) out.push(corners.get(index));
    else if (!used[index]) out.push(points[index]);
  }
  return out;
};

/** A closed ring with the points that only ever made it smooth taken out. */
export const simplifyRing = (points, tolerance = 1) => {
  if (points.length < 4 || !(tolerance > 0)) return points;
  // straight runs first collapse to their ends, so a corner can be told from
  // a curve, then the corners are squared, then the real simplifying
  const tidy = squareCorners(thinRing(points, Math.min(0.05, tolerance)));
  return thinRing(tidy, tolerance);
};

// ---- the whole thing ----------------------------------------------------

/**
 * Trace a picture. Lengths in the options, and the rings that come back, are
 * in the units of the output: when `scale` says the picture was shrunk to be
 * traced, a speck or an offset still means what it says at full size.
 */
export const traceImage = (image, options = {}) => {
  const mode = MODES.includes(options.mode) ? options.mode : guessMode(image);
  const scale = options.scale > 0 ? options.scale : 1;
  const { field, level, threshold, background } = fieldFrom(image, { ...options, mode });
  const { width, height } = image;
  const empty = { rings: [], width: width * scale, height: height * scale, mode, threshold, background };
  if (!width || !height) return empty;

  const specks = Math.max(0, options.specks ?? 0) / (scale * scale);
  let mask = maskFrom(field, level);
  if (specks > 1) mask = dropSpecks(mask, width, height, specks);
  if (options.fillHoles) mask = fillHoles(mask, width, height);
  else if (specks > 1) mask = fillHoles(mask, width, height, specks);

  const offset = (options.offset ?? 0) / scale;
  let values;
  let edge = level;
  let pad = 0;
  let wide = width;
  let tall = height;

  if (offset) {
    // room round the picture for the outline to grow into
    pad = Math.max(0, Math.ceil(offset)) + 2;
    wide = width + pad * 2;
    tall = height + pad * 2;
    values = offsetField(padded(mask, width, height, pad), wide, tall, offset);
    edge = 0.5;
  } else {
    // where tidying changed the answer the field is overruled; everywhere
    // else it keeps its soft edge
    values = new Float32Array(field.length);
    for (let index = 0; index < field.length; index += 1) {
      const kept = field[index] >= level;
      values[index] = mask[index] ? (kept ? field[index] : 1) : kept ? 0 : field[index];
    }
  }

  const raw = contours(values, wide, tall, edge).map((ring) =>
    ring.map((point) => ({ x: (point.x - pad) * scale, y: (point.y - pad) * scale })),
  );
  const tolerance = options.tolerance ?? 1;
  const rings = arrange(raw)
    .map((ring) => ({ points: simplifyRing(ring.points, tolerance), hole: ring.hole }))
    .filter((ring) => ring.points.length >= 3 && Math.abs(signedArea(ring.points)) > 1e-9);

  return { ...empty, rings };
};

export const statsOf = (rings) => ({
  shapes: rings.filter((ring) => !ring.hole).length,
  holes: rings.filter((ring) => ring.hole).length,
  points: rings.reduce((total, ring) => total + ring.points.length, 0),
});

// ---- writing it out -----------------------------------------------------

const number = (value, digits) => {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

const shorten = (vector, most) => {
  const length = Math.hypot(vector.x, vector.y);
  return length > most && length ? { x: (vector.x / length) * most, y: (vector.y / length) * most } : vector;
};

const ringPath = (points, smooth, corner, digits) => {
  const count = points.length;
  if (count < 3) return '';
  const at = (point) => `${number(point.x, digits)} ${number(point.y, digits)}`;
  if (!smooth) return `M${at(points[0])}${points.slice(1).map((point) => `L${at(point)}`).join('')}Z`;

  // a turn sharper than the corner angle stays a corner, so a square keeps
  // its corners while a circle comes out round
  const limit = Math.cos((corner * Math.PI) / 180);
  const sharp = points.map((point, index) => {
    const before = points[(index - 1 + count) % count];
    const after = points[(index + 1) % count];
    const ux = point.x - before.x;
    const uy = point.y - before.y;
    const vx = after.x - point.x;
    const vy = after.y - point.y;
    const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    return !lengths || (ux * vx + uy * vy) / lengths < limit;
  });
  // Catmull-Rom tangents, a third of the way to the next point
  const tangent = points.map((point, index) => {
    if (sharp[index]) return { x: 0, y: 0 };
    const before = points[(index - 1 + count) % count];
    const after = points[(index + 1) % count];
    return { x: (after.x - before.x) / 6, y: (after.y - before.y) / 6 };
  });

  let path = `M${at(points[0])}`;
  for (let index = 0; index < count; index += 1) {
    const next = (index + 1) % count;
    const from = points[index];
    const to = points[next];
    if (sharp[index] && sharp[next]) {
      if (next !== 0) path += `L${at(to)}`;
      continue;
    }
    // a control reaching past half the segment would make the curve loop
    const half = Math.hypot(to.x - from.x, to.y - from.y) / 2;
    const leaving = shorten(tangent[index], half);
    const arriving = shorten(tangent[next], half);
    path += `C${at({ x: from.x + leaving.x, y: from.y + leaving.y })} ${at({ x: to.x - arriving.x, y: to.y - arriving.y })} ${at(to)}`;
  }
  return `${path}Z`;
};

/** Every ring as one path: straight segments, or curves through the same points. */
export const toPath = (rings, { smooth = false, corner = 55, digits = 2 } = {}) =>
  rings.map((ring) => ringPath(ring.points ?? ring, smooth, corner, digits)).join('');

const COLOUR = /^#[0-9a-f]{3,8}$/i;

/**
 * A finished SVG. The view covers both the picture and the outline, since an
 * outline grown past the picture's edge would otherwise be cut off.
 */
export const toSvg = (result, options = {}) => {
  const { rings, width, height } = result;
  const style = options.style === 'filled' ? 'filled' : 'outline';
  const stroke = COLOUR.test(options.stroke ?? '') ? options.stroke : '#e11d48';
  const fill = COLOUR.test(options.fill ?? '') ? options.fill : '#111111';
  const strokeWidth = options.strokeWidth > 0 ? options.strokeWidth : 2;
  const digits = options.digits ?? 2;
  const path = toPath(rings, { smooth: options.smooth, corner: options.corner, digits });

  const outline = boundsOf(rings) ?? { left: 0, top: 0, right: width, bottom: height };
  const margin = style === 'outline' ? strokeWidth / 2 : 0;
  const left = Math.min(0, outline.left) - margin;
  const top = Math.min(0, outline.top) - margin;
  const right = Math.max(width, outline.right) + margin;
  const bottom = Math.max(height, outline.bottom) + margin;
  const wide = number(right - left, 2);
  const tall = number(bottom - top, 2);

  const picture = options.picture
    ? `<image href="${String(options.picture).replace(/"/g, '%22')}" x="0" y="0" width="${number(width, 2)}" height="${number(height, 2)}"/>`
    : '';
  const paint =
    style === 'filled'
      ? `fill="${fill}" fill-rule="evenodd"`
      : `fill="none" stroke="${stroke}" stroke-width="${number(strokeWidth, 2)}" stroke-linejoin="round"`;
  const shape = path ? `<path d="${path}" ${paint}/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${tall}" viewBox="${number(left, 2)} ${number(top, 2)} ${wide} ${tall}">${picture}${shape}</svg>`;
};
