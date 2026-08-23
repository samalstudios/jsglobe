// Icon parts are generated rather than drawn one by one: each family takes a
// few numbers and turns them into a distinct shape, so a handful of families
// covers thousands of pieces. Everything is drawn inside a 0..100 box.
import { glyphNames, glyphPath } from './glyphs.js';

const round = (value) => Math.round(value * 100) / 100;
const point = (angle, radius, cx = 50, cy = 50) => [
  round(cx + Math.cos(angle) * radius),
  round(cy + Math.sin(angle) * radius),
];

const ring = (points, close = true) =>
  `${points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join('')}${close ? 'Z' : ''}`;

// A polygon with optional corner rounding, built from arcs between the edges.
const polygon = (sides, radius, rotation, soften) => {
  const corners = Array.from({ length: sides }, (item, index) =>
    point(rotation + (index / sides) * Math.PI * 2 - Math.PI / 2, radius),
  );
  if (soften <= 0) return ring(corners);

  const edge = (2 * radius * Math.sin(Math.PI / sides)) / 2;
  const cut = Math.min(edge * 0.92, edge * soften * 2);
  let path = '';
  for (let index = 0; index < sides; index += 1) {
    const here = corners[index];
    const prev = corners[(index - 1 + sides) % sides];
    const next = corners[(index + 1) % sides];
    const towards = ([ax, ay], [bx, by]) => {
      const dx = bx - ax;
      const dy = by - ay;
      const length = Math.hypot(dx, dy) || 1;
      return [round(ax + (dx / length) * cut), round(ay + (dy / length) * cut)];
    };
    const start = towards(here, prev);
    const end = towards(here, next);
    path += index ? `L${start[0]} ${start[1]}` : `M${start[0]} ${start[1]}`;
    path += `Q${here[0]} ${here[1]} ${end[0]} ${end[1]}`;
  }
  return `${path}Z`;
};

const star = (points, outer, inner, rotation) => {
  const corners = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 ? inner : outer;
    corners.push(point(rotation + (index / (points * 2)) * Math.PI * 2 - Math.PI / 2, radius));
  }
  return ring(corners);
};

const gear = (teeth, outer, depth) => {
  const inner = outer * (1 - depth);
  const corners = [];
  const step = (Math.PI * 2) / teeth;
  for (let index = 0; index < teeth; index += 1) {
    const base = index * step - Math.PI / 2;
    corners.push(point(base - step * 0.22, inner));
    corners.push(point(base - step * 0.12, outer));
    corners.push(point(base + step * 0.12, outer));
    corners.push(point(base + step * 0.22, inner));
  }
  return ring(corners);
};

const rays = (count, inner, outer, thickness) => {
  const step = (Math.PI * 2) / count;
  let path = '';
  for (let index = 0; index < count; index += 1) {
    const base = index * step - Math.PI / 2;
    const a = point(base - thickness, inner);
    const b = point(base - thickness * 0.6, outer);
    const c = point(base + thickness * 0.6, outer);
    const d = point(base + thickness, inner);
    path += `M${a[0]} ${a[1]}L${b[0]} ${b[1]}L${c[0]} ${c[1]}L${d[0]} ${d[1]}Z`;
  }
  return path;
};

const arc = (spanDegrees, radius, thickness, rotation) => {
  const span = (spanDegrees * Math.PI) / 180;
  const from = rotation - span / 2 - Math.PI / 2;
  const to = rotation + span / 2 - Math.PI / 2;
  const outer = radius + thickness / 2;
  const inner = radius - thickness / 2;
  const big = span > Math.PI ? 1 : 0;
  const a = point(from, outer);
  const b = point(to, outer);
  const c = point(to, inner);
  const d = point(from, inner);
  return `M${a[0]} ${a[1]}A${outer} ${outer} 0 ${big} 1 ${b[0]} ${b[1]}L${c[0]} ${c[1]}A${inner} ${inner} 0 ${big} 0 ${d[0]} ${d[1]}Z`;
};

const petals = (count, length, width) => {
  const step = (Math.PI * 2) / count;
  let path = '';
  for (let index = 0; index < count; index += 1) {
    const base = index * step - Math.PI / 2;
    const tip = point(base, length);
    const left = point(base - width, length * 0.42);
    const right = point(base + width, length * 0.42);
    path += `M50 50Q${left[0]} ${left[1]} ${tip[0]} ${tip[1]}Q${right[0]} ${right[1]} 50 50Z`;
  }
  return path;
};

const dots = (rows, columns, radius) => {
  let path = '';
  const stepX = 70 / Math.max(1, columns - 1 || 1);
  const stepY = 70 / Math.max(1, rows - 1 || 1);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = columns === 1 ? 50 : round(15 + column * stepX);
      const y = rows === 1 ? 50 : round(15 + row * stepY);
      path += `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0Z`;
    }
  }
  return path;
};

const bars = (count, gap, tallest) => {
  let path = '';
  const width = (72 - gap * (count - 1)) / count;
  for (let index = 0; index < count; index += 1) {
    const height = tallest * (0.35 + 0.65 * Math.abs(Math.sin((index + 1) * 1.7)));
    const x = round(14 + index * (width + gap));
    const y = round(82 - height);
    path += `M${x} ${y}h${round(width)}v${round(height)}h${round(-width)}Z`;
  }
  return path;
};

const wave = (cycles, amplitude, thickness) => {
  const steps = 64;
  const top = [];
  const bottom = [];
  for (let index = 0; index <= steps; index += 1) {
    const x = round(12 + (index / steps) * 76);
    const y = 50 + Math.sin((index / steps) * Math.PI * 2 * cycles) * amplitude;
    top.push([x, round(y - thickness / 2)]);
    bottom.unshift([x, round(y + thickness / 2)]);
  }
  return ring([...top, ...bottom]);
};

const arrow = (direction, style) => {
  const turn = (direction * Math.PI) / 4;
  const spin = ([x, y]) => {
    const dx = x - 50;
    const dy = y - 50;
    return [round(50 + dx * Math.cos(turn) - dy * Math.sin(turn)), round(50 + dx * Math.sin(turn) + dy * Math.cos(turn))];
  };
  const shapes = {
    solid: [[50, 12], [78, 46], [62, 46], [62, 86], [38, 86], [38, 46], [22, 46]],
    slim: [[50, 14], [72, 40], [58, 40], [58, 84], [42, 84], [42, 40], [28, 40]],
    wide: [[50, 10], [88, 50], [66, 50], [66, 88], [34, 88], [34, 50], [12, 50]],
    stub: [[50, 18], [74, 46], [60, 46], [60, 70], [40, 70], [40, 46], [26, 46]],
    kite: [[50, 12], [80, 50], [50, 88], [20, 50]],
  };
  return ring(shapes[style].map(spin));
};

const chevron = (direction, thickness) => {
  const turn = (direction * Math.PI) / 4;
  const spin = ([x, y]) => {
    const dx = x - 50;
    const dy = y - 50;
    return [round(50 + dx * Math.cos(turn) - dy * Math.sin(turn)), round(50 + dx * Math.sin(turn) + dy * Math.cos(turn))];
  };
  const half = thickness / 2;
  const corners = [
    [50, 20 - half], [82, 52 - half], [82 - half * 1.4, 52 + half * 1.4],
    [50, 24 + half * 1.4], [18 + half * 1.4, 52 + half * 1.4], [18, 52 - half],
  ];
  return ring(corners.map(spin));
};

const blob = (seed, lobes, wobble) => {
  let value = seed * 9301 + 49297;
  const random = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
  const corners = [];
  for (let index = 0; index < lobes; index += 1) {
    const radius = 26 + wobble * (random() - 0.5) * 2;
    corners.push(point((index / lobes) * Math.PI * 2, radius));
  }
  let path = `M${corners[0][0]} ${corners[0][1]}`;
  for (let index = 0; index < corners.length; index += 1) {
    const here = corners[index];
    const next = corners[(index + 1) % corners.length];
    path += `Q${here[0]} ${here[1]} ${round((here[0] + next[0]) / 2)} ${round((here[1] + next[1]) / 2)}`;
  }
  return `${path}Z`;
};


const cross = (thickness, arm, rotation) => {
  const half = thickness / 2;
  const corners = [
    [50 - half, 50 - arm], [50 + half, 50 - arm], [50 + half, 50 - half], [50 + arm, 50 - half],
    [50 + arm, 50 + half], [50 + half, 50 + half], [50 + half, 50 + arm], [50 - half, 50 + arm],
    [50 - half, 50 + half], [50 - arm, 50 + half], [50 - arm, 50 - half], [50 - half, 50 - half],
  ];
  const turn = (rotation * Math.PI) / 180;
  return ring(
    corners.map(([x, y]) => {
      const dx = x - 50;
      const dy = y - 50;
      return [round(50 + dx * Math.cos(turn) - dy * Math.sin(turn)), round(50 + dx * Math.sin(turn) + dy * Math.cos(turn))];
    }),
  );
};

const hoop = (radius, thickness) => {
  const outer = radius + thickness / 2;
  const inner = radius - thickness / 2;
  return (
    `M${50 - outer} 50a${outer} ${outer} 0 1 0 ${outer * 2} 0a${outer} ${outer} 0 1 0 ${-outer * 2} 0Z` +
    `M${50 - inner} 50a${inner} ${inner} 0 1 1 ${inner * 2} 0a${inner} ${inner} 0 1 1 ${-inner * 2} 0Z`
  );
};

const pie = (segments, gap, radius) => {
  const step = (Math.PI * 2) / segments;
  const shrink = (gap * Math.PI) / 180;
  let path = '';
  for (let index = 0; index < segments; index += 1) {
    const from = index * step - Math.PI / 2 + shrink;
    const to = (index + 1) * step - Math.PI / 2 - shrink;
    const a = point(from, radius);
    const b = point(to, radius);
    const big = to - from > Math.PI ? 1 : 0;
    path += `M50 50L${a[0]} ${a[1]}A${radius} ${radius} 0 ${big} 1 ${b[0]} ${b[1]}Z`;
  }
  return path;
};

const halo = (count, gap, radius) => {
  const step = (Math.PI * 2) / count;
  const shrink = (gap * Math.PI) / 180;
  const thickness = 7;
  let path = '';
  for (let index = 0; index < count; index += 1) {
    const from = index * step - Math.PI / 2 + shrink;
    const to = (index + 1) * step - Math.PI / 2 - shrink;
    path += arc(((to - from) * 180) / Math.PI, radius, thickness, (from + to) / 2 + Math.PI / 2);
  }
  return path;
};

const rings = (count, gap, thickness) => {
  let path = '';
  for (let index = 0; index < count; index += 1) {
    const radius = 40 - index * gap;
    if (radius <= thickness) break;
    path += hoop(radius, thickness);
  }
  return path;
};

const zigzag = (peaks, amplitude, thickness) => {
  const steps = peaks * 2;
  const top = [];
  const bottom = [];
  for (let index = 0; index <= steps; index += 1) {
    const x = round(12 + (index / steps) * 76);
    const y = 50 + (index % 2 ? amplitude : -amplitude);
    top.push([x, round(y - thickness / 2)]);
    bottom.unshift([x, round(y + thickness / 2)]);
  }
  return ring([...top, ...bottom]);
};

const lattice = (rows, columns, thickness) => {
  let path = '';
  const half = thickness / 2;
  for (let index = 0; index < rows; index += 1) {
    const y = round(14 + (index / Math.max(1, rows - 1)) * 72);
    path += `M14 ${round(y - half)}h72v${thickness}h-72Z`;
  }
  for (let index = 0; index < columns; index += 1) {
    const x = round(14 + (index / Math.max(1, columns - 1)) * 72);
    path += `M${round(x - half)} 14h${thickness}v72h${-thickness}Z`;
  }
  return path;
};

const shield = (shoulder, taper) => {
  const top = 14;
  const bottom = 88;
  const half = 30;
  return (
    `M50 ${top}L${50 + half} ${top + shoulder}` +
    `C${50 + half} ${bottom - 26} ${50 + half * taper} ${bottom - 10} 50 ${bottom}` +
    `C${50 - half * taper} ${bottom - 10} ${50 - half} ${bottom - 26} ${50 - half} ${top + shoulder}Z`
  );
};

const droplet = (stretch, plump) => {
  const tip = 50 - stretch;
  const belly = 50 + stretch * 0.55;
  return `M50 ${round(tip)}C${round(50 + plump)} ${round(tip + stretch * 0.8)} ${round(50 + plump)} ${round(belly)} 50 ${round(belly + 12)}C${round(50 - plump)} ${round(belly)} ${round(50 - plump)} ${round(tip + stretch * 0.8)} 50 ${round(tip)}Z`;
};

const FAMILIES = [
  {
    id: 'poly',
    group: 'shapes',
    name: 'Polygon',
    grid: { sides: range(3, 24), soften: [0, 0.1, 0.2, 0.35, 0.5, 0.75], spin: [0, 9, 18, 27, 36, 45] },
    make: ({ sides, soften, spin }) => polygon(sides, 38, (spin * Math.PI) / 180, soften),
    label: ({ sides, soften, spin }) => `${sides}-sided${soften ? ' soft' : ''}${spin ? ` ${spin}°` : ''}`,
  },
  {
    id: 'star',
    group: 'shapes',
    name: 'Star',
    grid: { points: range(4, 20), inner: [0.25, 0.35, 0.45, 0.55, 0.65, 0.75], spin: [0, 12, 24] },
    make: ({ points, inner, spin }) => star(points, 40, 40 * inner, (spin * Math.PI) / 180),
    label: ({ points, inner }) => `${points}-point star ${Math.round(inner * 100)}%`,
  },
  {
    id: 'gear',
    group: 'mechanical',
    name: 'Gear',
    grid: { teeth: range(6, 30), depth: [0.14, 0.22, 0.3] },
    make: ({ teeth, depth }) => gear(teeth, 40, depth),
    label: ({ teeth }) => `${teeth}-tooth gear`,
  },
  {
    id: 'rays',
    group: 'decor',
    name: 'Rays',
    grid: { count: range(3, 25), reach: [0.4, 0.6, 0.8, 1], thick: [0.04, 0.08, 0.12] },
    make: ({ count, reach, thick }) => rays(count, 14, 42 * reach + 8, thick),
    label: ({ count }) => `${count} rays`,
  },
  {
    id: 'arc',
    group: 'shapes',
    name: 'Arc',
    grid: { span: range(1, 12).map((n) => n * 30), radius: [22, 30, 38], thick: [3, 6, 10, 16], spin: [0, 45, 90, 135, 180, 225, 270, 315] },
    make: ({ span, radius, thick, spin }) => arc(span, radius, thick, (spin * Math.PI) / 180),
    label: ({ span, thick }) => `${span}° arc, ${thick} wide`,
  },
  {
    id: 'petal',
    group: 'nature',
    name: 'Petals',
    grid: { count: range(3, 14), length: [30, 38, 44], width: [0.3, 0.45, 0.6] },
    make: ({ count, length, width }) => petals(count, length, width),
    label: ({ count }) => `${count} petals`,
  },
  {
    id: 'dots',
    group: 'pattern',
    name: 'Dot grid',
    grid: { rows: range(1, 7), columns: range(1, 7), radius: [3, 5, 7] },
    make: ({ rows, columns, radius }) => dots(rows, columns, radius),
    label: ({ rows, columns }) => `${rows} by ${columns} dots`,
  },
  {
    id: 'bars',
    group: 'pattern',
    name: 'Bars',
    grid: { count: range(2, 9), gap: [3, 6], tallest: [40, 56, 70] },
    make: ({ count, gap, tallest }) => bars(count, gap, tallest),
    label: ({ count }) => `${count} bars`,
  },
  {
    id: 'wave',
    group: 'pattern',
    name: 'Wave',
    grid: { cycles: [0.5, 1, 1.5, 2, 2.5, 3, 4], amplitude: [8, 14, 20], thick: [4, 8, 12] },
    make: ({ cycles, amplitude, thick }) => wave(cycles, amplitude, thick),
    label: ({ cycles }) => `${cycles} cycle wave`,
  },
  {
    id: 'arrow',
    group: 'arrows',
    name: 'Arrow',
    grid: { direction: range(0, 8), style: ['solid', 'slim', 'wide', 'stub', 'kite'] },
    make: ({ direction, style }) => arrow(direction, style),
    label: ({ direction, style }) => `${style} arrow ${direction * 45}°`,
  },
  {
    id: 'chevron',
    group: 'arrows',
    name: 'Chevron',
    grid: { direction: range(0, 8), thickness: [6, 10, 16] },
    make: ({ direction, thickness }) => chevron(direction, thickness),
    label: ({ direction }) => `chevron ${direction * 45}°`,
  },
  {
    id: 'blob',
    group: 'shapes',
    name: 'Blob',
    grid: { seed: range(1, 61), lobes: [5, 6, 7, 8], wobble: [6, 12] },
    make: ({ seed, lobes, wobble }) => blob(seed, lobes, wobble),
    label: ({ seed }) => `blob ${seed}`,
  },
  {
    id: 'cross',
    group: 'shapes',
    name: 'Cross',
    grid: { thickness: [10, 16, 22, 30], arm: [26, 34, 42], spin: [0, 45] },
    make: ({ thickness, arm, spin }) => cross(thickness, arm, spin),
    label: ({ thickness, spin }) => `cross ${thickness} wide${spin ? ' turned' : ''}`,
  },
  {
    id: 'hoop',
    group: 'shapes',
    name: 'Ring',
    grid: { radius: [16, 22, 28, 34, 40], thick: [3, 6, 10, 16] },
    make: ({ radius, thick }) => hoop(radius, thick),
    label: ({ radius, thick }) => `ring ${radius} across, ${thick} wide`,
  },
  {
    id: 'pie',
    group: 'pattern',
    name: 'Pie',
    grid: { segments: range(2, 13), gap: [1, 5], radius: [30, 40] },
    make: ({ segments, gap, radius }) => pie(segments, gap, radius),
    label: ({ segments }) => `${segments} slices`,
  },
  {
    id: 'halo',
    group: 'decor',
    name: 'Halo',
    grid: { count: range(3, 17), gap: [3, 8], radius: [26, 34, 40] },
    make: ({ count, gap, radius }) => halo(count, gap, radius),
    label: ({ count }) => `halo of ${count}`,
  },
  {
    id: 'rings',
    group: 'pattern',
    name: 'Rings',
    grid: { count: range(2, 7), gap: [6, 9, 12], thickness: [2, 4] },
    make: ({ count, gap, thickness }) => rings(count, gap, thickness),
    label: ({ count }) => `${count} rings`,
  },
  {
    id: 'zigzag',
    group: 'pattern',
    name: 'Zigzag',
    grid: { peaks: range(2, 11), amplitude: [10, 18, 26], thickness: [4, 8] },
    make: ({ peaks, amplitude, thickness }) => zigzag(peaks, amplitude, thickness),
    label: ({ peaks }) => `${peaks} peaks`,
  },
  {
    id: 'lattice',
    group: 'pattern',
    name: 'Lattice',
    grid: { rows: range(2, 9), columns: range(2, 9), thickness: [2, 5] },
    make: ({ rows, columns, thickness }) => lattice(rows, columns, thickness),
    label: ({ rows, columns }) => `${rows} by ${columns} lattice`,
  },
  {
    id: 'shield',
    group: 'shapes',
    name: 'Shield',
    grid: { shoulder: [4, 10, 16], taper: [0.4, 0.7, 1] },
    make: ({ shoulder, taper }) => shield(shoulder, taper),
    label: () => 'shield',
  },
  {
    id: 'droplet',
    group: 'nature',
    name: 'Droplet',
    grid: { stretch: [24, 30, 36], plump: [18, 24, 30], spin: [0] },
    make: ({ stretch, plump }) => droplet(stretch, plump),
    label: () => 'droplet',
  },
];

function range(from, to) {
  return Array.from({ length: to - from }, (item, index) => from + index);
}

const combos = (grid) => {
  const keys = Object.keys(grid);
  let out = [{}];
  for (const key of keys) {
    const next = [];
    for (const base of out) for (const value of grid[key]) next.push({ ...base, [key]: value });
    out = next;
  }
  return out;
};

// The drawn icon set doubles as a source of parts.
const GLYPHS = glyphNames.map((name) => ({
  id: `glyph:${name}`,
  family: 'glyph',
  group: 'symbols',
  name,
  label: name.replace(/([A-Z])/g, ' $1').toLowerCase(),
  kind: 'glyph',
  glyph: name,
}));

let cache = null;

export function parts() {
  if (cache) return cache;
  const out = [];
  // A symmetric shape can come out identical at two different settings, so the
  // same drawing is only kept once.
  const drawn = new Set();
  for (const family of FAMILIES) {
    for (const params of combos(family.grid)) {
      const path = family.make(params);
      if (drawn.has(path)) continue;
      drawn.add(path);
      out.push({
        id: `${family.id}:${Object.values(params).join('-')}`,
        family: family.id,
        group: family.group,
        name: family.name,
        label: `${family.name} · ${family.label(params)}`,
        kind: 'path',
        path,
        params,
      });
    }
  }
  out.push(...GLYPHS);

  // Straight generation order puts hundreds of near identical triangles first.
  // Dealing one from each family in turn makes the shelf useful at a glance.
  const piles = new Map();
  for (const part of out) {
    if (!piles.has(part.family)) piles.set(part.family, []);
    piles.get(part.family).push(part);
  }
  const dealt = [];
  const decks = [...piles.values()];
  for (let round = 0; dealt.length < out.length; round += 1) {
    for (const deck of decks) if (deck[round]) dealt.push(deck[round]);
  }

  cache = dealt;
  return cache;
}

export const groups = () => {
  const seen = new Map();
  for (const part of parts()) {
    if (!seen.has(part.group)) seen.set(part.group, 0);
    seen.set(part.group, seen.get(part.group) + 1);
  }
  return [...seen.entries()].map(([id, count]) => ({ id, count }));
};

export const findPart = (id) => parts().find((part) => part.id === id) ?? null;

export const searchParts = (query, limit = 240) => {
  const term = query.trim().toLowerCase();
  const all = parts();
  if (!term) return all.slice(0, limit);
  return all.filter((part) => part.label.toLowerCase().includes(term) || part.id.includes(term)).slice(0, limit);
};

// Draw one part as markup, ready to drop inside an svg.
export function partMarkup(part, options = {}) {
  const { fill = 'currentColor', stroke = 'none', width = 6 } = options;
  if (part.kind === 'glyph') {
    const body = glyphPath(part.glyph);
    return `<g transform="translate(2 2) scale(4)" fill="none" stroke="${fill}" stroke-width="${width / 4}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  }
  return `<path d="${part.path}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" />`;
}
