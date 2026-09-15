// Metro maps: routes between stations, and a map drawn as SVG.
//
// A map is plain data, so a city is added by writing one file:
//
//   {
//     id: 'toronto', name: 'Toronto', system: 'TTC Subway', country: 'Canada',
//     change: 4,                      // minutes to change trains, unless a station says otherwise
//     lines: [{
//       id: '1', short: '1', name: 'Line 1 Yonge–University',
//       colour: '#F8C300', text: '#1a1a1a', minutes: 2,
//       branches: [['finch', 'north-york-centre', ...]],   // each one a train a rider can stay on end to end
//       via: { 'union king': [[33, 31]] },                  // bends drawn between two neighbours
//     }],
//     times: { 'warden kennedy': 3 },   // minutes between two neighbours, where not the line's usual
//     walks: [['abbey-street', 'marlborough', 2]],   // changes made on foot between two stations, with the minutes
//     stations: {
//       'st-george': { name: 'St George', x: 30, y: 20, at: { 1: [30, 19] }, change: 3, aka: [], label: 'w' },
//     },
//     features: [{ kind: 'water' | 'river' | 'park', points: [[x, y], ...], width: 1, name: 'Lake Ontario', labelAt: [x, y] }],
//   }
//
// Positions are squares on a grid. The map is topological: it shows order and
// connections, not distances on the ground. `at` places a station somewhere
// else for one line, which is how two lines run side by side between the same
// two stations; the station is then drawn as a bar joining its places.

export const UNIT = 20;
const LINE = 8;
const DOT = 4.5;
const RING = 6.5;
export const FONT = 12;

const COLOUR = /^#[0-9a-f]{3,8}$/i;
const colour = (value, fallback = '#888888') => (COLOUR.test(value ?? '') ? value : fallback);
const escape = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const round = (value) => Math.round(value * 10) / 10;

/** Lower case, accents and punctuation gone, so "Bloor–Yonge" is found by "bloor yonge" and 강남 by 강남. */
export const normalise = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const pairKey = (a, b) => (a < b ? `${a} ${b}` : `${b} ${a}`);

// ---- the network ----------------------------------------------------------

/** Check a map and turn it into what routing and drawing work from. Problems are listed, not thrown. */
export const buildNetwork = (map) => {
  const problems = [];
  const stations = new Map();
  const scale = ([x, y]) => [x * UNIT, y * UNIT];

  for (const [id, station] of Object.entries(map.stations ?? {})) {
    if (!station?.name) problems.push(`station ${id} has no name`);
    if (!Number.isFinite(station?.x) || !Number.isFinite(station?.y)) problems.push(`station ${id} has no place on the grid`);
    const at = {};
    for (const [line, point] of Object.entries(station?.at ?? {})) at[line] = scale(point);
    stations.set(id, {
      id,
      name: station?.name ?? id,
      aka: station?.aka ?? [],
      x: (station?.x ?? 0) * UNIT,
      y: (station?.y ?? 0) * UNIT,
      at,
      label: station?.label ?? null,
      change: station?.change ?? map.change ?? 4,
      lines: [],
    });
  }

  const lines = [];
  for (const line of map.lines ?? []) {
    const id = String(line.id);
    const branches = (line.branches ?? []).map((branch) => branch.slice());
    if (!branches.length) problems.push(`line ${id} has no stations`);
    for (const branch of branches) {
      if (branch.length < 2) problems.push(`line ${id} has a branch of fewer than two stations`);
      branch.forEach((station, index) => {
        if (!stations.has(station)) problems.push(`line ${id} names ${station}, which is not a station`);
        // a circle line ends where it began, and that is the only station it may call at twice
        const closing = index === branch.length - 1 && index > 2 && station === branch[0];
        if (branch.indexOf(station) !== index && !closing) problems.push(`line ${id} calls at ${station} twice`);
      });
    }
    if (!COLOUR.test(line.colour ?? '')) problems.push(`line ${id} has no colour`);
    const via = {};
    for (const [key, points] of Object.entries(line.via ?? {})) via[key] = points.map(scale);
    lines.push({
      id,
      name: line.name ?? id,
      short: String(line.short ?? ''),
      colour: colour(line.colour),
      text: colour(line.text, '#ffffff'),
      minutes: line.minutes ?? 2,
      branches,
      via,
    });
  }

  for (const line of lines) {
    for (const branch of line.branches) {
      for (const id of branch) {
        const station = stations.get(id);
        if (station && !station.lines.includes(line.id)) station.lines.push(line.id);
      }
    }
  }
  const taken = new Map();
  for (const station of stations.values()) {
    if (!station.lines.length) problems.push(`station ${station.id} is on no line`);
    const spot = `${station.x},${station.y}`;
    if (taken.has(spot)) problems.push(`stations ${taken.get(spot)} and ${station.id} are drawn in the same place`);
    taken.set(spot, station.id);
  }

  const times = {};
  for (const [key, minutes] of Object.entries(map.times ?? {})) {
    const [a, b] = key.split(' ');
    if (!stations.has(a) || !stations.has(b)) problems.push(`a travel time names ${a} and ${b}, which are not both stations`);
    times[pairKey(a, b)] = minutes;
  }

  const walks = [];
  for (const [a, b, minutes = 3] of map.walks ?? []) {
    if (!stations.has(a) || !stations.has(b)) problems.push(`a walk names ${a} and ${b}, which are not both stations`);
    else walks.push({ a, b, minutes });
  }

  placeSideBySide(stations, lines);

  const features = (map.features ?? []).map((feature) => ({
    kind: feature.kind,
    name: feature.name ?? '',
    points: (feature.points ?? []).map(scale),
    width: (feature.width ?? 1) * UNIT,
    labelAt: feature.labelAt ? scale(feature.labelAt) : null,
  }));

  return {
    id: map.id,
    name: map.name,
    system: map.system,
    country: map.country,
    credit: map.credit ?? '',
    change: map.change ?? 4,
    stations,
    lines,
    lineById: new Map(lines.map((line) => [line.id, line])),
    times,
    walks,
    features,
    problems,
  };
};

/**
 * Where two or more lines run between the same two places, draw them side by
 * side. Each shared stretch keeps its lines in one order, turned to match the
 * stretch it continues from, so lines do not swap sides at a bend. The result
 * is a place per line at each station, kept on the station as `spots`.
 */
function placeSideBySide(stations, lines) {
  const baseOf = (id, lineId) => {
    const station = stations.get(id);
    return station.at[lineId] ?? [station.x, station.y];
  };
  const pointKey = ([x, y]) => `${round(x)},${round(y)}`;
  const segmentOf = (a, b, lineId) => {
    let p = baseOf(a, lineId);
    let q = baseOf(b, lineId);
    let ka = pointKey(p);
    let kb = pointKey(q);
    if (ka > kb) {
      [p, q] = [q, p];
      [ka, kb] = [kb, ka];
    }
    return { key: `${ka}|${kb}`, p, q, ka, kb };
  };

  const segments = new Map();
  const each = (visit) => {
    for (const line of lines) {
      for (const branch of line.branches) {
        for (let at = 1; at < branch.length; at += 1) {
          if (stations.has(branch[at - 1]) && stations.has(branch[at])) visit(line, branch[at - 1], branch[at]);
        }
      }
    }
  };
  each((line, a, b) => {
    const found = segmentOf(a, b, line.id);
    if (!segments.has(found.key)) segments.set(found.key, { ...found, lines: [], sign: 0 });
    const segment = segments.get(found.key);
    if (!segment.lines.includes(line.id)) segment.lines.push(line.id);
  });

  const unit = (segment) => {
    const dx = segment.q[0] - segment.p[0];
    const dy = segment.q[1] - segment.p[1];
    const length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
  };

  const byPoint = new Map();
  for (const segment of segments.values()) {
    if (segment.lines.length < 2) continue;
    for (const key of [segment.ka, segment.kb]) {
      if (!byPoint.has(key)) byPoint.set(key, []);
      byPoint.get(key).push(segment);
    }
  }
  // Travelling from one stretch into the next through a shared point, a
  // line's offset to the right of travel should stay the same.
  for (const start of segments.values()) {
    if (start.lines.length < 2 || start.sign) continue;
    start.sign = 1;
    const queue = [start];
    while (queue.length) {
      const segment = queue.shift();
      for (const key of [segment.ka, segment.kb]) {
        for (const next of byPoint.get(key) ?? []) {
          if (next.sign || !next.lines.some((line) => segment.lines.includes(line))) continue;
          const into = key === segment.kb ? 1 : -1;
          const out = key === next.ka ? 1 : -1;
          next.sign = segment.sign * into * out;
          queue.push(next);
        }
      }
    }
  }

  const order = new Map(lines.map((line, index) => [line.id, index]));
  const sums = new Map();
  const counted = new Set();
  each((line, a, b) => {
    const found = segmentOf(a, b, line.id);
    const tally = `${found.key}|${line.id}`;
    if (counted.has(tally)) return;
    counted.add(tally);
    const segment = segments.get(found.key);
    let dx = 0;
    let dy = 0;
    if (segment.lines.length > 1) {
      const sorted = segment.lines.slice().sort((x, y) => order.get(x) - order.get(y));
      const offset = (sorted.indexOf(line.id) - (sorted.length - 1) / 2) * LINE * segment.sign;
      const [ux, uy] = unit(segment);
      dx = -uy * offset;
      dy = ux * offset;
    }
    for (const id of [a, b]) {
      const [x, y] = baseOf(id, line.id);
      const key = `${id}|${line.id}`;
      const sum = sums.get(key) ?? [0, 0, 0];
      sums.set(key, [sum[0] + x + dx, sum[1] + y + dy, sum[2] + 1]);
    }
  });
  for (const [key, [x, y, count]] of sums) {
    const split = key.lastIndexOf('|');
    const station = stations.get(key.slice(0, split));
    station.spots ??= {};
    station.spots[key.slice(split + 1)] = [x / count, y / count];
  }
}

/** Where a station sits for one of its lines. */
export const pointOf = (network, id, lineId) => {
  const station = network.stations.get(id);
  return station.spots?.[lineId] ?? station.at[lineId] ?? [station.x, station.y];
};

const viaOf = (line, a, b) => line.via[`${a} ${b}`] ?? line.via[`${b} ${a}`]?.slice().reverse() ?? [];

/** Minutes between two neighbouring stations on a line. */
export const minutesBetween = (network, line, a, b) => network.times[pairKey(a, b)] ?? line.minutes;

/** The points a train passes through along a run of stations, each station point carrying its id. */
export const stretchPoints = (network, lineId, ids) => {
  const line = network.lineById.get(lineId);
  const points = [];
  ids.forEach((id, index) => {
    if (index) points.push(...viaOf(line, ids[index - 1], id).map(([x, y]) => [x, y, null]));
    const [x, y] = pointOf(network, id, lineId);
    points.push([x, y, id]);
  });
  return points;
};

/** A line as polylines to draw, with track that branches share drawn once. */
export const linePaths = (network, lineId) => {
  const line = network.lineById.get(lineId);
  const drawn = new Set();
  const paths = [];
  for (const branch of line.branches) {
    let run = [];
    const flush = () => {
      if (run.length > 1) paths.push(stretchPoints(network, lineId, run));
      run = [];
    };
    for (let index = 1; index < branch.length; index += 1) {
      const key = pairKey(branch[index - 1], branch[index]);
      if (drawn.has(key)) {
        flush();
        continue;
      }
      drawn.add(key);
      if (!run.length) run.push(branch[index - 1]);
      run.push(branch[index]);
    }
    flush();
  }
  return paths;
};

// ---- finding stations -------------------------------------------------------

/** Stations whose name, or another name they go by, matches what was typed; best matches first. */
export const searchStations = (network, query, limit = 8) => {
  const wanted = normalise(query);
  if (!wanted) return [];
  const parts = wanted.split(' ');
  const found = [];
  for (const station of network.stations.values()) {
    let best = Infinity;
    for (const name of [station.name, ...station.aka].map(normalise)) {
      if (name === wanted) best = Math.min(best, 0);
      else if (name.startsWith(wanted)) best = Math.min(best, 1);
      else if (name.split(' ').some((word) => word.startsWith(wanted))) best = Math.min(best, 2);
      else if (name.includes(wanted)) best = Math.min(best, 3);
      else if (parts.every((part) => name.includes(part))) best = Math.min(best, 4);
    }
    if (best < Infinity) found.push({ best, station });
  }
  return found
    .sort((a, b) => a.best - b.best || a.station.name.localeCompare(b.station.name))
    .slice(0, limit)
    .map((item) => item.station);
};

/** A station by its id, or by the best match for a name. */
export const findStation = (network, text) => network.stations.get(text) ?? searchStations(network, text, 1)[0] ?? null;

// ---- routes -------------------------------------------------------------------

const graphs = new WeakMap();

// One node for each station on each branch it is served by. Riding moves
// along a branch; changing moves between nodes of one station and costs the
// time it takes to change trains.
const graphOf = (network) => {
  if (graphs.has(network)) return graphs.get(network);
  const nodes = [];
  const index = new Map();
  const nodeOf = (station, line, branch) => {
    const key = `${station}|${line}|${branch}`;
    if (!index.has(key)) {
      index.set(key, nodes.length);
      nodes.push({ station, line, branch, edges: [] });
    }
    return index.get(key);
  };
  for (const line of network.lines) {
    line.branches.forEach((ids, branch) => {
      for (let at = 1; at < ids.length; at += 1) {
        const a = nodeOf(ids[at - 1], line.id, branch);
        const b = nodeOf(ids[at], line.id, branch);
        const minutes = minutesBetween(network, line, ids[at - 1], ids[at]);
        nodes[a].edges.push({ to: b, minutes, ride: true });
        nodes[b].edges.push({ to: a, minutes, ride: true });
      }
    });
  }
  const byStation = new Map();
  nodes.forEach((node, at) => {
    if (!byStation.has(node.station)) byStation.set(node.station, []);
    byStation.get(node.station).push(at);
  });
  for (const [id, list] of byStation) {
    const minutes = network.stations.get(id).change;
    for (const a of list) for (const b of list) if (a !== b) nodes[a].edges.push({ to: b, minutes, ride: false });
  }
  for (const walk of network.walks ?? []) {
    for (const a of byStation.get(walk.a) ?? []) {
      for (const b of byStation.get(walk.b) ?? []) {
        nodes[a].edges.push({ to: b, minutes: walk.minutes, ride: false });
        nodes[b].edges.push({ to: a, minutes: walk.minutes, ride: false });
      }
    }
  }
  const graph = { nodes, byStation };
  graphs.set(network, graph);
  return graph;
};

/**
 * The route between two stations: the fastest, or with prefer 'changes' the
 * one with fewest changes and, among those, the fastest. Null when either
 * station is unknown or nothing joins them.
 */
export const planRoute = (network, fromId, toId, { prefer = 'fastest' } = {}) => {
  if (!network.stations.has(fromId) || !network.stations.has(toId)) return null;
  if (fromId === toId) return { from: fromId, to: toId, minutes: 0, stops: 0, changes: 0, legs: [] };

  const { nodes, byStation } = graphOf(network);
  const cost = new Float64Array(nodes.length).fill(Infinity);
  const previous = new Int32Array(nodes.length).fill(-1);
  const settled = new Uint8Array(nodes.length);
  for (const start of byStation.get(fromId) ?? []) cost[start] = 0;

  let end = -1;
  for (;;) {
    let next = -1;
    for (let at = 0; at < nodes.length; at += 1) {
      if (!settled[at] && cost[at] < Infinity && (next < 0 || cost[at] < cost[next])) next = at;
    }
    if (next < 0) break;
    settled[next] = 1;
    if (nodes[next].station === toId) {
      end = next;
      break;
    }
    for (const edge of nodes[next].edges) {
      const through = cost[next] + edge.minutes + (!edge.ride && prefer === 'changes' ? 1000 : 0);
      if (through < cost[edge.to]) {
        cost[edge.to] = through;
        previous[edge.to] = next;
      }
    }
  }
  if (end < 0) return null;

  const trail = [];
  for (let at = end; at >= 0; at = previous[at]) trail.unshift(nodes[at]);

  // Along the trail a train is ridden while line and branch stay the same;
  // a change keeps the station, and a walk moves to another one.
  const runs = [];
  let run = null;
  for (let at = 0; at < trail.length; at += 1) {
    const node = trail[at];
    const before = trail[at - 1];
    if (before && before.line === node.line && before.branch === node.branch && before.station !== node.station) {
      run.stations.push(node.station);
      continue;
    }
    if (run) runs.push(run);
    if (before && before.station !== node.station) runs.push({ walk: true, stations: [before.station, node.station] });
    run = { line: node.line, branch: node.branch, stations: [node.station] };
  }
  if (run) runs.push(run);

  const walkMinutes = (a, b) => network.walks.find((walk) => (walk.a === a && walk.b === b) || (walk.a === b && walk.b === a))?.minutes ?? 0;
  const legs = runs
    .filter((item) => item.walk || item.stations.length > 1)
    .map((item) => {
      if (item.walk) {
        const [from, to] = item.stations;
        return { walk: true, line: null, stations: item.stations, from, to, stops: 0, minutes: walkMinutes(from, to), towards: [] };
      }
      const { line: lineId, stations } = item;
      const line = network.lineById.get(lineId);
      let minutes = 0;
      for (let at = 1; at < stations.length; at += 1) minutes += minutesBetween(network, line, stations[at - 1], stations[at]);
      // every branch that runs through these stations in this order, and where each is headed
      const towards = [];
      for (const ids of line.branches) {
        const start = ids.indexOf(stations[0]);
        if (start < 0) continue;
        const step = ids[start + 1] === stations[1] ? 1 : ids[start - 1] === stations[1] ? -1 : 0;
        if (!step || !stations.every((id, k) => ids[start + k * step] === id)) continue;
        const terminus = step > 0 ? ids[ids.length - 1] : ids[0];
        if (!towards.includes(terminus)) towards.push(terminus);
      }
      return { line: lineId, stations, from: stations[0], to: stations[stations.length - 1], stops: stations.length - 1, minutes, towards };
    });

  let changeMinutes = 0;
  for (let at = 1; at < legs.length; at += 1) {
    if (!legs[at].walk && !legs[at - 1].walk) changeMinutes += network.stations.get(legs[at].from).change;
  }
  const rides = legs.filter((leg) => !leg.walk);
  return {
    from: fromId,
    to: toId,
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0) + changeMinutes,
    stops: legs.reduce((sum, leg) => sum + leg.stops, 0),
    changes: Math.max(0, rides.length - 1),
    legs,
  };
};

// ---- visiting several stations --------------------------------------------------

/** The cheapest order through every station, trying every order: fine up to a dozen. */
const exactOrder = (cost, fixed, cycle) => {
  const n = cost.length;
  const full = 1 << n;
  const best = new Float64Array(full * n).fill(Infinity);
  const came = new Int8Array(full * n).fill(-1);
  for (const start of fixed ? [0] : [...cost.keys()]) best[(1 << start) * n + start] = 0;
  for (let mask = 1; mask < full; mask += 1) {
    for (let last = 0; last < n; last += 1) {
      const here = best[mask * n + last];
      if (here === Infinity || !(mask & (1 << last))) continue;
      for (let next = 0; next < n; next += 1) {
        if (mask & (1 << next)) continue;
        const slot = (mask | (1 << next)) * n + next;
        if (here + cost[last][next] < best[slot]) {
          best[slot] = here + cost[last][next];
          came[slot] = last;
        }
      }
    }
  }
  let end = 0;
  let total = Infinity;
  for (let last = 0; last < n; last += 1) {
    const value = best[(full - 1) * n + last] + (cycle ? cost[last][0] : 0);
    if (value < total) {
      total = value;
      end = last;
    }
  }
  const order = [];
  for (let mask = full - 1, at = end; at >= 0; ) {
    order.unshift(at);
    const before = came[mask * n + at];
    mask &= ~(1 << at);
    at = before;
  }
  return order;
};

/** A good order for many stations: nearest first, then untangled two stops at a time. */
const shortOrder = (cost, fixed, cycle) => {
  const n = cost.length;
  const length = (order) => {
    let sum = cycle ? cost[order[n - 1]][order[0]] : 0;
    for (let at = 1; at < n; at += 1) sum += cost[order[at - 1]][order[at]];
    return sum;
  };
  let best = null;
  for (const start of fixed ? [0] : [...cost.keys()]) {
    const order = [start];
    const used = new Set(order);
    while (order.length < n) {
      const last = order[order.length - 1];
      let pick = -1;
      for (let next = 0; next < n; next += 1) {
        if (!used.has(next) && (pick < 0 || cost[last][next] < cost[last][pick])) pick = next;
      }
      order.push(pick);
      used.add(pick);
    }
    for (let improved = true; improved; ) {
      improved = false;
      for (let i = fixed ? 1 : 0; i < n - 1; i += 1) {
        for (let k = i + 1; k < n; k += 1) {
          const turned = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
          if (length(turned) < length(order) - 1e-9) {
            order.splice(0, n, ...turned);
            improved = true;
          }
        }
      }
    }
    if (!best || length(order) < length(best)) best = order;
  }
  return best;
};

/**
 * The quickest order to visit several stations, with the route from each to
 * the next. keepStart keeps the first station first; returnToStart comes back
 * to it at the end. Null for fewer than two stations or when one cannot be
 * reached.
 */
export const planTour = (network, stops, { prefer = 'fastest', keepStart = true, returnToStart = false } = {}) => {
  const ids = [...new Set(stops)].filter((id) => network.stations.has(id));
  if (ids.length < 2) return null;
  const n = ids.length;
  const cost = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      const route = planRoute(network, ids[a], ids[b], { prefer });
      if (!route) return null;
      cost[a][b] = cost[b][a] = route.minutes + (prefer === 'changes' ? route.changes * 1000 : 0);
    }
  }
  const fixed = keepStart || returnToStart;
  const order = n <= 12 ? exactOrder(cost, fixed, returnToStart) : shortOrder(cost, fixed, returnToStart);
  const visits = order.map((index) => ids[index]);
  if (returnToStart) visits.push(visits[0]);
  const legs = [];
  for (let at = 1; at < visits.length; at += 1) legs.push(planRoute(network, visits[at - 1], visits[at], { prefer }));
  return {
    visits,
    legs,
    minutes: legs.reduce((sum, leg) => sum + leg.minutes, 0),
    stops: legs.reduce((sum, leg) => sum + leg.stops, 0),
    changes: legs.reduce((sum, leg) => sum + leg.changes, 0),
  };
};

// ---- geometry -------------------------------------------------------------------

/** An SVG path through points, bends rounded; tighter at stations so the line still meets them. */
export const roundedPath = (points, radius = 16, stationRadius = 5) => {
  if (!points.length) return '';
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let at = 1; at < points.length - 1; at += 1) {
    const [px, py] = points[at - 1];
    const [x, y, station] = points[at];
    const [nx, ny] = points[at + 1];
    const into = Math.hypot(x - px, y - py);
    const out = Math.hypot(nx - x, ny - y);
    if (!into || !out) continue;
    const ux = (x - px) / into;
    const uy = (y - py) / into;
    const vx = (nx - x) / out;
    const vy = (ny - y) / out;
    if (Math.abs(ux * vy - uy * vx) < 1e-6 && ux * vx + uy * vy > 0) {
      d += ` L${round(x)} ${round(y)}`;
      continue;
    }
    const r = Math.min(station ? stationRadius : radius, into / 2, out / 2);
    d += ` L${round(x - ux * r)} ${round(y - uy * r)} Q${round(x)} ${round(y)} ${round(x + vx * r)} ${round(y + vy * r)}`;
  }
  const last = points[points.length - 1];
  if (points.length > 1) d += ` L${round(last[0])} ${round(last[1])}`;
  return d;
};

/** A closed, softened outline through points, for water and parks. */
const blobPath = (points) => {
  if (points.length < 3) return '';
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[points.length - 1], points[0]);
  let d = `M${round(start[0])} ${round(start[1])}`;
  points.forEach((point, at) => {
    const end = mid(point, points[(at + 1) % points.length]);
    d += ` Q${round(point[0])} ${round(point[1])} ${round(end[0])} ${round(end[1])}`;
  });
  return `${d} Z`;
};

/** Measure along a polyline: its length, and the point and heading at any distance. */
export const walker = (points) => {
  const lengths = [0];
  for (let at = 1; at < points.length; at += 1) {
    lengths.push(lengths[at - 1] + Math.hypot(points[at][0] - points[at - 1][0], points[at][1] - points[at - 1][1]));
  }
  const total = lengths[lengths.length - 1];
  const at = (distance) => {
    if (points.length < 2) return [points[0]?.[0] ?? 0, points[0]?.[1] ?? 0, 0];
    const d = Math.min(total, Math.max(0, distance));
    let lo = 1;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] < d) lo = mid + 1;
      else hi = mid;
    }
    const a = points[lo - 1];
    const b = points[lo];
    const span = lengths[lo] - lengths[lo - 1] || 1;
    const share = (d - lengths[lo - 1]) / span;
    return [a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share, (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI];
  };
  return { total, lengths, at };
};

const ease = (share) => share * share * (3 - 2 * share);

/**
 * A train running a branch out and back for ever: it slows into each
 * station, waits, and sets off again. `at(seconds)` is where it is.
 */
export const trainMotion = (points, { speed = 90, dwell = 0.9 } = {}) => {
  const path = walker(points);
  const stops = [];
  points.forEach((point, at) => {
    if (point[2]) stops.push(path.lengths[at]);
  });
  const visits = [...stops, ...stops.slice(0, -1).reverse()];
  const hops = [];
  let clock = 0;
  for (let at = 1; at < visits.length; at += 1) {
    const travel = Math.max(0.4, Math.abs(visits[at] - visits[at - 1]) / speed);
    hops.push({ start: clock, travel, from: visits[at - 1], to: visits[at] });
    clock += travel + dwell;
  }
  const period = clock || 1;
  return {
    period,
    at(seconds) {
      if (!hops.length) return path.at(0);
      const time = ((seconds % period) + period) % period;
      let lo = 0;
      let hi = hops.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (hops[mid].start <= time) lo = mid;
        else hi = mid - 1;
      }
      const hop = hops[lo];
      const share = Math.min(1, (time - hop.start) / hop.travel);
      return path.at(hop.from + (hop.to - hop.from) * ease(share));
    },
  };
};

// ---- labels -------------------------------------------------------------------

const charWidth = (char) => {
  if (" .,:;!|'’ijlI".includes(char)) return 0.3;
  if ('mwMW'.includes(char)) return 0.88;
  if (/[A-Z0-9]/.test(char)) return 0.66;
  return 0.55;
};

/** A close guess at how wide a label is, the same everywhere so placing labels needs no browser. */
export const textWidth = (text, size = FONT) => [...String(text)].reduce((sum, char) => sum + charWidth(char), 0) * size;

const polygonsOverlap = (a, b) => {
  for (const shape of [a, b]) {
    for (let at = 0; at < shape.length; at += 1) {
      const [x1, y1] = shape[at];
      const [x2, y2] = shape[(at + 1) % shape.length];
      const nx = y1 - y2;
      const ny = x2 - x1;
      let minA = Infinity;
      let maxA = -Infinity;
      let minB = Infinity;
      let maxB = -Infinity;
      for (const [x, y] of a) {
        const p = x * nx + y * ny;
        if (p < minA) minA = p;
        if (p > maxA) maxA = p;
      }
      for (const [x, y] of b) {
        const p = x * nx + y * ny;
        if (p < minB) minB = p;
        if (p > maxB) maxB = p;
      }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
};

const boxOf = (shape) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of shape) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
};

const boxesMeet = (a, b) => a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

const thickSegment = ([x1, y1], [x2, y2], half) => {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = ((x2 - x1) / length) * half;
  const uy = ((y2 - y1) / length) * half;
  return [
    [x1 - uy - ux, y1 + ux - uy],
    [x2 - uy + ux, y2 + ux + uy],
    [x2 + uy + ux, y2 - ux + uy],
    [x1 + uy - ux, y1 - ux - uy],
  ];
};

/** The places a station is drawn at, one per line that meets there at its own spot. */
const spotsOf = (network, station) => {
  const spots = [];
  for (const line of station.lines) {
    const [x, y] = pointOf(network, station.id, line);
    if (!spots.some(([sx, sy]) => sx === x && sy === y)) spots.push([x, y]);
  }
  return spots;
};

const markerBox = (network, station) => {
  const spots = spotsOf(network, station);
  const r = station.lines.length > 1 || spots.length > 1 ? RING : DOT;
  const box = boxOf(spots);
  return { minX: box.minX - r, minY: box.minY - r, maxX: box.maxX + r, maxY: box.maxY + r };
};

const rectangle = (box) => [
  [box.minX, box.minY],
  [box.maxX, box.minY],
  [box.maxX, box.maxY],
  [box.minX, box.maxY],
];

// name, preference, and where the label starts and which way it runs, from the marker's box
const CANDIDATES = [
  ['e', 0],
  ['w', 0.3],
  ['n', 0.9],
  ['s', 1],
  ['ne', 0.6],
  ['se', 0.7],
  ['nw', 0.8],
  ['sw', 0.85],
  ['rne', 1.4],
  ['rse', 1.5],
  ['rnw', 1.6],
  ['rsw', 1.7],
];

const candidate = (name, box, width, size) => {
  const gap = 5;
  const h = size * 1.15;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const tilt = 40;
  switch (name) {
    case 'e': return { x: box.maxX + gap, y: cy, anchor: 'start', angle: 0 };
    case 'w': return { x: box.minX - gap, y: cy, anchor: 'end', angle: 0 };
    case 'n': return { x: cx, y: box.minY - gap - h / 2, anchor: 'middle', angle: 0 };
    case 's': return { x: cx, y: box.maxY + gap + h / 2, anchor: 'middle', angle: 0 };
    case 'ne': return { x: box.maxX + 1, y: box.minY - h / 2, anchor: 'start', angle: 0 };
    case 'se': return { x: box.maxX + 1, y: box.maxY + h / 2, anchor: 'start', angle: 0 };
    case 'nw': return { x: box.minX - 1, y: box.minY - h / 2, anchor: 'end', angle: 0 };
    case 'sw': return { x: box.minX - 1, y: box.maxY + h / 2, anchor: 'end', angle: 0 };
    case 'rne': return { x: box.maxX + 2, y: box.minY - 2, anchor: 'start', angle: -tilt };
    case 'rse': return { x: box.maxX + 2, y: box.maxY + 2, anchor: 'start', angle: tilt };
    case 'rnw': return { x: box.minX - 2, y: box.minY - 2, anchor: 'end', angle: tilt };
    default: return { x: box.minX - 2, y: box.maxY + 2, anchor: 'end', angle: -tilt };
  }
};

const labelShape = ({ x, y, anchor, angle }, width, size) => {
  const h = size * 1.15;
  const left = anchor === 'start' ? 0 : anchor === 'end' ? -width : -width / 2;
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [
    [left, -h / 2],
    [left + width, -h / 2],
    [left + width, h / 2],
    [left, h / 2],
  ].map(([lx, ly]) => [x + lx * cos - ly * sin, y + lx * sin + ly * cos]);
};

/** Line badges beyond the ends of each branch, as { line, x, y }. */
export const badgesOf = (network) => {
  const badges = [];
  const seen = new Set();
  for (const line of network.lines) {
    if (!line.short) continue;
    for (const branch of line.branches) {
      if (branch[0] === branch[branch.length - 1]) continue;
      for (const [end, next] of [[0, 1], [branch.length - 1, branch.length - 2]]) {
        const key = `${line.id}|${branch[end]}`;
        if (seen.has(key) || branch.length < 2) continue;
        // an end that another branch of the same line runs through is not an end
        if (line.branches.some((other) => other !== branch && other.includes(branch[end]) && other[0] !== branch[end] && other[other.length - 1] !== branch[end])) continue;
        seen.add(key);
        const points = stretchPoints(network, line.id, [branch[next], branch[end]]);
        const [ax, ay] = points[points.length - 2];
        const [bx, by] = points[points.length - 1];
        const length = Math.hypot(bx - ax, by - ay) || 1;
        badges.push({ line: line.id, station: branch[end], x: bx + ((bx - ax) / length) * 22, y: by + ((by - ay) / length) * 22 });
      }
    }
  }
  return badges;
};

/**
 * Where each station's name goes: beside it, above, below, or at a slant,
 * whichever crosses the fewest lines, stations and names already placed.
 * A station's own `label` in the map data settles it.
 */
export const placeLabels = (network, { measure = textWidth, size = FONT } = {}) => {
  const obstacles = [];
  for (const line of network.lines) {
    for (const points of linePaths(network, line.id)) {
      for (let at = 1; at < points.length; at += 1) {
        const shape = thickSegment(points[at - 1], points[at], LINE / 2 + 2);
        obstacles.push({ shape, box: boxOf(shape), weight: 60 });
      }
    }
  }
  const markers = new Map();
  for (const station of network.stations.values()) {
    const box = markerBox(network, station);
    markers.set(station.id, box);
    obstacles.push({ shape: rectangle(box), box, weight: 80, station: station.id });
  }
  for (const badge of badgesOf(network)) {
    const half = Math.max(20, textWidth(network.lineById.get(badge.line).short, 11) + 10) / 2 + 1;
    const box = { minX: badge.x - half, minY: badge.y - 11, maxX: badge.x + half, maxY: badge.y + 11 };
    obstacles.push({ shape: rectangle(box), box, weight: 80 });
  }

  // interchanges first, then along each line in order, so neighbours tend to agree
  const order = [];
  const queued = new Set();
  const queue = (id) => {
    if (queued.has(id)) return;
    queued.add(id);
    order.push(id);
  };
  for (const station of network.stations.values()) if (station.lines.length > 1) queue(station.id);
  for (const line of network.lines) for (const branch of line.branches) branch.forEach(queue);

  const chosen = new Map();
  const labels = new Map();
  const placed = [];
  for (const id of order) {
    const station = network.stations.get(id);
    const box = markers.get(id);
    const width = measure(station.name, size);
    const neighbours = new Set();
    for (const line of network.lines) {
      for (const branch of line.branches) {
        const at = branch.indexOf(id);
        if (at < 0) continue;
        if (at > 0) neighbours.add(branch[at - 1]);
        if (at < branch.length - 1) neighbours.add(branch[at + 1]);
      }
    }
    let best = null;
    for (const [name, preference] of CANDIDATES) {
      if (station.label && station.label !== name) continue;
      const spot = candidate(name, box, width, size);
      const shape = labelShape(spot, width, size);
      const bounds = boxOf(shape);
      let cost = preference;
      for (const obstacle of obstacles) {
        if (obstacle.station === id || !boxesMeet(bounds, obstacle.box)) continue;
        if (polygonsOverlap(shape, obstacle.shape)) cost += obstacle.weight;
      }
      for (const other of placed) {
        if (boxesMeet(bounds, other.box) && polygonsOverlap(shape, other.shape)) cost += 400;
      }
      for (const neighbour of neighbours) if (chosen.get(neighbour) === name) cost -= 0.5;
      if (!best || cost < best.cost) best = { cost, name, spot, shape, bounds };
    }
    chosen.set(id, best.name);
    placed.push({ shape: best.shape, box: best.bounds });
    labels.set(id, { ...best.spot, side: best.name, shape: best.shape });
  }
  return labels;
};

/** How many pairs of names are drawn over one another. */
export const labelClashes = (labels) => {
  const list = [...labels.values()];
  let clashes = 0;
  for (let a = 0; a < list.length; a += 1) {
    for (let b = a + 1; b < list.length; b += 1) {
      if (boxesMeet(boxOf(list[a].shape), boxOf(list[b].shape)) && polygonsOverlap(list[a].shape, list[b].shape)) clashes += 1;
    }
  }
  return clashes;
};

// ---- drawing --------------------------------------------------------------------

/** The box a set of stations, their names and the given points take up. */
const extentOf = (network, labels, ids, extra = []) => {
  const points = [...extra];
  for (const id of ids) {
    const box = markerBox(network, network.stations.get(id));
    points.push([box.minX, box.minY], [box.maxX, box.maxY]);
    const label = labels?.get(id);
    if (label) points.push(...label.shape);
  }
  const box = boxOf(points);
  return { x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY };
};

/** The whole map's box, water and parks included. */
export const mapBounds = (network, labels) => {
  const extra = [];
  for (const line of network.lines) for (const points of linePaths(network, line.id)) extra.push(...points);
  for (const badge of badgesOf(network)) extra.push([badge.x - 12, badge.y - 12], [badge.x + 12, badge.y + 12]);
  for (const feature of network.features) extra.push(...feature.points);
  const box = extentOf(network, labels, [...network.stations.keys()], extra);
  const pad = UNIT * 1.5;
  return { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
};

/** The box of a route or of a line, for bringing it into view. */
export const stationsBounds = (network, labels, ids) => {
  const box = extentOf(network, labels, ids);
  const pad = UNIT * 1.2;
  return { x: box.x - pad, y: box.y - pad, width: box.width + pad * 2, height: box.height + pad * 2 };
};

const markerSvg = (network, station) => {
  const spots = spotsOf(network, station);
  const single = station.lines.length === 1 && spots.length === 1;
  if (single) {
    const [x, y] = spots[0];
    const line = network.lineById.get(station.lines[0]);
    return `<circle class="marker" cx="${round(x)}" cy="${round(y)}" r="${DOT}" style="--line:${line.colour}"/>`;
  }
  if (spots.length === 1) {
    const [x, y] = spots[0];
    return `<circle class="marker interchange" cx="${round(x)}" cy="${round(y)}" r="${RING}"/>`;
  }
  // the bar joins the two places furthest apart
  let ends = [spots[0], spots[1]];
  let widest = -1;
  for (const a of spots) {
    for (const b of spots) {
      const apart = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (apart > widest) {
        widest = apart;
        ends = [a, b];
      }
    }
  }
  const d = `M${round(ends[0][0])} ${round(ends[0][1])} L${round(ends[1][0])} ${round(ends[1][1])}`;
  return `<path class="bar-outer" d="${d}"/><path class="bar-inner" d="${d}"/>`;
};

const labelSvg = (name, label, className = 'label') => {
  const turn = label.angle ? ` transform="rotate(${label.angle} ${round(label.x)} ${round(label.y)})"` : '';
  return `<text class="${className}" x="${round(label.x)}" y="${round(label.y)}" text-anchor="${label.anchor}"${turn}>${escape(name)}</text>`;
};

/**
 * The map as one SVG: water and parks, lines, a layer for trains, stations
 * with their names, and a layer for a route. Stations carry data-station and
 * lines data-line, for a page to hang interaction on.
 */
export const mapSvg = (network, labels = placeLabels(network)) => {
  const view = mapBounds(network, labels);
  const features = network.features
    .map((feature) => {
      if (feature.kind === 'river') {
        return `<path class="river" d="${roundedPath(feature.points, 60)}" stroke-width="${round(feature.width)}"/>`;
      }
      return `<path class="${feature.kind === 'park' ? 'park' : 'water'}" d="${blobPath(feature.points)}"/>`;
    })
    .join('');
  const names = network.features
    .filter((feature) => feature.name && feature.labelAt)
    .map((feature) => `<text class="feature-name" x="${round(feature.labelAt[0])}" y="${round(feature.labelAt[1])}" text-anchor="middle">${escape(feature.name)}</text>`)
    .join('');

  // every casing goes under every track, so lines side by side stay whole
  const drawn = network.lines.map((line, index) => ({ line, index, paths: linePaths(network, line.id).map((points) => roundedPath(points)) }));
  const casings = drawn
    .map(({ line, index, paths }) => `<g class="line-casing" data-line="${escape(line.id)}" style="--i:${index}">${paths.map((d) => `<path class="casing" d="${d}" pathLength="1"/>`).join('')}</g>`)
    .join('');
  const lines = drawn
    .map(({ line, index, paths }) => `<g class="line" data-line="${escape(line.id)}" style="--i:${index}">${paths.map((d) => `<path class="track" d="${d}" pathLength="1" stroke="${line.colour}"/>`).join('')}</g>`)
    .join('');

  const badges = badgesOf(network)
    .map((badge) => {
      const line = network.lineById.get(badge.line);
      const wide = Math.max(20, textWidth(line.short, 11) + 10);
      return `<g class="badge" data-line="${escape(line.id)}"><rect x="${round(badge.x - wide / 2)}" y="${round(badge.y - 10)}" width="${round(wide)}" height="20" rx="10" fill="${line.colour}"/><text x="${round(badge.x)}" y="${round(badge.y)}" fill="${line.text}">${escape(line.short)}</text></g>`;
    })
    .join('');

  const walks = (network.walks ?? [])
    .map((walk) => {
      const [ax, ay] = spotsOf(network, network.stations.get(walk.a))[0];
      const [bx, by] = spotsOf(network, network.stations.get(walk.b))[0];
      return `<path class="walk-link" d="M${round(ax)} ${round(ay)} L${round(bx)} ${round(by)}"/>`;
    })
    .join('');

  let order = 0;
  const stations = [...network.stations.values()]
    .map((station) => {
      const label = labels.get(station.id);
      const [hx, hy] = spotsOf(network, station)[0];
      order += 1;
      return `<g class="station" data-station="${escape(station.id)}" tabindex="0" role="button" aria-label="${escape(station.name)}" style="--i:${order}"><circle class="hit" cx="${round(hx)}" cy="${round(hy)}" r="14"/>${markerSvg(network, station)}${label ? labelSvg(station.name, label) : ''}</g>`;
    })
    .join('');

  return `<svg class="metro" xmlns="http://www.w3.org/2000/svg" viewBox="${round(view.x)} ${round(view.y)} ${round(view.width)} ${round(view.height)}" preserveAspectRatio="none" font-size="${FONT}"><g class="features">${features}${names}</g><g class="lines"><g class="casings">${casings}</g>${lines}<g class="trains"></g></g><g class="walks">${walks}</g><g class="badges">${badges}</g><g class="stations">${stations}</g><g class="route"></g></svg>`;
};

/** A route drawn over the map: each ride in its line's colour, its stops named, A and B marked. */
export const routeSvg = (network, route, labels = placeLabels(network), { pins } = {}) => {
  if (!route?.legs.length) return '';
  const rides = route.legs
    .map((leg, index) => {
      if (leg.walk) {
        const [ax, ay] = pointOf(network, leg.from, route.legs[index - 1]?.line ?? null);
        const [bx, by] = pointOf(network, leg.to, route.legs[index + 1]?.line ?? null);
        return `<path class="ride-walk" d="M${round(ax)} ${round(ay)} L${round(bx)} ${round(by)}" style="--i:${index}"/>`;
      }
      const line = network.lineById.get(leg.line);
      const d = roundedPath(stretchPoints(network, leg.line, leg.stations));
      return `<path class="ride-casing" d="${d}" pathLength="1" style="--i:${index}"/><path class="ride" d="${d}" pathLength="1" stroke="${line.colour}" style="--i:${index}"/>`;
    })
    .join('');
  const seen = new Set();
  const stops = [];
  route.legs.forEach((leg, index) => {
    leg.stations.forEach((id, at) => {
      if (seen.has(id)) return;
      seen.add(id);
      const station = network.stations.get(id);
      const [x, y] = pointOf(network, id, leg.line);
      const key = (at === 0 && index > 0) || (at === leg.stations.length - 1 && index < route.legs.length - 1);
      const label = labels.get(id);
      stops.push(
        `<g class="stop${key ? ' change' : ''}" data-station="${escape(id)}" style="--i:${index}"><circle class="marker" cx="${round(x)}" cy="${round(y)}" r="${key ? RING : DOT}"/>${label ? labelSvg(station.name, label, 'label') : ''}</g>`,
      );
    });
  });
  // a station's place on the first line of the route that calls there
  const lineAt = (id) => route.legs.find((leg) => !leg.walk && leg.stations.includes(id))?.line ?? null;
  const marks = pins ?? [
    { id: route.from, text: 'A', kind: 'a' },
    { id: route.to, text: 'B', kind: 'b' },
  ];
  const pinned = marks
    .map(({ id, text, kind }, index) => {
      const [x, y] = pointOf(network, id, lineAt(id));
      return `<g class="pin pin-${kind}" style="--i:${index}"><circle cx="${round(x)}" cy="${round(y)}" r="11"/><text x="${round(x)}" y="${round(y)}">${escape(text)}</text></g>`;
    })
    .join('');
  return `${rides}${stops.join('')}${pinned}`;
};

/** Every point a rider passes, leg after leg, for animating a trip. */
export const routePoints = (network, route) =>
  (route?.legs ?? []).flatMap((leg, index) =>
    leg.walk
      ? [pointOf(network, leg.from, route.legs[index - 1]?.line ?? null), pointOf(network, leg.to, route.legs[index + 1]?.line ?? null)]
      : stretchPoints(network, leg.line, leg.stations));
