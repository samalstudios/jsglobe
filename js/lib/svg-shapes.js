const GEOMETRY = 'path, polygon, polyline, rect, circle, ellipse, line';

const simplify = (points, tolerance) => {
  if (points.length < 3) return points;

  const away = (point, a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = dx * dx + dy * dy;
    if (!span) return Math.hypot(point.x - a.x, point.y - a.y);
    const along = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / span));
    return Math.hypot(point.x - (a.x + dx * along), point.y - (a.y + dy * along));
  };

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [start, end] = stack.pop();
    let worst = tolerance;
    let at = -1;
    for (let index = start + 1; index < end; index += 1) {
      const gap = away(points[index], points[start], points[end]);
      if (gap > worst) {
        worst = gap;
        at = index;
      }
    }
    if (at < 0) continue;
    keep[at] = true;
    stack.push([start, at], [at, end]);
  }

  return points.filter((point, index) => keep[index]);
};

const subpaths = (definition) => {
  const parts = String(definition).match(/[Mm][^Mm]*/g);
  return parts ?? [];
};

const sample = (element, steps) => {
  const length = element.getTotalLength();
  if (!length) return [];
  const count = Math.max(12, Math.min(steps, Math.round(length / 2)));
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const at = element.getPointAtLength((length * index) / count);
    points.push({ x: at.x, y: at.y });
  }
  return points;
};

const applied = (points, matrix) => {
  if (!matrix) return points;
  return points.map((point) => ({
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  }));
};

export const shapesFromSvg = (text, options = {}) => {
  const tolerance = options.tolerance ?? 1.2;
  const steps = options.steps ?? 240;

  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) throw new Error('That file is not valid SVG.');
  const root = parsed.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') throw new Error('That file has no svg element.');

  const stage = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  stage.setAttribute('width', '100');
  stage.setAttribute('height', '100');
  Object.assign(stage.style, { position: 'absolute', left: '-9999px', top: '0', opacity: '0' });
  const holder = document.importNode(root, true);
  stage.append(holder);
  document.body.append(stage);

  const rings = [];
  try {
    holder.querySelectorAll(GEOMETRY).forEach((element) => {
      const matrix = element.getCTM?.() ?? null;
      const tag = element.tagName.toLowerCase();

      if (tag === 'path') {
        const definition = element.getAttribute('d') ?? '';
        const pieces = subpaths(definition);
        pieces.forEach((piece) => {
          const single = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          single.setAttribute('d', piece);
          element.parentNode.append(single);
          const points = sample(single, steps);
          single.remove();
          if (points.length >= 3) rings.push(applied(points, matrix));
        });
        return;
      }

      const points = sample(element, steps);
      if (points.length >= 3) rings.push(applied(points, matrix));
    });
  } finally {
    stage.remove();
  }

  const trimmed = rings.map((ring) => simplify(ring, tolerance)).filter((ring) => ring.length >= 3);
  if (!trimmed.length) throw new Error('No outlines were found in that SVG.');

  const all = trimmed.flat();
  const left = Math.min(...all.map((point) => point.x));
  const right = Math.max(...all.map((point) => point.x));
  const top = Math.min(...all.map((point) => point.y));
  const bottom = Math.max(...all.map((point) => point.y));
  const width = Math.max(1e-6, right - left);
  const height = Math.max(1e-6, bottom - top);
  const scale = (options.size ?? 4) / Math.max(width, height);

  return trimmed.map((ring) =>
    ring.map((point) => ({
      x: (point.x - left - width / 2) * scale,
      y: (point.y - top - height / 2) * scale,
    })),
  );
};
