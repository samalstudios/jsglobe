// Shapes on the globe: their true area, moving them across the sphere, and
// drawing them on a Mercator map.
//
// A ring is a list of [longitude, latitude] pairs in degrees. A shape is a
// list of rings: outer edges and holes alike, told apart by their direction
// when areas are summed.

const RADIUS = 6371.0088;
const DEG = Math.PI / 180;
// Mercator reaches the poles only at infinity; maps stop short of them
export const LIMIT = 85.05113;

const clampLat = (lat) => Math.max(-89.5, Math.min(89.5, lat));

/** Mercator's northing for a latitude, in degrees, so it can share a scale with longitude. */
export const mercatorY = (lat) => Math.log(Math.tan(Math.PI / 4 + (clampLat(lat) * DEG) / 2)) / DEG;

/** The latitude for a Mercator northing in degrees. */
export const mercatorLat = (y) => (2 * Math.atan(Math.exp(y * DEG)) - Math.PI / 2) / DEG;

/** How many times larger Mercator draws a place at this latitude than one at the equator, by area. */
export const mercatorStretch = (lat) => 1 / Math.cos(clampLat(lat) * DEG) ** 2;

/** Area enclosed by a ring on the sphere, in square kilometres, positive one way round and negative the other. */
export const ringArea = (ring) => {
  let sum = 0;
  for (let at = 0, n = ring.length; at < n; at += 1) {
    const [lon1, lat1] = ring[at];
    const [lon2, lat2] = ring[(at + 1) % n];
    let span = lon2 - lon1;
    if (span > 180) span -= 360;
    if (span < -180) span += 360;
    sum += span * DEG * (2 + Math.sin(lat1 * DEG) + Math.sin(lat2 * DEG));
  }
  return (sum * RADIUS * RADIUS) / 2;
};

/** True area in square kilometres of polygons, each an outer ring followed by its holes. */
export const polygonsArea = (polygons) =>
  polygons.reduce((sum, [outer, ...holes]) => sum + Math.abs(ringArea(outer)) - holes.reduce((cut, hole) => cut + Math.abs(ringArea(hole)), 0), 0);

const toVector = ([lon, lat]) => {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
};

const toLonLat = ([x, y, z]) => [Math.atan2(y, x) / DEG, Math.asin(Math.max(-1, Math.min(1, z))) / DEG];

/** The middle of a shape on the sphere: the mean direction of its edges, weighted by their length. */
export const shapeCentre = (rings) => {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (const ring of rings) {
    for (let at = 0; at < ring.length; at += 1) {
      const a = toVector(ring[at]);
      const b = toVector(ring[(at + 1) % ring.length]);
      const weight = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      sx += (a[0] + b[0]) * weight;
      sy += (a[1] + b[1]) * weight;
      sz += (a[2] + b[2]) * weight;
    }
  }
  const length = Math.hypot(sx, sy, sz) || 1;
  return toLonLat([sx / length, sy / length, sz / length]);
};

/**
 * Carry a shape across the sphere so the point `from` lands on `to`, turning
 * it the least it can. Distances along the ground stay the same, so the area
 * does too: this is what a map projection then stretches.
 *
 * Longitudes come back unbroken around the destination, so a shape moved over
 * the date line stays in one piece.
 */
export const moveShape = (rings, from, to) => {
  const a = toVector(from);
  const b = toVector(to);
  const axis = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sin = Math.hypot(...axis);
  const cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const turn = (v) => {
    if (sin < 1e-12) return cos > 0 ? v : [-v[0], -v[1], v[2]];
    const k = axis.map((value) => value / sin);
    const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
    const cross = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    // Rodrigues: v cosθ + (k × v) sinθ + k (k·v)(1 − cosθ)
    return [0, 1, 2].map((i) => v[i] * cos + cross[i] * sin + k[i] * dot * (1 - cos));
  };
  return rings.map((ring) => {
    let previous = to[0];
    return ring.map((point) => {
      let [lon, lat] = toLonLat(turn(toVector(point)));
      while (lon - previous > 180) lon -= 360;
      while (lon - previous < -180) lon += 360;
      previous = lon;
      return [lon, lat];
    });
  });
};

/** An SVG path for a shape on a Mercator map whose units are degrees of longitude. */
export const mercatorPath = (rings, digits = 2) => {
  const scale = 10 ** digits;
  const f = (value) => Math.round(value * scale) / scale;
  return rings
    .map((ring) => ring.map(([lon, lat], at) => `${at ? 'L' : 'M'}${f(lon)} ${f(-mercatorY(lat))}`).join('') + 'Z')
    .join('');
};

/** The box a shape covers on a Mercator map, in the same units. */
export const mercatorBounds = (rings) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      const y = -mercatorY(lat);
      if (lon < minX) minX = lon;
      if (lon > maxX) maxX = lon;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

/**
 * Rings packed as whole hundredths of a degree, each point the difference from
 * the one before, which is how the country data is kept small.
 */
export const unpackRings = (packed) =>
  packed.map((flat) => {
    const ring = [];
    let lon = 0;
    let lat = 0;
    for (let at = 0; at < flat.length; at += 2) {
      lon += flat[at];
      lat += flat[at + 1];
      ring.push([lon / 100, lat / 100]);
    }
    return ring;
  });

export const packRings = (rings) =>
  rings.map((ring) => {
    const flat = [];
    let lon = 0;
    let lat = 0;
    for (const [x, y] of ring) {
      const qx = Math.round(x * 100);
      const qy = Math.round(y * 100);
      if (flat.length && qx === lon && qy === lat) continue;
      flat.push(qx - lon, qy - lat);
      lon = qx;
      lat = qy;
    }
    return flat;
  });

/** Thin a ring, keeping points that bend it by more than `tolerance` degrees. */
export const simplifyRing = (ring, tolerance) => {
  if (ring.length < 5) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = ring[first];
    const [bx, by] = ring[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let far = -1;
    let farthest = tolerance;
    for (let at = first + 1; at < last; at += 1) {
      const [px, py] = ring[at];
      const distance = length ? Math.abs(dy * (px - ax) - dx * (py - ay)) / length : Math.hypot(px - ax, py - ay);
      if (distance > farthest) {
        farthest = distance;
        far = at;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([first, far], [far, last]);
    }
  }
  return ring.filter((_, at) => keep[at]);
};
