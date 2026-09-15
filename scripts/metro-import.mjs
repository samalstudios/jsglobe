// Builds a metro map from OpenStreetMap for Metro Maps.
//
//   node scripts/metro-import.mjs <city> [<city> ...] [--fresh]
//
// It reads the city's routes and the order of their stops, merges the stops of
// every line into stations, and lays the stations out as a topological map:
// shaped by where they really are, with the spacing evened out and the lines
// pulled towards horizontals, verticals and diagonals. The result is written to
// js/apps/metro-maps/maps/<city>.js and listed in maps/index.js. What
// OpenStreetMap returned is kept in the system's temporary folder, so a map can
// be laid out again without asking twice; --fresh asks again.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import CITIES from './metro-cities.mjs';
import { buildNetwork, labelClashes, placeLabels, planRoute } from '../js/lib/metro.js';

const CACHE = `${tmpdir()}/jsglobe-metro`;
const MAPS = 'js/apps/metro-maps/maps';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324', '#469990', '#800000', '#808000', '#000075'];
const NAMED_COLOURS = { red: '#e3000f', green: '#00963f', blue: '#0065bd', yellow: '#ffd500', orange: '#f28c00', purple: '#8e2d8b', brown: '#8b5a2b', pink: '#e7609f', grey: '#8c8c8c', gray: '#8c8c8c', black: '#1a1a1a', white: '#dddddd', cyan: '#00a6d6', magenta: '#c7007d', lime: '#9bc31c', teal: '#008080', navy: '#1f3a93', maroon: '#800000', olive: '#808000', gold: '#d4a017', silver: '#a8a8a8' };

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');
const wanted = args.filter((arg) => !arg.startsWith('--'));
if (!wanted.length) {
  console.error(`which city? ${Object.keys(CITIES).join(', ')}`);
  process.exit(1);
}

const normalise = (text) =>
  String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const slug = (text) => normalise(text).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const kilometres = (a, b) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// ---- asking OpenStreetMap ------------------------------------------------------

const download = async (id, config) => {
  const file = `${CACHE}/${id}.json`;
  if (!fresh && existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const [south, west, north, east] = config.bbox;
  const box = `${south},${west},${north},${east}`;
  const routes = config.routes.map((route) => `rel["type"="route"]["route"="${route}"](${box});`).join('');
  const query = `[out:json][timeout:300];(${routes})->.r;.r out body;rel(br.r)["type"="route_master"];out body;node(r.r);out body;way(r.r)["public_transport"="platform"];out tags center;way(r.r)["railway"="platform"];out tags center;`;
  let failure;
  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'jsglobe-metro-import/1.0' },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) throw new Error(`${endpoint} answered ${response.status}`);
      const data = await response.json();
      await mkdir(CACHE, { recursive: true });
      await writeFile(file, JSON.stringify(data));
      return data;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
};

// ---- reading routes ---------------------------------------------------------------

const read = (id, config, data) => {
  const nodes = new Map();
  const ways = new Map();
  const relations = [];
  for (const element of data.elements) {
    if (element.type === 'node') nodes.set(element.id, element);
    else if (element.type === 'way') ways.set(element.id, element);
    else if (element.type === 'relation') relations.push(element);
  }
  const masters = relations.filter((relation) => relation.tags?.type === 'route_master');
  const masterOf = new Map();
  for (const master of masters) for (const member of master.members) masterOf.set(member.ref, master);

  const nameTags = config.names ?? ['name'];
  const nameOf = (element) => {
    for (const tag of nameTags) if (element?.tags?.[tag]) return element.tags[tag];
    return element?.tags?.name ?? '';
  };
  const tidy = (name) => {
    let text = String(name).trim();
    for (const [pattern, replacement] of config.rename ?? []) text = text.replace(pattern, replacement);
    return text.replace(/\s+/g, ' ').trim();
  };

  const routes = relations.filter((relation) => {
    const tags = relation.tags ?? {};
    if (tags.type !== 'route' || !config.routes.includes(tags.route)) return false;
    if (tags.disused || tags.abandoned || tags['state'] === 'proposed' || /construction|proposed|planned|disused/i.test(tags.name ?? '')) return false;
    const master = masterOf.get(relation.id)?.tags ?? {};
    const text = [tags.network, tags.operator, tags.name, tags.ref, master.network, master.operator, master.name].filter(Boolean).join(' | ');
    if (config.network && !config.network.test(text)) return false;
    if (config.exclude && config.exclude.test(`${tags.name ?? ''} | ${tags.ref ?? ''}`)) return false;
    if (config.keep && !config.keep(tags)) return false;
    return true;
  });

  // each route's stops, in order, with a name and a place
  const trips = [];
  for (const route of routes) {
    const members = (roles) =>
      route.members
        .filter((member) => roles.test(member.role ?? ''))
        .map((member) => (member.type === 'node' ? nodes.get(member.ref) : member.type === 'way' ? ways.get(member.ref) : null))
        .filter((element) => element && nameOf(element));
    let stops = members(/^(stop|stop_entry_only|stop_exit_only)$/);
    if (stops.length < 2) stops = members(/^(platform|platform_entry_only|platform_exit_only)$/);
    const points = stops
      .map((element) => ({
        name: tidy(nameOf(element)),
        local: element.tags?.name ?? '',
        lat: element.lat ?? element.center?.lat,
        lon: element.lon ?? element.center?.lon,
      }))
      .filter((stop) => stop.name && Number.isFinite(stop.lat) && Number.isFinite(stop.lon));
    if (points.length >= 2) trips.push({ route, master: masterOf.get(route.id), points });
  }
  return trips;
};

// ---- stations ------------------------------------------------------------------------

const gather = (trips, config) => {
  const reach = config.merge ?? 0.7;
  const clusters = [];
  const byName = new Map();
  for (const trip of trips) {
    for (const point of trip.points) {
      const key = normalise(point.name);
      const family = byName.get(key) ?? [];
      let cluster = family.find((item) => kilometres(item, point) < reach);
      if (!cluster) {
        cluster = { key, lat: point.lat, lon: point.lon, count: 0, names: new Map(), locals: new Set() };
        family.push(cluster);
        byName.set(key, family);
        clusters.push(cluster);
      }
      cluster.lat = (cluster.lat * cluster.count + point.lat) / (cluster.count + 1);
      cluster.lon = (cluster.lon * cluster.count + point.lon) / (cluster.count + 1);
      cluster.count += 1;
      cluster.names.set(point.name, (cluster.names.get(point.name) ?? 0) + 1);
      if (point.local && point.local !== point.name) cluster.locals.add(point.local);
      point.cluster = cluster;
    }
  }
  const used = new Set();
  for (const cluster of clusters) {
    cluster.name = [...cluster.names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    let id = slug(cluster.name) || `station-${clusters.indexOf(cluster) + 1}`;
    if (/^\d/.test(id)) id = `s-${id}`;
    let unique = id;
    for (let n = 2; used.has(unique); n += 1) unique = `${id}-${n}`;
    used.add(unique);
    cluster.id = unique;
  }
  return clusters;
};

// ---- lines ---------------------------------------------------------------------------

const hex = (value) => {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) return `#${[...text.slice(1)].map((c) => c + c).join('')}`;
  if (/^[0-9a-f]{6}$/.test(text)) return `#${text}`;
  return NAMED_COLOURS[text] ?? null;
};
const inkOn = (colour) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? '#1a1a1a' : '#ffffff';
};

const contains = (big, small) => {
  for (const run of [small, small.slice().reverse()]) {
    for (let start = big.indexOf(run[0]); start >= 0; start = big.indexOf(run[0], start + 1)) {
      if (run.every((id, k) => big[start + k] === id)) return true;
    }
  }
  return false;
};

const sequencesOf = (points) => {
  const ids = [];
  for (const point of points) if (ids[ids.length - 1] !== point.cluster.id) ids.push(point.cluster.id);
  // a circle line comes back to its first station; any other repeat starts a new run
  const runs = [];
  let run = [];
  ids.forEach((id, at) => {
    const closing = at === ids.length - 1 && id === run[0] && run.length > 2;
    if (run.includes(id) && !closing) {
      if (run.length > 1) runs.push(run);
      run = [run[run.length - 1], id];
      return;
    }
    run.push(id);
  });
  if (run.length > 1) runs.push(run);
  return runs;
};

const lineUp = (trips, config) => {
  const groups = new Map();
  for (const trip of trips) {
    const tags = trip.master?.tags ?? trip.route.tags;
    const ref = String(trip.master?.tags?.ref ?? trip.route.tags.ref ?? '').trim();
    const key = trip.master ? `m${trip.master.id}` : ref || String(trip.route.tags.name ?? trip.route.id);
    if (!groups.has(key)) {
      const named = (source) => (config.names ?? ['name']).map((tag) => source?.[tag]).find(Boolean);
      const rawName = String(named(tags) ?? named(trip.route.tags) ?? tags.name ?? trip.route.tags.name ?? ref)
        .replace(/\s*[:：].*$/, '')
        .replace(/\s*(=>|→|->|–>).*$/, '')
        .trim();
      groups.set(key, {
        ref,
        name: config.lineName ? config.lineName(ref, rawName, tags) : rawName || ref,
        colour: hex(tags.colour) ?? hex(trip.route.tags.colour),
        sequences: [],
      });
    }
    groups.get(key).sequences.push(...sequencesOf(trip.points));
  }

  const lines = [];
  let spare = 0;
  for (const group of groups.values()) {
    const sorted = group.sequences.sort((a, b) => b.length - a.length);
    const branches = [];
    for (const sequence of sorted) if (!branches.some((kept) => contains(kept, sequence))) branches.push(sequence);
    if (!branches.length) continue;
    const colour = group.colour ?? PALETTE[spare++ % PALETTE.length];
    lines.push({ ...group, colour, text: inkOn(colour), branches });
  }
  const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
  lines.sort((a, b) => natural(a.ref || a.name, b.ref || b.name));
  const ids = new Set();
  for (const line of lines) {
    let id = slug(line.ref || line.name) || 'line';
    for (let n = 2; ids.has(id); n += 1) id = `${slug(line.ref || line.name)}-${n}`;
    ids.add(id);
    line.id = id;
  }
  return lines;
};

// ---- the layout ----------------------------------------------------------------------

// A circle line drawn the way a city's own diagram draws it: its stations spaced
// around an octagon, stretched wide, and every other station placed by how far
// inside or outside the real ring it lies in its direction. The centre opens up
// to fill the ring and the long lines beyond it are drawn in.
const ringOut = (stations, lines, config, step) => {
  const line = lines.find((entry) => entry.ref === config.ring);
  if (!line) throw new Error(`there is no ${config.ring} line to draw as a ring`);
  const byId = new Map(stations.map((station) => [station.id, station]));
  const loop = [...line.branches].sort((a, b) => b.length - a.length)[0].map((id) => byId.get(id));
  if (loop[0] === loop[loop.length - 1]) loop.pop();
  const cx = loop.reduce((sum, station) => sum + station.gx, 0) / loop.length;
  const cy = loop.reduce((sum, station) => sum + station.gy, 0) / loop.length;
  const polar = (station) => [Math.atan2(station.gy - cy, station.gx - cx), Math.hypot(station.gx - cx, station.gy - cy)];

  // the real ring's distance from the centre in every direction
  const around = loop.map(polar).sort((a, b) => a[0] - b[0]);
  const reach = (angle) => {
    for (let at = 0; at < around.length; at += 1) {
      const [a1, r1] = around[at];
      const [a2, r2] = at + 1 < around.length ? around[at + 1] : [around[0][0] + Math.PI * 2, around[0][1]];
      let probe = angle;
      if (probe < a1) probe += Math.PI * 2;
      if (probe >= a1 && probe <= a2) return r1 + ((r2 - r1) * (probe - a1)) / (a2 - a1 || 1);
    }
    return around[0][1];
  };

  // the drawn ring: an octagon with its flat sides square to the page
  const stretch = config.ringStretch ?? 1.3;
  // big enough to go round its own stations, and to give the stations inside it room
  const within = stations.filter((station) => {
    const [angle, distance] = polar(station);
    return distance < reach(angle) * 0.98;
  }).length;
  const each = config.ringRoom ?? step * 1.7;
  const radius = Math.max((loop.length * step) / (Math.PI * (1 + stretch)), Math.sqrt((within * each * each) / (Math.PI * stretch)));
  const octagon = (angle) => {
    const wedge = Math.PI / 4;
    const turn = ((angle % wedge) + wedge) % wedge;
    return (radius * Math.cos(Math.PI / 8)) / Math.cos(turn - Math.PI / 8);
  };
  const place = (angle, share) => {
    const r = octagon(angle) * share;
    return [Math.cos(angle) * r * stretch, Math.sin(angle) * r];
  };
  const inside = config.ringInside ?? 0.85;
  const outside = config.ringOutside ?? 1.1;
  for (const station of stations) {
    const [angle, distance] = polar(station);
    const ratio = distance / (reach(angle) || 1);
    const share = ratio <= 1 ? ratio ** inside : 1 + outside * Math.log(ratio);
    const [x, y] = place(angle, share);
    station.x = station.ax = x;
    station.y = station.ay = y;
  }
  // ring stations evenly spaced along the drawn ring, in their own order
  const start = polar(loop[0])[0];
  const sense = Math.sign(polar(loop[1 % loop.length])[0] - start) || 1;
  loop.forEach((station, at) => {
    const [x, y] = place(start + sense * ((Math.PI * 2 * at) / loop.length), 1);
    station.x = station.ax = x;
    station.y = station.ay = y;
  });
  return new Set(loop);
};

const lay = (stations, lines, config) => {
  const byId = new Map(stations.map((station) => [station.id, station]));
  const edges = new Map();
  for (const line of lines) {
    for (const branch of line.branches) {
      for (let at = 1; at < branch.length; at += 1) {
        const [a, b] = [branch[at - 1], branch[at]].sort();
        edges.set(`${a} ${b}`, [byId.get(a), byId.get(b)]);
      }
    }
  }
  const pairs = [...edges.values()];
  const lat0 = stations.reduce((sum, s) => sum + s.lat, 0) / stations.length;
  const lon0 = stations.reduce((sum, s) => sum + s.lon, 0) / stations.length;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  for (const station of stations) {
    station.gx = (station.lon - lon0) * kx;
    station.gy = -(station.lat - lat0) * 110.57;
  }
  // a fisheye opens up a crowded centre and draws the long outer lines in
  if (config.fisheye) {
    const reach = stations.map((station) => Math.hypot(station.gx, station.gy)).sort((x, y) => x - y);
    const typical = reach[Math.floor(reach.length / 2)] || 1;
    for (const station of stations) {
      const distance = Math.hypot(station.gx, station.gy);
      if (!distance) continue;
      const bent = typical * (distance / typical) ** config.fisheye;
      station.gx *= bent / distance;
      station.gy *= bent / distance;
    }
  }
  const step = config.spacing ?? 2;
  const room = config.room ?? 1.7;
  const rounds = config.rounds ?? 900;
  const lengths = pairs.map(([a, b]) => Math.hypot(a.gx - b.gx, a.gy - b.gy)).sort((x, y) => x - y);
  const median = lengths[Math.floor(lengths.length / 2)] || 1;
  const scale = step / median;
  for (const station of stations) {
    station.x = station.ax = station.gx * scale;
    station.y = station.ay = station.gy * scale;
  }
  const pinned = config.ring ? ringOut(stations, lines, config, step) : new Set();

  const eighth = Math.PI / 4;
  for (let round = 0; round < rounds; round += 1) {
    const t = round / rounds;
    const snap = Math.min(1, t * 1.6);
    // every hop pulled towards one length and one of eight directions
    for (const [a, b] of pairs) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const angle = Math.atan2(dy, dx);
      const aim = angle + (Math.round(angle / eighth) * eighth - angle) * snap;
      const fx = (Math.cos(aim) * step - dx) * 0.22;
      const fy = (Math.sin(aim) * step - dy) * 0.22;
      a.x -= fx;
      a.y -= fy;
      b.x += fx;
      b.y += fy;
    }
    // stations kept apart
    const grid = new Map();
    const cell = (x, y) => `${Math.floor(x / room)},${Math.floor(y / room)}`;
    for (const station of stations) {
      const key = cell(station.x, station.y);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(station);
    }
    for (const station of stations) {
      const cx = Math.floor(station.x / room);
      const cy = Math.floor(station.y / room);
      for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
        for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
          for (const other of grid.get(`${gx},${gy}`) ?? []) {
            if (other === station) continue;
            let dx = station.x - other.x;
            let dy = station.y - other.y;
            let apart = Math.hypot(dx, dy);
            if (apart >= room) continue;
            if (apart < 1e-6) {
              dx = Math.random() - 0.5;
              dy = Math.random() - 0.5;
              apart = Math.hypot(dx, dy);
            }
            const push = ((room - apart) / apart) * 0.25;
            station.x += dx * push;
            station.y += dy * push;
          }
        }
      }
    }
    // and held to where they really are, less and less as the shape settles;
    // stations on a drawn ring stay on it
    const hold = 0.04 * (1 - t) ** 2 + 0.002;
    for (const station of stations) {
      const grip = pinned.has(station) ? 0.6 : hold;
      station.x += (station.ax - station.x) * grip;
      station.y += (station.ay - station.y) * grip;
    }
  }

  // onto half squares, with no two stations on one point
  const taken = new Set();
  const minX = Math.min(...stations.map((s) => s.x));
  const minY = Math.min(...stations.map((s) => s.y));
  for (const station of stations) {
    let x = Math.round((station.x - minX) * 2) / 2;
    let y = Math.round((station.y - minY) * 2) / 2;
    for (let ring = 0; taken.has(`${x},${y}`); ring += 1) {
      const turn = (ring * Math.PI) / 4;
      x = Math.round((station.x - minX + Math.cos(turn) * 0.5 * (1 + (ring >> 8))) * 2) / 2;
      y = Math.round((station.y - minY + Math.sin(turn) * 0.5 * (1 + (ring >> 8))) * 2) / 2;
    }
    taken.add(`${x},${y}`);
    station.x = x;
    station.y = y;
  }
};

// ---- writing it down -------------------------------------------------------------

const quote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const key = (text) => (/^[a-z_$][a-z0-9_$]*$/i.test(text) ? text : quote(text));

const write = async (id, config) => {
  const data = await download(id, config);
  const trips = read(id, config, data);
  if (!trips.length) throw new Error(`no ${config.routes.join('/')} routes found`);
  const clusters = gather(trips, config);
  const lines = lineUp(trips, config);
  const used = new Set(lines.flatMap((line) => line.branches.flat()));
  const stations = clusters.filter((cluster) => used.has(cluster.id));
  lay(stations, lines, config);

  // minutes between neighbours from how far apart they really are
  const byId = new Map(stations.map((station) => [station.id, station]));
  const perKm = config.minutesPerKm ?? 1.9;
  const times = {};
  for (const line of lines) {
    const hops = [];
    for (const branch of line.branches) {
      for (let at = 1; at < branch.length; at += 1) {
        const minutes = Math.max(1, Math.round(kilometres(byId.get(branch[at - 1]), byId.get(branch[at])) * perKm + 0.4));
        hops.push([branch[at - 1], branch[at], minutes]);
      }
    }
    const counts = new Map();
    for (const [, , minutes] of hops) counts.set(minutes, (counts.get(minutes) ?? 0) + 1);
    line.minutes = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 2;
    for (const [a, b, minutes] of hops) if (minutes !== line.minutes) times[`${a} ${b}`] = minutes;
  }

  const byName = new Map(stations.map((station) => [normalise(station.name), station.id]));
  const walks = (config.walks ?? []).map(([a, b, minutes]) => {
    const [from, to] = [byName.get(normalise(a)), byName.get(normalise(b))];
    if (!from || !to) throw new Error(`a walk names ${a} and ${b}, which are not both stations here`);
    return [from, to, minutes ?? 3];
  });

  const today = new Date().toISOString().slice(0, 10);
  const text = `// ${config.city}'s ${config.system}, from OpenStreetMap (© OpenStreetMap contributors,
// available under the Open Database Licence) on ${today}.
//
// Stations are laid out by scripts/metro-import.mjs from where they really are,
// with the spacing evened out, so the map keeps the city's shape without its
// distances. Travel times are estimated from those distances.
export default {
  id: ${quote(id)},
  name: ${quote(config.city)},
  system: ${quote(config.system)},
  country: ${quote(config.country)},
  change: ${config.change ?? 4},
  credit: '© OpenStreetMap contributors',
  lines: [
${lines
  .map(
    (line) => `    {
      id: ${quote(line.id)},
      short: ${quote(config.badges === false ? '' : config.short?.(line.ref, line.name) ?? (line.ref.length <= 4 ? line.ref : line.ref.slice(0, 1).toUpperCase()))},
      name: ${quote(line.name)},
      colour: ${quote(line.colour)},
      text: ${quote(line.text)},
      minutes: ${line.minutes},
      branches: [
${line.branches.map((branch) => `        [${branch.map(quote).join(', ')}],`).join('\n')}
      ],
    },`,
  )
  .join('\n')}
  ],
  times: {
${Object.entries(times).map(([pair, minutes]) => `    ${quote(pair)}: ${minutes},`).join('\n')}
  },${walks.length ? `
  walks: [
${walks.map(([a, b, minutes]) => `    [${quote(a)}, ${quote(b)}, ${minutes}],`).join('\n')}
  ],` : ''}
  stations: {
${stations
  .map((station) => {
    const aka = [...station.locals].filter((name) => name !== station.name);
    return `    ${key(station.id)}: { name: ${quote(station.name)}, x: ${station.x}, y: ${station.y}${aka.length ? `, aka: [${aka.map(quote).join(', ')}]` : ''} },`;
  })
  .join('\n')}
  },
};
`;
  await writeFile(`${MAPS}/${id}.js`, text);

  const network = buildNetwork((await import(`../${MAPS}/${id}.js?at=${Date.now()}`)).default);
  const labels = placeLabels(network);
  const ids = [...network.stations.keys()];
  let unreachable = 0;
  for (let n = 0; n < 40; n += 1) {
    const a = ids[Math.floor(Math.random() * ids.length)];
    const b = ids[Math.floor(Math.random() * ids.length)];
    if (!planRoute(network, a, b)) unreachable += 1;
  }
  console.log(
    `${id}: ${network.lines.length} lines (${network.lines.map((line) => `${line.short || line.name}:${new Set(line.branches.flat()).size}${line.branches.length > 1 ? `/${line.branches.length}` : ''}`).join(' ')}), ` +
      `${network.stations.size} stations, ${network.problems.length} problems, ${labelClashes(labels)} name clashes, ${unreachable}/40 random pairs unreachable`,
  );
  for (const problem of network.problems.slice(0, 5)) console.log(`  - ${problem}`);
  // a network in pieces usually means one station went by two names
  const pieces = [];
  const seen = new Set();
  for (const start of network.stations.keys()) {
    if (seen.has(start)) continue;
    const piece = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const id = queue.pop();
      piece.push(id);
      for (const line of network.lines) {
        for (const branch of line.branches) {
          branch.forEach((stop, at) => {
            if (stop !== id) return;
            for (const next of [branch[at - 1], branch[at + 1]]) {
              if (next && !seen.has(next)) {
                seen.add(next);
                queue.push(next);
              }
            }
          });
        }
      }
    }
    pieces.push(piece);
  }
  if (pieces.length > 1) {
    console.log(`  in ${pieces.length} pieces:`);
    for (const piece of pieces) console.log(`    ${piece.length} stations: ${piece.slice(0, 6).map((sid) => network.stations.get(sid).name).join(', ')}`);
  }
};

const register = async () => {
  const registry = `${MAPS}/index.js`;
  const source = await readFile(registry, 'utf8');
  const entries = [...source.matchAll(/\{ id: '([^']+)'[^\n]*\}/g)].map((match) => ({ id: match[1], line: match[0] }));
  const known = new Map(entries.map((entry) => [entry.id, entry.line]));
  for (const id of wanted) {
    const config = CITIES[id];
    if (!existsSync(`${MAPS}/${id}.js`)) continue;
    known.set(id, `{ id: ${quote(id)}, city: ${quote(config.city)}, system: ${quote(config.system)}, country: ${quote(config.country)}, flag: ${quote(config.flag ?? '')}, load: () => import('./${id}.js') }`);
  }
  const lines = [...known.values()];
  const head = source.slice(0, source.indexOf('export default ['));
  await writeFile(registry, `${head}export default [\n${lines.map((line) => `  ${line},`).join('\n')}\n];\n`);
};

for (const id of wanted) {
  const config = CITIES[id];
  if (!config) {
    console.error(`${id}: not in scripts/metro-cities.mjs`);
    process.exitCode = 1;
    continue;
  }
  try {
    await write(id, config);
  } catch (error) {
    console.error(`${id}: ${error.message}`);
    process.exitCode = 1;
  }
}
await register();
