const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const rotate = (x, y, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
};

export const outline = (body) => {
  if (body.kind === 'poly') return body.points;
  return [
    { x: -body.width / 2, y: -body.height / 2 },
    { x: body.width / 2, y: -body.height / 2 },
    { x: body.width / 2, y: body.height / 2 },
    { x: -body.width / 2, y: body.height / 2 },
  ];
};

export const bodyCorners = (body) =>
  outline(body).map((point) => {
    const spun = rotate(point.x, point.y, body.angle);
    return { x: body.x + spun.x, y: body.y + spun.y };
  });

export const hull = (points) => {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const half = (list) => {
    const built = [];
    list.forEach((point) => {
      while (built.length >= 2) {
        const a = built[built.length - 2];
        const b = built[built.length - 1];
        if ((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) > 0) break;
        built.pop();
      }
      built.push(point);
    });
    built.pop();
    return built;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
};

const signedArea = (points) => {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    total += a.x * b.y - b.x * a.y;
  }
  return total / 2;
};

export const windForward = (points) => (signedArea(points) < 0 ? [...points].reverse() : points);

const turn = (a, b, c) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

const inside = (a, b, c, point) => {
  const first = turn(a, b, point);
  const second = turn(b, c, point);
  const third = turn(c, a, point);
  return first >= 0 && second >= 0 && third >= 0;
};

const triangulate = (points) => {
  const left = points.map((point, index) => index);
  const shapes = [];
  let guard = points.length * points.length + 16;

  while (left.length > 3 && guard > 0) {
    guard -= 1;
    let clipped = false;
    for (let slot = 0; slot < left.length; slot += 1) {
      const before = left[(slot - 1 + left.length) % left.length];
      const here = left[slot];
      const after = left[(slot + 1) % left.length];
      const a = points[before];
      const b = points[here];
      const c = points[after];
      if (turn(a, b, c) <= 0) continue;
      const blocked = left.some((index) => {
        if (index === before || index === here || index === after) return false;
        return inside(a, b, c, points[index]);
      });
      if (blocked) continue;
      shapes.push([before, here, after]);
      left.splice(slot, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }

  if (left.length >= 3) shapes.push([...left]);
  return shapes;
};

const convexRun = (points, loop) =>
  loop.every((index, slot) => {
    const a = points[loop[(slot - 1 + loop.length) % loop.length]];
    const b = points[index];
    const c = points[loop[(slot + 1) % loop.length]];
    return turn(a, b, c) >= -1e-9;
  });

const weld = (points, first, second) => {
  for (let i = 0; i < first.length; i += 1) {
    const a = first[i];
    const b = first[(i + 1) % first.length];
    for (let j = 0; j < second.length; j += 1) {
      if (second[j] !== b || second[(j + 1) % second.length] !== a) continue;
      const merged = [];
      for (let step = 0; step <= i; step += 1) merged.push(first[step]);
      for (let step = 2; step < second.length; step += 1) merged.push(second[(j + step) % second.length]);
      for (let step = i + 1; step < first.length; step += 1) merged.push(first[step]);
      if (merged.length >= 3 && convexRun(points, merged)) return merged;
    }
  }
  return null;
};

export const decompose = (points) => {
  if (points.length < 3) return [];
  let pieces = triangulate(points);
  let merged = true;
  let guard = 200;

  while (merged && guard > 0) {
    guard -= 1;
    merged = false;
    outer: for (let i = 0; i < pieces.length; i += 1) {
      for (let j = i + 1; j < pieces.length; j += 1) {
        const joined = weld(points, pieces[i], pieces[j]);
        if (!joined) continue;
        pieces = pieces.filter((piece, index) => index !== i && index !== j);
        pieces.push(joined);
        merged = true;
        break outer;
      }
    }
  }

  return pieces;
};

const straddles = (a, b, c, d) => {
  const side = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
};

export const simpleLoop = (points) => {
  if (points.length < 3) return false;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (i === j || (i + 1) % points.length === j || (j + 1) % points.length === i) continue;
      if (straddles(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) return false;
    }
  }
  return true;
};

export const polyMass = (points) => {
  let area = 0;
  let cx = 0;
  let cy = 0;
  let second = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const twist = a.x * b.y - b.x * a.y;
    area += twist;
    cx += (a.x + b.x) * twist;
    cy += (a.y + b.y) * twist;
    second += twist * (a.x * a.x + a.x * b.x + b.x * b.x + a.y * a.y + a.y * b.y + b.y * b.y);
  }
  area /= 2;
  if (Math.abs(area) < 1e-9) return { area: 0, centre: { x: 0, y: 0 }, moment: 0 };
  const centre = { x: cx / (6 * area), y: cy / (6 * area) };
  const moment = second / 12 - Math.abs(area) * (centre.x * centre.x + centre.y * centre.y);
  return { area: Math.abs(area), centre, moment: Math.abs(moment) };
};

export const spanOf = (body) => {
  if (body.kind === 'circle') return { x: body.radius, y: body.radius };
  if (body.kind === 'poly') {
    const corners = bodyCorners(body);
    return {
      x: Math.max(...corners.map((point) => Math.abs(point.x - body.x))),
      y: Math.max(...corners.map((point) => Math.abs(point.y - body.y))),
    };
  }
  const cos = Math.abs(Math.cos(body.angle));
  const sin = Math.abs(Math.sin(body.angle));
  return {
    x: (body.width / 2) * cos + (body.height / 2) * sin,
    y: (body.width / 2) * sin + (body.height / 2) * cos,
  };
};

export const worldPoint = (body, local) => {
  const spun = rotate(local.x, local.y, body.angle);
  return { x: body.x + spun.x, y: body.y + spun.y };
};

export const localPoint = (body, world) => {
  const spun = rotate(world.x - body.x, world.y - body.y, -body.angle);
  return { x: spun.x, y: spun.y };
};

const massOf = (body) => {
  if (body.pinned) return { mass: 0, inertia: 0 };
  const density = body.density ?? 1;
  if (body.kind === 'circle') {
    const mass = Math.PI * body.radius * body.radius * density;
    return { mass, inertia: 0.5 * mass * body.radius * body.radius };
  }
  if (body.kind === 'poly') {
    const shape = polyMass(body.points);
    return { mass: shape.area * density, inertia: shape.moment * density };
  }
  const mass = body.width * body.height * density;
  return { mass, inertia: (mass * (body.width * body.width + body.height * body.height)) / 12 };
};

export const refreshMass = (body) => {
  const { mass, inertia } = massOf(body);
  body.mass = mass;
  body.inertia = inertia;
  body.invMass = mass > 0 ? 1 / mass : 0;
  body.invInertia = inertia > 0 && !body.fixedAngle ? 1 / inertia : 0;
  return body;
};

export const makeBody = (spec) => {
  const body = {
    id: spec.id,
    kind: spec.kind ?? 'box',
    x: spec.x ?? 0,
    y: spec.y ?? 0,
    angle: spec.angle ?? 0,
    vx: spec.vx ?? 0,
    vy: spec.vy ?? 0,
    spin: spec.spin ?? 0,
    width: spec.width ?? 1,
    height: spec.height ?? 1,
    points: spec.points ? windForward(spec.points.map((point) => ({ ...point }))) : null,
    radius: spec.radius ?? 0.5,
    density: spec.density ?? 1,
    restitution: spec.restitution ?? 0.2,
    friction: spec.friction ?? 0.35,
    pinned: spec.pinned ?? false,
    fixedAngle: spec.fixedAngle ?? false,
    driftX: 0,
    driftY: 0,
    driftSpin: 0,
    lastVx: 0,
    lastVy: 0,
    lastSpin: 0,
  };
  if (body.kind === 'poly') body.pieces = decompose(body.points);
  return refreshMass(body);
};

export const piecesOf = (body) => {
  if (body.kind === 'circle') return [];
  if (body.kind === 'poly') {
    if (!body.pieces?.length) return [body.points];
    return body.pieces.map((piece) => piece.map((index) => body.points[index]));
  }
  return [outline(body)];
};

const placed = (body, local) =>
  local.map((point) => {
    const spun = rotate(point.x, point.y, body.angle);
    return { x: body.x + spun.x, y: body.y + spun.y };
  });

const support = (body) => {
  if (body.kind === 'circle') return body.radius;
  if (body.kind === 'poly') return Math.max(...body.points.map((point) => Math.hypot(point.x, point.y)));
  return Math.hypot(body.width, body.height) / 2;
};

const circleCircle = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = Math.hypot(dx, dy);
  const overlap = a.radius + b.radius - span;
  if (overlap <= 0) return null;
  const normal = span > 1e-9 ? { x: dx / span, y: dy / span } : { x: 0, y: -1 };
  return {
    normal,
    points: [
      {
        x: a.x + normal.x * (a.radius - overlap / 2),
        y: a.y + normal.y * (a.radius - overlap / 2),
        separation: -overlap,
        feature: 0,
      },
    ],
  };
};

const circleShape = (circle, corners, flip) => {
  const axes = axesOf(corners);

  let deepest = -Infinity;
  let face = 0;
  axes.forEach((axis, index) => {
    const reach = (circle.x - corners[index].x) * axis.x + (circle.y - corners[index].y) * axis.y;
    if (reach > deepest) {
      deepest = reach;
      face = index;
    }
  });

  if (deepest > circle.radius) return null;

  if (deepest < 1e-9) {
    const axis = axes[face];
    const overlap = circle.radius - deepest;
    const touch = { x: circle.x - axis.x * deepest, y: circle.y - axis.y * deepest };
    const normal = flip ? { x: -axis.x, y: -axis.y } : axis;
    return { normal, points: [{ x: touch.x, y: touch.y, separation: -overlap, feature: face }] };
  }

  const start = corners[face];
  const end = corners[(face + 1) % corners.length];
  const edge = { x: end.x - start.x, y: end.y - start.y };
  const length = edge.x * edge.x + edge.y * edge.y || 1;
  const along = clamp(((circle.x - start.x) * edge.x + (circle.y - start.y) * edge.y) / length, 0, 1);
  const touch = { x: start.x + edge.x * along, y: start.y + edge.y * along };

  const dx = circle.x - touch.x;
  const dy = circle.y - touch.y;
  const span = Math.hypot(dx, dy);
  if (span > circle.radius) return null;
  const away = span > 1e-9 ? { x: dx / span, y: dy / span } : axes[face];
  const normal = flip ? away : { x: -away.x, y: -away.y };
  return { normal, points: [{ x: touch.x, y: touch.y, separation: span - circle.radius, feature: face }] };
};

const axesOf = (corners) => {
  const list = [];
  for (let index = 0; index < corners.length; index += 1) {
    const start = corners[index];
    const end = corners[(index + 1) % corners.length];
    const edge = { x: end.x - start.x, y: end.y - start.y };
    const length = Math.hypot(edge.x, edge.y) || 1;
    list.push({ x: edge.y / length, y: -edge.x / length });
  }
  return list;
};

const project = (corners, axis) => {
  let low = Infinity;
  let high = -Infinity;
  corners.forEach((point) => {
    const value = point.x * axis.x + point.y * axis.y;
    low = Math.min(low, value);
    high = Math.max(high, value);
  });
  return { low, high };
};

const clipSegment = (segment, axis, limit) => {
  const kept = [];
  const first = segment[0].x * axis.x + segment[0].y * axis.y - limit;
  const second = segment[1].x * axis.x + segment[1].y * axis.y - limit;
  if (first <= 0) kept.push(segment[0]);
  if (second <= 0) kept.push(segment[1]);
  if (first * second < 0) {
    const share = first / (first - second);
    kept.push({
      x: segment[0].x + share * (segment[1].x - segment[0].x),
      y: segment[0].y + share * (segment[1].y - segment[0].y),
      index: segment[0].index,
    });
  }
  return kept;
};

const middleOf = (corners) => ({
  x: corners.reduce((sum, point) => sum + point.x, 0) / corners.length,
  y: corners.reduce((sum, point) => sum + point.y, 0) / corners.length,
});

const shapeShape = (cornersA, cornersB) => {
  const facesA = axesOf(cornersA);
  const facesB = axesOf(cornersB);
  const axes = [...facesA, ...facesB];

  let best = null;
  for (let index = 0; index < axes.length; index += 1) {
    const axis = axes[index];
    const spanA = project(cornersA, axis);
    const spanB = project(cornersB, axis);
    const overlap = Math.min(spanA.high - spanB.low, spanB.high - spanA.low);
    if (overlap <= 0) return null;
    if (!best || overlap < best.overlap) best = { overlap, axis, fromA: index < facesA.length };
  }

  const centreA = middleOf(cornersA);
  const centreB = middleOf(cornersB);
  const middle = { x: centreB.x - centreA.x, y: centreB.y - centreA.y };
  let normal = best.axis;
  if (middle.x * normal.x + middle.y * normal.y < 0) normal = { x: -normal.x, y: -normal.y };

  const reference = best.fromA ? cornersA : cornersB;
  const incident = best.fromA ? cornersB : cornersA;
  const faceNormal = best.fromA ? normal : { x: -normal.x, y: -normal.y };

  let referenceEdge = 0;
  let referenceBest = -Infinity;
  const referenceAxes = axesOf(reference);
  referenceAxes.forEach((axis, index) => {
    const alignment = axis.x * faceNormal.x + axis.y * faceNormal.y;
    if (alignment > referenceBest) {
      referenceBest = alignment;
      referenceEdge = index;
    }
  });

  let incidentEdge = 0;
  let incidentBest = Infinity;
  axesOf(incident).forEach((axis, index) => {
    const alignment = axis.x * faceNormal.x + axis.y * faceNormal.y;
    if (alignment < incidentBest) {
      incidentBest = alignment;
      incidentEdge = index;
    }
  });

  const refStart = reference[referenceEdge];
  const refEnd = reference[(referenceEdge + 1) % reference.length];
  const side = { x: refEnd.x - refStart.x, y: refEnd.y - refStart.y };
  const length = Math.hypot(side.x, side.y) || 1;
  const tangent = { x: side.x / length, y: side.y / length };
  const face = referenceAxes[referenceEdge];

  let segment = [
    { ...incident[incidentEdge], index: incidentEdge },
    { ...incident[(incidentEdge + 1) % incident.length], index: (incidentEdge + 1) % incident.length },
  ];

  segment = clipSegment(segment, { x: -tangent.x, y: -tangent.y }, -(refStart.x * tangent.x + refStart.y * tangent.y));
  if (segment.length < 2) return null;
  segment = clipSegment(segment, tangent, refEnd.x * tangent.x + refEnd.y * tangent.y);
  if (segment.length < 2) return null;

  const offset = refStart.x * face.x + refStart.y * face.y;
  const points = [];
  segment.forEach((point) => {
    const separation = point.x * face.x + point.y * face.y - offset;
    if (separation > 0) return;
    points.push({ x: point.x, y: point.y, separation, feature: point.index ?? 0 });
  });

  if (!points.length) return null;
  return { normal, points };
};

const collide = (a, b) => {
  if (a.kind === 'circle' && b.kind === 'circle') {
    const hit = circleCircle(a, b);
    return hit ? [{ ...hit, tag: 0 }] : [];
  }

  const found = [];
  if (a.kind === 'circle' || b.kind === 'circle') {
    const circle = a.kind === 'circle' ? a : b;
    const shape = a.kind === 'circle' ? b : a;
    const flip = a.kind !== 'circle';
    piecesOf(shape).forEach((piece, index) => {
      const hit = circleShape(circle, placed(shape, piece), flip);
      if (hit) found.push({ ...hit, tag: index });
    });
    return found;
  }

  const left = piecesOf(a);
  const right = piecesOf(b);
  left.forEach((first, i) => {
    right.forEach((second, j) => {
      const hit = shapeShape(placed(a, first), placed(b, second));
      if (hit) found.push({ ...hit, tag: i * 64 + j });
    });
  });
  return found;
};

const velocityAt = (body, rx, ry) => ({
  x: body.vx - body.spin * ry,
  y: body.vy + body.spin * rx,
});

const nudgeAt = (body, rx, ry) => ({
  x: body.driftX - body.driftSpin * ry,
  y: body.driftY + body.driftSpin * rx,
});

const applyImpulse = (body, ix, iy, rx, ry) => {
  body.vx += ix * body.invMass;
  body.vy += iy * body.invMass;
  body.spin += (rx * iy - ry * ix) * body.invInertia;
};

const applyNudge = (body, ix, iy, rx, ry) => {
  body.driftX += ix * body.invMass;
  body.driftY += iy * body.invMass;
  body.driftSpin += (rx * iy - ry * ix) * body.invInertia;
};

export const createWorld = () => {
  let bodies = [];
  let joints = [];
  let cache = new Map();
  let time = 0;
  let settled = true;

  const gravity = { x: 0, y: 9.81 };
  const options = { damping: 0.02, iterations: 10, slop: 0.005, correction: 0.2, attraction: 0 };

  const find = (id) => bodies.find((body) => body.id === id);

  const anchorOf = (joint, end) => {
    const body = find(joint[end]);
    const local = joint[`${end}At`] ?? { x: 0, y: 0 };
    if (!body) return { body: null, point: local, rx: 0, ry: 0 };
    const point = worldPoint(body, local);
    return { body, point, rx: point.x - body.x, ry: point.y - body.y };
  };

  const attract = (dt) => {
    if (!options.attraction) return;
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const a = bodies[i];
        const b = bodies[j];
        if (!a.invMass && !b.invMass) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const square = dx * dx + dy * dy + 1e-4;
        const pull = options.attraction / (square * Math.sqrt(square));
        a.vx += pull * b.mass * dx * dt;
        a.vy += pull * b.mass * dy * dt;
        b.vx -= pull * a.mass * dx * dt;
        b.vy -= pull * a.mass * dy * dt;
      }
    }
  };

  const springForces = (dt) => {
    joints.forEach((joint) => {
      if (joint.kind !== 'spring') return;
      const a = anchorOf(joint, 'a');
      const b = anchorOf(joint, 'b');
      const dx = b.point.x - a.point.x;
      const dy = b.point.y - a.point.y;
      const span = Math.hypot(dx, dy);
      if (span < 1e-9) return;
      const axis = { x: dx / span, y: dy / span };
      const velA = a.body ? velocityAt(a.body, a.rx, a.ry) : { x: 0, y: 0 };
      const velB = b.body ? velocityAt(b.body, b.rx, b.ry) : { x: 0, y: 0 };
      const closing = (velB.x - velA.x) * axis.x + (velB.y - velA.y) * axis.y;
      const force = -(joint.stiffness ?? 40) * (span - (joint.rest ?? span)) - (joint.damping ?? 1.5) * closing;
      const ix = axis.x * force * dt;
      const iy = axis.y * force * dt;
      if (a.body) applyImpulse(a.body, -ix, -iy, a.rx, a.ry);
      if (b.body) applyImpulse(b.body, ix, iy, b.rx, b.ry);
    });
  };

  const solveAxis = (joint, dt, pass) => {
    const a = anchorOf(joint, 'a');
    const b = anchorOf(joint, 'b');
    const dx = b.point.x - a.point.x;
    const dy = b.point.y - a.point.y;
    const span = Math.hypot(dx, dy);
    if (span < 1e-9) return;
    const axis = { x: dx / span, y: dy / span };

    let target = joint.rest ?? span;
    if (joint.kind === 'jack') {
      const low = joint.min ?? 0.5;
      const high = joint.max ?? 3;
      const speed = joint.speed ?? 0.6;
      if (joint.manual) {
        const want = low + clamp(joint.extend ?? 0.5, 0, 1) * (high - low);
        if (pass === 0) {
          const held = joint.rest ?? want;
          const rate = (joint.rate ?? 1.1) * dt;
          joint.rest = held + clamp(want - held, -rate, rate);
        }
      } else if (pass === 0) {
        const swing = (high - low) / 2;
        joint.rest = low + swing + swing * Math.sin(time * speed * Math.PI);
      }
      target = joint.rest;
    }

    const error = span - target;
    if (joint.kind === 'rope' && error < 0) return;

    const velA = a.body ? velocityAt(a.body, a.rx, a.ry) : { x: 0, y: 0 };
    const velB = b.body ? velocityAt(b.body, b.rx, b.ry) : { x: 0, y: 0 };
    const closing = (velB.x - velA.x) * axis.x + (velB.y - velA.y) * axis.y;

    const crossA = a.rx * axis.y - a.ry * axis.x;
    const crossB = b.rx * axis.y - b.ry * axis.x;
    const share =
      (a.body ? a.body.invMass + a.body.invInertia * crossA * crossA : 0) +
      (b.body ? b.body.invMass + b.body.invInertia * crossB * crossB : 0);
    if (share < 1e-12) return;

    const bias = (options.correction * error) / dt;
    const impulse = -(closing + bias) / share;
    const ix = axis.x * impulse;
    const iy = axis.y * impulse;
    if (a.body) applyImpulse(a.body, -ix, -iy, a.rx, a.ry);
    if (b.body) applyImpulse(b.body, ix, iy, b.rx, b.ry);
  };

  const solveTrack = (joint, dt) => {
    const a = anchorOf(joint, 'a');
    const b = anchorOf(joint, 'b');
    const along = joint.axis ?? { x: 1, y: 0 };
    const dir = a.body ? rotate(along.x, along.y, a.body.angle) : along;
    const length = Math.hypot(dir.x, dir.y) || 1;
    const axis = { x: -dir.y / length, y: dir.x / length };

    const error = (b.point.x - a.point.x) * axis.x + (b.point.y - a.point.y) * axis.y;
    const velA = a.body ? velocityAt(a.body, a.rx, a.ry) : { x: 0, y: 0 };
    const velB = b.body ? velocityAt(b.body, b.rx, b.ry) : { x: 0, y: 0 };
    const closing = (velB.x - velA.x) * axis.x + (velB.y - velA.y) * axis.y;

    const crossA = a.rx * axis.y - a.ry * axis.x;
    const crossB = b.rx * axis.y - b.ry * axis.x;
    const share =
      (a.body ? a.body.invMass + a.body.invInertia * crossA * crossA : 0) +
      (b.body ? b.body.invMass + b.body.invInertia * crossB * crossB : 0);
    if (share < 1e-12) return;

    const impulse = -(closing + (options.correction * error) / dt) / share;
    if (a.body) applyImpulse(a.body, -axis.x * impulse, -axis.y * impulse, a.rx, a.ry);
    if (b.body) applyImpulse(b.body, axis.x * impulse, axis.y * impulse, b.rx, b.ry);
  };

  const solveTwist = (joint, dt) => {
    const a = find(joint.a);
    const b = find(joint.b);
    const share = (a ? a.invInertia : 0) + (b ? b.invInertia : 0);
    if (share < 1e-12) return;
    const held = joint.twist ?? 0;
    const error = (b ? b.angle : 0) - (a ? a.angle : 0) - held;
    const closing = (b ? b.spin : 0) - (a ? a.spin : 0);
    const impulse = -(closing + (options.correction * error) / dt) / share;
    if (a) a.spin -= impulse * a.invInertia;
    if (b) b.spin += impulse * b.invInertia;
  };

  const solvePin = (joint, dt) => {
    const a = anchorOf(joint, 'a');
    const b = anchorOf(joint, 'b');
    const gapX = b.point.x - a.point.x;
    const gapY = b.point.y - a.point.y;

    const velA = a.body ? velocityAt(a.body, a.rx, a.ry) : { x: 0, y: 0 };
    const velB = b.body ? velocityAt(b.body, b.rx, b.ry) : { x: 0, y: 0 };
    const relX = velB.x - velA.x + (options.correction * gapX) / dt;
    const relY = velB.y - velA.y + (options.correction * gapY) / dt;

    const invA = a.body ? a.body.invMass : 0;
    const invB = b.body ? b.body.invMass : 0;
    const rotA = a.body ? a.body.invInertia : 0;
    const rotB = b.body ? b.body.invInertia : 0;

    const k11 = invA + invB + rotA * a.ry * a.ry + rotB * b.ry * b.ry;
    const k12 = -rotA * a.rx * a.ry - rotB * b.rx * b.ry;
    const k22 = invA + invB + rotA * a.rx * a.rx + rotB * b.rx * b.rx;
    const det = k11 * k22 - k12 * k12;
    if (Math.abs(det) < 1e-12) return;

    const ix = -(k22 * relX - k12 * relY) / det;
    const iy = -(k11 * relY - k12 * relX) / det;
    if (a.body) applyImpulse(a.body, -ix, -iy, a.rx, a.ry);
    if (b.body) applyImpulse(b.body, ix, iy, b.rx, b.ry);
  };

  const solveMotor = (joint) => {
    const a = find(joint.a);
    const b = find(joint.b);
    const spinA = a ? a.spin : 0;
    const spinB = b ? b.spin : 0;
    const share = (a ? a.invInertia : 0) + (b ? b.invInertia : 0);
    if (share < 1e-12) return;
    const target = joint.speed ?? 2;
    const impulse = clamp(-(spinB - spinA - target) / share, -(joint.torque ?? 40), joint.torque ?? 40);
    if (a) a.spin -= impulse * a.invInertia;
    if (b) b.spin += impulse * b.invInertia;
  };

  const contacts = () => {
    const found = [];
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.invMass === 0 && b.invMass === 0) continue;
        const reach = support(a) + support(b);
        if (Math.hypot(b.x - a.x, b.y - a.y) > reach) continue;
        collide(a, b).forEach((hit) => {
          hit.points.forEach((point, index) => {
            const key = `${a.id}:${b.id}:${hit.tag}:${point.feature}:${index}`;
            const kept = cache.get(key);
            found.push({
              key,
              a,
              b,
              normal: hit.normal,
              point,
              normalImpulse: kept?.normalImpulse ?? 0,
              tangentImpulse: kept?.tangentImpulse ?? 0,
              nudgeImpulse: 0,
            });
          });
        });
      }
    }
    return found;
  };

  const prepare = (list, dt) => {
    list.forEach((contact) => {
      const { a, b, normal, point } = contact;
      contact.rax = point.x - a.x;
      contact.ray = point.y - a.y;
      contact.rbx = point.x - b.x;
      contact.rby = point.y - b.y;
      contact.tangent = { x: -normal.y, y: normal.x };

      const crossA = contact.rax * normal.y - contact.ray * normal.x;
      const crossB = contact.rbx * normal.y - contact.rby * normal.x;
      contact.normalMass =
        1 / (a.invMass + b.invMass + a.invInertia * crossA * crossA + b.invInertia * crossB * crossB || 1e-12);

      const tanA = contact.rax * contact.tangent.y - contact.ray * contact.tangent.x;
      const tanB = contact.rbx * contact.tangent.y - contact.rby * contact.tangent.x;
      contact.tangentMass =
        1 / (a.invMass + b.invMass + a.invInertia * tanA * tanA + b.invInertia * tanB * tanB || 1e-12);

      contact.friction = Math.sqrt(a.friction * b.friction);
      contact.bias = (-options.correction * Math.min(0, point.separation + options.slop)) / dt;
      contact.nudgeImpulse = 0;

      const wasA = { x: a.lastVx - a.lastSpin * contact.ray, y: a.lastVy + a.lastSpin * contact.rax };
      const wasB = { x: b.lastVx - b.lastSpin * contact.rby, y: b.lastVy + b.lastSpin * contact.rbx };
      const closing = (wasB.x - wasA.x) * normal.x + (wasB.y - wasA.y) * normal.y;
      const bounce = Math.max(a.restitution, b.restitution);
      contact.restitution = closing < -1 ? -bounce * closing : 0;

      const ix = normal.x * contact.normalImpulse + contact.tangent.x * contact.tangentImpulse;
      const iy = normal.y * contact.normalImpulse + contact.tangent.y * contact.tangentImpulse;
      applyImpulse(a, -ix, -iy, contact.rax, contact.ray);
      applyImpulse(b, ix, iy, contact.rbx, contact.rby);
    });
  };

  const solveDrift = (list) => {
    list.forEach((contact) => {
      const { a, b, normal } = contact;
      if (contact.bias <= 0) return;
      const nudgeA = nudgeAt(a, contact.rax, contact.ray);
      const nudgeB = nudgeAt(b, contact.rbx, contact.rby);
      const closing = (nudgeB.x - nudgeA.x) * normal.x + (nudgeB.y - nudgeA.y) * normal.y;
      let impulse = contact.normalMass * (contact.bias - closing);
      const held = contact.nudgeImpulse;
      contact.nudgeImpulse = Math.max(0, held + impulse);
      impulse = contact.nudgeImpulse - held;
      applyNudge(a, -normal.x * impulse, -normal.y * impulse, contact.rax, contact.ray);
      applyNudge(b, normal.x * impulse, normal.y * impulse, contact.rbx, contact.rby);
    });
  };

  const solveContacts = (list) => {
    list.forEach((contact) => {
      const { a, b, normal, tangent } = contact;

      const velA = velocityAt(a, contact.rax, contact.ray);
      const velB = velocityAt(b, contact.rbx, contact.rby);
      const closing = (velB.x - velA.x) * normal.x + (velB.y - velA.y) * normal.y;
      let impulse = -contact.normalMass * (closing - contact.restitution);
      const held = contact.normalImpulse;
      contact.normalImpulse = Math.max(0, held + impulse);
      impulse = contact.normalImpulse - held;
      applyImpulse(a, -normal.x * impulse, -normal.y * impulse, contact.rax, contact.ray);
      applyImpulse(b, normal.x * impulse, normal.y * impulse, contact.rbx, contact.rby);

      const slideA = velocityAt(a, contact.rax, contact.ray);
      const slideB = velocityAt(b, contact.rbx, contact.rby);
      const sliding = (slideB.x - slideA.x) * tangent.x + (slideB.y - slideA.y) * tangent.y;
      let rub = -contact.tangentMass * sliding;
      const grip = contact.friction * contact.normalImpulse;
      const heldTangent = contact.tangentImpulse;
      contact.tangentImpulse = clamp(heldTangent + rub, -grip, grip);
      rub = contact.tangentImpulse - heldTangent;
      applyImpulse(a, -tangent.x * rub, -tangent.y * rub, contact.rax, contact.ray);
      applyImpulse(b, tangent.x * rub, tangent.y * rub, contact.rbx, contact.rby);
    });
  };

  return {
    gravity,
    options,

    get bodies() {
      return bodies;
    },

    get joints() {
      return joints;
    },

    get time() {
      return time;
    },

    get settled() {
      return settled;
    },

    load(nextBodies, nextJoints) {
      bodies = nextBodies.map((body) => makeBody(body));
      joints = nextJoints.map((joint) => ({ ...joint }));
      cache = new Map();
      time = 0;
    },

    body: find,

    step(dt) {
      const drag = clamp(1 - options.damping * dt, 0, 1);
      bodies.forEach((body) => {
        body.lastVx = body.vx;
        body.lastVy = body.vy;
        body.lastSpin = body.spin;
      });
      bodies.forEach((body) => {
        if (!body.invMass) {
          body.vx = 0;
          body.vy = 0;
          if (!body.motorised) body.spin = 0;
          return;
        }
        body.vx = (body.vx + gravity.x * dt) * drag;
        body.vy = (body.vy + gravity.y * dt) * drag;
        body.spin *= drag;
      });

      bodies.forEach((body) => {
        body.driftX = 0;
        body.driftY = 0;
        body.driftSpin = 0;
      });

      attract(dt);
      springForces(dt);

      const list = contacts();
      prepare(list, dt);

      for (let pass = 0; pass < options.iterations; pass += 1) {
        joints.forEach((joint) => {
          if (joint.kind === 'pin') solvePin(joint, dt);
          else if (joint.kind === 'weld') {
            solvePin(joint, dt);
            solveTwist(joint, dt);
          } else if (joint.kind === 'track') solveTrack(joint, dt);
          else if (joint.kind === 'motor') {
            solvePin(joint, dt);
            solveMotor(joint);
          } else if (joint.kind !== 'spring') solveAxis(joint, dt, pass);
        });
        solveContacts(list);
      }

      for (let pass = 0; pass < options.iterations; pass += 1) solveDrift(list);

      cache = new Map(list.map((contact) => [contact.key, contact]));
      settled = bodies.every((body) => Number.isFinite(body.x) && Number.isFinite(body.y));

      bodies.forEach((body) => {
        if (!body.invMass && !body.motorised) return;
        body.x += (body.vx + body.driftX) * dt;
        body.y += (body.vy + body.driftY) * dt;
        body.angle += (body.spin + body.driftSpin) * dt;
      });

      time += dt;
    },

    energy() {
      return bodies.reduce((total, body) => {
        if (!body.mass) return total;
        const speed = body.vx * body.vx + body.vy * body.vy;
        return total + 0.5 * body.mass * speed + 0.5 * body.inertia * body.spin * body.spin;
      }, 0);
    },

    pull(id, local, target, dt) {
      const body = find(id);
      if (!body || !body.invMass) return;
      const point = worldPoint(body, local);
      const rx = point.x - body.x;
      const ry = point.y - body.y;
      const vel = velocityAt(body, rx, ry);
      const stiffness = 220;
      const damping = 26;
      const fx = (target.x - point.x) * stiffness - vel.x * damping;
      const fy = (target.y - point.y) * stiffness - vel.y * damping;
      applyImpulse(body, fx * dt * body.mass, fy * dt * body.mass, rx, ry);
    },

    holds(body, x, y) {
      if (body.kind === 'circle') return Math.hypot(x - body.x, y - body.y) <= body.radius;
      const local = localPoint(body, { x, y });
      const shape = outline(body);
      let crossings = 0;
      for (let step = 0; step < shape.length; step += 1) {
        const a = shape[step];
        const b = shape[(step + 1) % shape.length];
        if (a.y > local.y === b.y > local.y) continue;
        const cut = a.x + ((local.y - a.y) / (b.y - a.y)) * (b.x - a.x);
        if (cut > local.x) crossings += 1;
      }
      return crossings % 2 === 1;
    },

    at(x, y) {
      for (let index = bodies.length - 1; index >= 0; index -= 1) {
        if (this.holds(bodies[index], x, y)) return bodies[index];
      }
      return null;
    },

    allAt(x, y) {
      const found = [];
      for (let index = bodies.length - 1; index >= 0; index -= 1) {
        if (this.holds(bodies[index], x, y)) found.push(bodies[index]);
      }
      return found;
    },
  };
};
