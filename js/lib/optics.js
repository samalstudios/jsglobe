// Geometric optics in two dimensions.
//
// A scene is a list of surfaces. Every surface carries an outward normal, so a
// ray decides whether it is entering or leaving glass from the sign of the dot
// product alone, with no point in shape test anywhere.

const EPSILON = 1e-9;
const NUDGE = 1e-7;

export const AIR = 1;

// Sellmeier fit for common crown glass, so a prism splits light the way one does.
export function indexAt(wavelength, base = 1.52) {
  const micron = wavelength / 1000;
  const spread = 0.0142 / (micron * micron - 0.00354);
  return base - 0.0197 + spread;
}

export const SPECTRUM = [
  { wavelength: 660, colour: '#f0403a' },
  { wavelength: 610, colour: '#f5842c' },
  { wavelength: 580, colour: '#f0c419' },
  { wavelength: 540, colour: '#4bb662' },
  { wavelength: 490, colour: '#3aa6d8' },
  { wavelength: 450, colour: '#3f5bd4' },
  { wavelength: 420, colour: '#8244c4' },
];

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const len = (a) => Math.hypot(a.x, a.y);
const unit = (a) => {
  const length = len(a) || 1;
  return { x: a.x / length, y: a.y / length };
};

export const rotate = (point, angle, about = { x: 0, y: 0 }) => {
  const dx = point.x - about.x;
  const dy = point.y - about.y;
  return {
    x: about.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: about.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
};

// ---- surfaces ---------------------------------------------------------

export const segment = (a, b, spec = {}) => ({ kind: 'segment', a, b, ...spec });

export const arc = (centre, radius, from, to, spec = {}) => ({ kind: 'arc', centre, radius, from, to, ...spec });

const angleWithin = (angle, from, to) => {
  const span = ((to - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const here = ((angle - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return here <= span + EPSILON;
};

function hitSegment(ray, surface) {
  const edge = sub(surface.b, surface.a);
  const denominator = ray.direction.x * edge.y - ray.direction.y * edge.x;
  if (Math.abs(denominator) < EPSILON) return null;

  const offset = sub(surface.a, ray.origin);
  const distance = (offset.x * edge.y - offset.y * edge.x) / denominator;
  const along = (offset.x * ray.direction.y - offset.y * ray.direction.x) / denominator;
  if (distance < NUDGE || along < -EPSILON || along > 1 + EPSILON) return null;

  const point = add(ray.origin, scale(ray.direction, distance));
  const normal = unit({ x: edge.y, y: -edge.x });
  return { distance, point, normal, surface };
}

function hitArc(ray, surface) {
  const offset = sub(ray.origin, surface.centre);
  const b = dot(offset, ray.direction);
  const c = dot(offset, offset) - surface.radius * surface.radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  for (const distance of [-b - root, -b + root]) {
    if (distance < NUDGE) continue;
    const point = add(ray.origin, scale(ray.direction, distance));
    const angle = Math.atan2(point.y - surface.centre.y, point.x - surface.centre.x);
    if (!angleWithin(angle, surface.from, surface.to)) continue;
    const normal = unit(sub(point, surface.centre));
    return { distance, point, normal, surface };
  }
  return null;
}

export function nearestHit(ray, surfaces) {
  let best = null;
  for (const surface of surfaces) {
    const hit = surface.kind === 'arc' ? hitArc(ray, surface) : hitSegment(ray, surface);
    if (hit && (!best || hit.distance < best.distance)) best = hit;
  }
  return best;
}

// ---- what happens at a surface ---------------------------------------

export const reflect = (direction, normal) => sub(direction, scale(normal, 2 * dot(direction, normal)));

// Snell's law. Returns null when the ray is past the critical angle, which is
// the caller's cue that all of the light reflects instead.
export function refract(direction, normal, fromIndex, toIndex) {
  const ratio = fromIndex / toIndex;
  const cosIn = -dot(normal, direction);
  const sinOutSquared = ratio * ratio * (1 - cosIn * cosIn);
  if (sinOutSquared > 1) return null;
  const cosOut = Math.sqrt(1 - sinOutSquared);
  return add(scale(direction, ratio), scale(normal, ratio * cosIn - cosOut));
}

export const criticalAngle = (fromIndex, toIndex) =>
  fromIndex <= toIndex ? null : Math.asin(toIndex / fromIndex);

// ---- tracing ----------------------------------------------------------

// Follow one ray until it runs out of bounces, leaves the scene or is absorbed.
export function traceRay(scene, start, options = {}) {
  const { bounces = 24, reach = 4000, wavelength = 540 } = options;
  const surfaces = scene.surfaces ?? scene;
  const path = [{ ...start.origin }];
  const events = [];

  let ray = { origin: { ...start.origin }, direction: unit(start.direction) };
  let inside = start.inside ?? AIR;

  for (let step = 0; step < bounces; step += 1) {
    const hit = nearestHit(ray, surfaces);
    if (!hit) {
      path.push(add(ray.origin, scale(ray.direction, reach)));
      break;
    }

    path.push({ ...hit.point });
    const role = hit.surface.role ?? 'glass';

    if (role === 'block' || role === 'screen') {
      events.push({ kind: role, point: hit.point, surface: hit.surface, angle: Math.acos(Math.min(1, Math.abs(dot(ray.direction, hit.normal)))) });
      break;
    }

    // face the normal against the ray so entering is always the negative side
    const facing = dot(ray.direction, hit.normal) < 0 ? hit.normal : scale(hit.normal, -1);
    const entering = dot(ray.direction, hit.normal) < 0;

    if (role === 'mirror') {
      ray = { origin: hit.point, direction: unit(reflect(ray.direction, facing)) };
      events.push({ kind: 'reflect', point: hit.point });
      continue;
    }

    if (role === 'lens') {
      // An ideal lens: bend the ray so it satisfies the thin lens formula,
      // which is what the textbook construction assumes.
      const focal = hit.surface.focal ?? 100;
      const axis = hit.surface.axis ?? { x: 1, y: 0 };
      const up = { x: -axis.y, y: axis.x };
      const height = dot(sub(hit.point, hit.surface.middle), up);
      const along = dot(ray.direction, axis);
      if (Math.abs(along) < EPSILON) break;
      const slope = dot(ray.direction, up) / along;
      const next = slope - height / focal;
      const direction = unit(add(scale(axis, Math.sign(along)), scale(up, next * Math.sign(along))));
      ray = { origin: hit.point, direction };
      events.push({ kind: 'lens', point: hit.point });
      continue;
    }

    const glassIndex = hit.surface.dispersive
      ? indexAt(wavelength, hit.surface.index ?? 1.52)
      : hit.surface.index ?? 1.52;
    const fromIndex = entering ? AIR : glassIndex;
    const toIndex = entering ? glassIndex : AIR;

    const bent = refract(ray.direction, facing, fromIndex, toIndex);
    if (!bent) {
      ray = { origin: hit.point, direction: unit(reflect(ray.direction, facing)) };
      events.push({ kind: 'total', point: hit.point, fromIndex, toIndex });
      continue;
    }

    ray = { origin: hit.point, direction: unit(bent) };
    inside = toIndex;
    events.push({ kind: 'refract', point: hit.point, fromIndex, toIndex });
  }

  return { path, events, wavelength };
}

// ---- shapes ----------------------------------------------------------

export function glassPolygon(points, spec = {}) {
  // Wound so the normals face outwards, which is what the entering test needs.
  const area = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + (point.x * next.y - next.x * point.y);
  }, 0);
  const wound = area > 0 ? points : [...points].reverse();
  return wound.map((point, index) =>
    segment(point, wound[(index + 1) % wound.length], { role: 'glass', ...spec }),
  );
}

export const glassBlock = (x, y, width, height, angle = 0, spec = {}) => {
  const half = { x: width / 2, y: height / 2 };
  const corners = [
    { x: x - half.x, y: y - half.y },
    { x: x + half.x, y: y - half.y },
    { x: x + half.x, y: y + half.y },
    { x: x - half.x, y: y + half.y },
  ].map((corner) => rotate(corner, angle, { x, y }));
  return glassPolygon(corners, spec);
};

export const prism = (x, y, size, angle = 0, spec = {}) => {
  const corners = [0, 1, 2].map((index) => {
    const turn = angle - Math.PI / 2 + (index / 3) * Math.PI * 2;
    return { x: x + Math.cos(turn) * size, y: y + Math.sin(turn) * size };
  });
  return glassPolygon(corners, { dispersive: true, ...spec });
};

// A real lens: two spherical caps meeting at the rim. A curvature of zero makes
// that side flat, which is how a plano lens is built.
export function sphericalLens(x, y, diameter, curveLeft, curveRight, angle = 0, spec = {}) {
  const half = diameter / 2;
  const side = (curvature, sign) => {
    if (Math.abs(curvature) < 1e-4) {
      const offset = sign * 1;
      return [
        segment(
          rotate({ x: x + offset, y: y - half }, angle, { x, y }),
          rotate({ x: x + offset, y: y + half }, angle, { x, y }),
          { role: 'glass', ...spec },
        ),
      ];
    }
    const radius = 1 / curvature;
    const bulge = Math.abs(radius) - Math.sqrt(Math.max(0, radius * radius - half * half));
    const centreX = x + sign * (Math.abs(radius) - bulge) * Math.sign(radius) * -1;
    const centre = rotate({ x: centreX, y }, angle, { x, y });
    const span = Math.asin(Math.min(1, half / Math.abs(radius)));
    const facing = sign * Math.sign(radius) > 0 ? 0 : Math.PI;
    return [
      arc(centre, Math.abs(radius), angle + facing - span, angle + facing + span, { role: 'glass', ...spec }),
    ];
  };
  return [...side(curveLeft, -1), ...side(curveRight, 1)];
}

export const idealLens = (x, y, diameter, focal, angle = 0) => {
  const half = diameter / 2;
  const axis = { x: Math.cos(angle), y: Math.sin(angle) };
  const up = { x: -axis.y, y: axis.x };
  const middle = { x, y };
  return [
    segment(
      { x: x - up.x * half, y: y - up.y * half },
      { x: x + up.x * half, y: y + up.y * half },
      { role: 'lens', focal, axis, middle },
    ),
  ];
};

export const planeMirror = (x, y, length, angle = 0) => {
  const half = length / 2;
  const axis = { x: Math.cos(angle), y: Math.sin(angle) };
  return [
    segment(
      { x: x - axis.x * half, y: y - axis.y * half },
      { x: x + axis.x * half, y: y + axis.y * half },
      { role: 'mirror' },
    ),
  ];
};

// A curved mirror of radius R brings parallel light to a focus at R/2.
export const curvedMirror = (x, y, radius, span, angle = 0, concave = true) => {
  const centre = { x: x + Math.cos(angle) * (concave ? radius : -radius), y: y + Math.sin(angle) * (concave ? radius : -radius) };
  const facing = concave ? angle + Math.PI : angle;
  const half = span / 2;
  return [arc(centre, Math.abs(radius), facing - half, facing + half, { role: 'mirror' })];
};

export const screen = (x, y, length, angle = 0) => {
  const half = length / 2;
  const axis = { x: Math.cos(angle), y: Math.sin(angle) };
  return [
    segment(
      { x: x - axis.x * half, y: y - axis.y * half },
      { x: x + axis.x * half, y: y + axis.y * half },
      { role: 'screen' },
    ),
  ];
};

export const blocker = (x, y, length, angle = 0) => {
  const half = length / 2;
  const axis = { x: Math.cos(angle), y: Math.sin(angle) };
  return [
    segment(
      { x: x - axis.x * half, y: y - axis.y * half },
      { x: x + axis.x * half, y: y + axis.y * half },
      { role: 'block' },
    ),
  ];
};

// ---- sources ---------------------------------------------------------

export function beamRays(x, y, width, angle, count) {
  const axis = { x: Math.cos(angle), y: Math.sin(angle) };
  const up = { x: -axis.y, y: axis.x };
  const half = width / 2;
  return Array.from({ length: count }, (item, index) => {
    const offset = count === 1 ? 0 : -half + (index / (count - 1)) * width;
    return { origin: { x: x + up.x * offset, y: y + up.y * offset }, direction: axis };
  });
}

export function fanRays(x, y, spread, angle, count) {
  return Array.from({ length: count }, (item, index) => {
    const turn = count === 1 ? angle : angle - spread / 2 + (index / (count - 1)) * spread;
    return { origin: { x, y }, direction: { x: Math.cos(turn), y: Math.sin(turn) } };
  });
}

export const laserRay = (x, y, angle) => [{ origin: { x, y }, direction: { x: Math.cos(angle), y: Math.sin(angle) } }];

// ---- textbook formulas, for the readouts -----------------------------

export const thinLensImage = (focal, objectDistance) => {
  if (Math.abs(objectDistance - focal) < EPSILON) return { distance: Infinity, magnification: Infinity };
  const distance = (focal * objectDistance) / (objectDistance - focal);
  return { distance, magnification: -distance / objectDistance };
};

export const lensMakerFocal = (index, curveLeft, curveRight) => 1 / ((index - 1) * (curveLeft + curveRight));

export const minimumDeviation = (index, apex) => 2 * Math.asin(index * Math.sin(apex / 2)) - apex;
