const EPSILON = 1e-9;

const area = (points) => {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    total += a.x * b.y - b.x * a.y;
  }
  return total / 2;
};

const forward = (points) => (area(points) < 0 ? [...points].reverse() : points);

const holds = (points, point) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i];
    const b = points[j];
    if (a.y > point.y === b.y > point.y) continue;
    const cut = a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x);
    if (cut > point.x) inside = !inside;
  }
  return inside;
};

const near = (a, b) => Math.abs(a.x - b.x) < 1e-7 && Math.abs(a.y - b.y) < 1e-7;

const build = (points) =>
  points.map((point, index) => ({
    x: point.x,
    y: point.y,
    next: (index + 1) % points.length,
    crossing: false,
    along: 0,
    seen: false,
  }));

const cross = (p1, p2, q1, q2) => {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = q2.x - q1.x;
  const sy = q2.y - q1.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < EPSILON) return null;
  const t = ((q1.x - p1.x) * sy - (q1.y - p1.y) * sx) / denominator;
  const u = ((q1.x - p1.x) * ry - (q1.y - p1.y) * rx) / denominator;
  if (t <= EPSILON || t >= 1 - EPSILON || u <= EPSILON || u >= 1 - EPSILON) return null;
  return { t, u, x: p1.x + rx * t, y: p1.y + ry * t };
};

const weave = (subject, clip) => {
  const first = [];
  const second = [];

  subject.forEach((point, index) => {
    first.push({ ...point, crossing: false, partner: -1 });
    const nextPoint = subject[(index + 1) % subject.length];
    const hits = [];
    clip.forEach((other, slot) => {
      const nextOther = clip[(slot + 1) % clip.length];
      const hit = cross(point, nextPoint, other, nextOther);
      if (hit) hits.push({ ...hit, slot });
    });
    hits.sort((a, b) => a.t - b.t).forEach((hit) => first.push({ x: hit.x, y: hit.y, crossing: true, partner: -1, key: `${hit.x.toFixed(7)},${hit.y.toFixed(7)}` }));
  });

  clip.forEach((point, index) => {
    second.push({ ...point, crossing: false, partner: -1 });
    const nextPoint = clip[(index + 1) % clip.length];
    const hits = [];
    subject.forEach((other, slot) => {
      const nextOther = subject[(slot + 1) % subject.length];
      const hit = cross(point, nextPoint, other, nextOther);
      if (hit) hits.push({ ...hit, slot });
    });
    hits.sort((a, b) => a.t - b.t).forEach((hit) => second.push({ x: hit.x, y: hit.y, crossing: true, partner: -1, key: `${hit.x.toFixed(7)},${hit.y.toFixed(7)}` }));
  });

  first.forEach((point, index) => {
    if (!point.crossing) return;
    const match = second.findIndex((other) => other.crossing && near(other, point));
    if (match >= 0) {
      point.partner = match;
      second[match].partner = index;
    }
  });

  return { first, second };
};

const walk = (first, second, keepInside, flipClip, clip, subject) => {
  const pieces = [];
  const used = new Set();

  first.forEach((start, index) => {
    if (!start.crossing || used.has(index)) return;

    const piece = [];
    let onFirst = true;
    let at = index;
    let guard = 0;

    while (guard < (first.length + second.length) * 4) {
      guard += 1;
      const ring = onFirst ? first : second;
      const point = ring[at];
      if (onFirst) used.add(at);
      if (piece.length && point.crossing && near(point, piece[0])) break;
      piece.push({ x: point.x, y: point.y });

      if (point.crossing && point.partner >= 0 && piece.length > 1) {
        at = point.partner;
        onFirst = !onFirst;
        continue;
      }

      const nextRing = onFirst ? first : second;
      let step = (at + 1) % nextRing.length;
      const nextPoint = nextRing[step];

      if (nextPoint.crossing && nextPoint.partner >= 0) {
        const other = onFirst ? clip : subject;
        const midway = { x: (point.x + nextPoint.x) / 2, y: (point.y + nextPoint.y) / 2 };
        const insideOther = holds(other, midway);
        const want = onFirst ? keepInside : keepInside !== flipClip;
        if (insideOther !== want) {
          at = step;
          continue;
        }
      }
      at = step;
    }

    if (piece.length >= 3) pieces.push(piece);
  });

  return pieces;
};

const segments = (subject, clip, keepSubjectInside, keepClipInside) => {
  const { first, second } = weave(subject, clip);
  if (!first.some((point) => point.crossing)) return null;

  const rings = [];
  const used = new Set();

  const advance = (ring, other, at, keep, otherShape) => {
    const piece = [];
    let onFirst = ring === first;
    let index = at;
    let guard = 0;

    while (guard < (first.length + second.length) * 6) {
      guard += 1;
      const active = onFirst ? first : second;
      const shape = onFirst ? clip : subject;
      const wanted = onFirst ? keep : keepClipInside;
      const point = active[index];

      if (piece.length > 2 && near(point, piece[0])) break;
      piece.push({ x: point.x, y: point.y });
      if (onFirst) used.add(index);

      const step = (index + 1) % active.length;
      const ahead = active[step];
      const midway = { x: (point.x + ahead.x) / 2, y: (point.y + ahead.y) / 2 };
      const keeping = holds(shape, midway) === wanted;

      if (!keeping && point.crossing && point.partner >= 0) {
        index = point.partner;
        onFirst = !onFirst;
        continue;
      }
      if (!keeping && ahead.crossing && ahead.partner >= 0) {
        piece.push({ x: ahead.x, y: ahead.y });
        index = ahead.partner;
        onFirst = !onFirst;
        continue;
      }
      index = step;
    }
    void other;
    void otherShape;
    return piece;
  };

  first.forEach((point, index) => {
    if (!point.crossing || used.has(index)) return;
    const piece = advance(first, second, index, keepSubjectInside, clip);
    if (piece.length >= 3) rings.push(piece);
  });

  return rings.length ? rings : null;
};

const JITTER = { x: 7.3e-7, y: 1.1e-6 };

export const clipPolygons = (a, b, mode) => {
  const subject = forward(a);
  const clip = forward(b).map((point) => ({ x: point.x + JITTER.x, y: point.y + JITTER.y }));

  const insideSubject = clip.every((point) => holds(subject, point));
  const insideClip = subject.every((point) => holds(clip, point));
  const meets = weave(subject, clip).first.some((point) => point.crossing);

  if (!meets) {
    if (mode === 'union') {
      if (insideSubject) return [subject];
      if (insideClip) return [clip];
      return null;
    }
    if (mode === 'subtract') {
      if (insideClip) return [];
      return [subject];
    }
    if (insideSubject) return [clip];
    if (insideClip) return [subject];
    return [];
  }

  if (mode === 'union') return segments(subject, clip, false, false);
  if (mode === 'intersect') return segments(subject, clip, true, true);
  return segments(subject, [...clip].reverse(), false, true);
};

export const polygonArea = (points) => Math.abs(area(points));
export const polygonHolds = holds;
