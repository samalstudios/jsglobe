// Correctness suites for the libraries whose output can be checked against
// something outside this codebase: published perft counts, the laws of optics,
// and polygon areas that can be worked out by hand.
import { parseFen, perft, START_FEN } from '../js/lib/chess.js';
import {
  traceRay, refract, criticalAngle, glassBlock, prism, planeMirror, curvedMirror,
  idealLens, beamRays, indexAt, minimumDeviation, thinLensImage, glassSphere,
  sphericalLens, concaveLens,
} from '../js/lib/optics.js';
import { clipPolygons, polygonArea } from '../js/lib/clip.js';
import { encodeQr } from '../js/lib/qr.js';
import { COUNTRIES as TAX_COUNTRIES } from '../js/lib/tax-countries.js';
import { rates as taxRates, progressive as taxBands } from '../js/lib/tax.js';
import { decodeQrMatrix, scanQrImage, correctBlock } from '../js/lib/qr-decode.js';
import {
  encodeCode128, encodeEan13, encodeEan8, encodeCode39, decodeBarcodeRuns, eanCheckDigit,
} from '../js/lib/barcode.js';

let pass = 0;
const failures = [];

const ok = (name, condition, detail = '') => {
  if (condition) pass += 1;
  else failures.push(`${name}${detail ? `  ${detail}` : ''}`);
};
const close = (name, got, want, tol = 1e-6) =>
  ok(name, Math.abs(got - want) < tol, `got ${got}, want ${want}`);

const deg = (radians) => (radians * 180) / Math.PI;
const rad = (degrees) => (degrees * Math.PI) / 180;

// ---- chess: published perft counts -----------------------------------
{
  const suites = [
    ['start', START_FEN, [20, 400, 8902, 197281]],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
    ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
    ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
    ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ];
  for (const [name, fen, counts] of suites) {
    const state = parseFen(fen);
    counts.forEach((want, index) => {
      ok(`chess perft ${name} depth ${index + 1}`, perft(state, index + 1) === want);
    });
  }
}

// ---- optics: the laws themselves -------------------------------------
{
  const inAngle = rad(45);
  const out = refract({ x: Math.sin(inAngle), y: Math.cos(inAngle) }, { x: 0, y: -1 }, 1, 1.5);
  close('optics Snell at 45 degrees', deg(Math.atan2(out.x, out.y)), deg(Math.asin(Math.sin(inAngle) / 1.5)));

  close('optics critical angle', deg(criticalAngle(1.5, 1)), deg(Math.asin(1 / 1.5)), 1e-9);
  const critical = criticalAngle(1.5, 1);
  const at = (angle) => ({ x: Math.sin(angle), y: Math.cos(angle) });
  ok('optics refracts below the critical angle', refract(at(critical - rad(0.5)), { x: 0, y: -1 }, 1.5, 1) !== null);
  ok('optics reflects past the critical angle', refract(at(critical + rad(0.5)), { x: 0, y: -1 }, 1.5, 1) === null);

  const mirror = planeMirror(0, 0, 400, 0);
  const bounce = traceRay({ surfaces: mirror }, { origin: { x: -100, y: -100 }, direction: { x: Math.cos(rad(45)), y: Math.sin(rad(45)) } }, { bounces: 3 });
  const leg = { x: bounce.path[2].x - bounce.path[1].x, y: bounce.path[2].y - bounce.path[1].y };
  const mirrorFace = (surfaces, origin, direction) =>
    traceRay({ surfaces }, { origin, direction }, { bounces: 4, reach: 400 }).events.map((event) => event.kind).join(',');
  ok('optics a flat mirror reflects off its face', mirrorFace(planeMirror(0, 0, 200, -Math.PI / 2), { x: -100, y: 0 }, { x: 1, y: 0 }) === 'reflect');
  ok('optics a flat mirror does not reflect off its back', mirrorFace(planeMirror(0, 0, 200, -Math.PI / 2), { x: 100, y: 0 }, { x: -1, y: 0 }) === 'block');
  ok('optics a concave mirror reflects off its hollow', mirrorFace(curvedMirror(0, 0, 300, 1, Math.PI, true), { x: -200, y: 0 }, { x: 1, y: 0 }) === 'reflect');
  ok('optics a concave mirror does not reflect off its back', mirrorFace(curvedMirror(0, 0, 300, 1, Math.PI, true), { x: 200, y: 0 }, { x: -1, y: 0 }) === 'block');
  ok('optics a convex mirror reflects off its bulge', mirrorFace(curvedMirror(0, 0, 300, 1, 0, false), { x: 200, y: 0 }, { x: -1, y: 0 }) === 'reflect');
  ok('optics a convex mirror does not reflect off its back', mirrorFace(curvedMirror(0, 0, 300, 1, 0, false), { x: -200, y: 0 }, { x: 1, y: 0 }) === 'block');

  close('optics mirror reflects at the same angle', Math.abs(deg(Math.atan2(-leg.y, leg.x))), 45);

  const radius = 200;
  const dish = curvedMirror(0, 0, radius, rad(50), Math.PI, true);
  const axisCross = [];
  for (const ray of beamRays(-300, 0, 40, 0, 5)) {
    const { path } = traceRay({ surfaces: dish }, ray, { bounces: 3, reach: 2000 });
    if (path.length < 3) continue;
    const [, a, b] = path;
    if (Math.abs(b.y - a.y) < 1e-6) continue;
    const t = (0 - a.y) / (b.y - a.y);
    if (Number.isFinite(t)) axisCross.push(a.x + (b.x - a.x) * t);
  }
  close('optics concave mirror focuses at R/2', Math.abs(axisCross.reduce((s, v) => s + v, 0) / axisCross.length), radius / 2, 3);

  const focal = 150;
  const lens = idealLens(0, 0, 300, focal, 0);
  const lensCross = [];
  for (const ray of beamRays(-400, 0, 120, 0, 7)) {
    const { path } = traceRay({ surfaces: lens }, ray, { bounces: 3, reach: 3000 });
    if (path.length < 3) continue;
    const [, a, b] = path;
    const t = (0 - a.y) / (b.y - a.y);
    if (Number.isFinite(t) && t > 0) lensCross.push(a.x + (b.x - a.x) * t);
  }
  close('optics lens focuses at its focal length', lensCross[0], focal);
  close('optics every ray meets at one point', Math.max(...lensCross) - Math.min(...lensCross), 0);

  close('optics minimum deviation', deg(minimumDeviation(1.52, rad(60))), deg(2 * Math.asin(1.52 * Math.sin(rad(30))) - rad(60)), 1e-9);

  ok('optics blue refracts more than red', indexAt(450) > indexAt(660), `${indexAt(660).toFixed(4)} vs ${indexAt(450).toFixed(4)}`);

  // A prism entered through one slanted face and left through the other must
  // send red and blue off at measurably different angles.
  const wedge = prism(0, 0, 120, 0, { index: 1.52 });
  const exitAngle = (wavelength) => {
    const { path, events } = traceRay(
      { surfaces: wedge },
      { origin: { x: -320, y: 80 }, direction: { x: Math.cos(rad(-30)), y: Math.sin(rad(-30)) } },
      { bounces: 10, wavelength },
    );
    if (events.map((event) => event.kind).join(',') !== 'refract,refract') return null;
    const a = path[path.length - 2];
    const b = path[path.length - 1];
    return deg(Math.atan2(b.y - a.y, b.x - a.x));
  };
  const red = exitAngle(660);
  const blue = exitAngle(450);
  ok('optics prism takes light in one face and out the other', red !== null && blue !== null);
  ok('optics prism splits red from blue', red !== null && blue !== null && Math.abs(blue - red) > 0.3, `${red !== null && blue !== null ? Math.abs(blue - red).toFixed(3) : '?'} degrees apart`);

  const slab = glassBlock(0, 0, 100, 300, 0, { index: 1.5 });
  const through = traceRay({ surfaces: slab }, { origin: { x: -200, y: -60 }, direction: { x: Math.cos(rad(20)), y: Math.sin(rad(20)) } }, { bounces: 8 });
  const last = { x: through.path.at(-1).x - through.path.at(-2).x, y: through.path.at(-1).y - through.path.at(-2).y };
  close('optics a slab shifts a ray without turning it', deg(Math.atan2(last.y, last.x)), 20);

  const spread = (surfaces, height) => {
    const [ray] = beamRays(-300, 0, height * 2, 0, 1).length ? [{ origin: { x: -300, y: height }, direction: { x: 1, y: 0 } }] : [];
    const { path, events } = traceRay({ surfaces }, ray, { bounces: 12, reach: 600 });
    const a = path.at(-2);
    const b = path.at(-1);
    return { angle: deg(Math.atan2(b.y - a.y, b.x - a.x)), events };
  };

  const convex = spread(sphericalLens(0, 0, 150, 0.0035, 0.0035, 0, { index: 1.52 }), -50);
  const concave = spread(concaveLens(0, 0, 150, 0.0035, 0, { index: 1.52 }), -50);
  ok('optics a convex lens bends a ray towards the axis', convex.angle > 1, `${convex.angle.toFixed(2)} degrees`);
  ok('optics a concave lens bends a ray away from the axis', concave.angle < -1, `${concave.angle.toFixed(2)} degrees`);
  ok('optics a concave lens is entered before it is left', concave.events[0]?.fromIndex === 1 && concave.events[0]?.toIndex > 1, `${concave.events[0]?.fromIndex}->${concave.events[0]?.toIndex}`);

  const ball = glassSphere(0, 0, 100, { index: 1.5 });
  const middle = traceRay({ surfaces: ball }, { origin: { x: -300, y: 0 }, direction: { x: 1, y: 0 } }, { bounces: 8 });
  const straight = { x: middle.path.at(-1).x - middle.path.at(-2).x, y: middle.path.at(-1).y - middle.path.at(-2).y };
  close('optics a ray through the centre of a sphere is not bent', deg(Math.atan2(straight.y, straight.x)), 0, 1e-9);

  const offset = traceRay({ surfaces: ball }, { origin: { x: -300, y: 40 }, direction: { x: 1, y: 0 } }, { bounces: 8 });
  const bent = { x: offset.path.at(-1).x - offset.path.at(-2).x, y: offset.path.at(-1).y - offset.path.at(-2).y };
  ok('optics a sphere bends a ray that misses the centre', Math.abs(deg(Math.atan2(bent.y, bent.x))) > 1, `${deg(Math.atan2(bent.y, bent.x)).toFixed(2)} degrees`);
  ok('optics a sphere refracts in and out', offset.events.filter((event) => event.kind === 'refract').length === 2, offset.events.map((event) => event.kind).join(','));

  const image = thinLensImage(100, 200);
  close('optics an object at 2f images at 2f', image.distance, 200, 1e-9);
  close('optics and is inverted at the same size', image.magnification, -1, 1e-9);
}

// ---- clip: areas that can be worked out by hand ----------------------
{
  const box = (cx, cy, w = 2, h = 2) => [
    { x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 }, { x: cx - w / 2, y: cy + h / 2 },
  ];
  const area = (rings) => (rings ?? []).reduce((total, ring) => total + Math.abs(polygonArea(ring)), 0);

  close('clip union of two squares', area(clipPolygons(box(0, 0), box(1.5, 0), 'union')), 7);
  close('clip intersection', area(clipPolygons(box(0, 0), box(1.5, 0), 'intersect')), 1);
  close('clip subtraction', area(clipPolygons(box(0, 0), box(1.5, 0), 'subtract')), 3);
  ok('clip reports no overlap as nothing', clipPolygons(box(0, 0), box(9, 0), 'union') === null);

  // folding three in a row must give the full span, not two of them
  let kept = [box(0, 0)];
  for (const cut of [box(1.5, 0), box(3, 0)]) {
    const next = [];
    for (const ring of kept) next.push(...(clipPolygons(ring, cut, 'union') ?? [ring]));
    kept = next;
  }
  close('clip folds three squares into one', area(kept), 10);

  const spread = clipPolygons(box(0, 0), box(1.5, 0), 'union')[0];
  ok('clip keeps vertices exact', spread.every((point) => Number.isInteger(point.x * 2) && Number.isInteger(point.y * 2)));
}

// ---- qr: read the code back the way a scanner does ------------------
{
  const ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  };
  const BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  };
  const ECL_OF = { 1: 'L', 0: 'M', 3: 'Q', 2: 'H' };

  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  let seed = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = seed;
    LOG[seed] = i;
    seed <<= 1;
    if (seed & 0x100) seed ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
  const times = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  const rawModules = (version) => {
    let total = (16 * version + 128) * version + 64;
    if (version >= 2) {
      const count = Math.floor(version / 7) + 2;
      total -= (25 * count - 10) * count - 55;
      if (version >= 7) total -= 36;
    }
    return total;
  };
  const dataWords = (version, ecl) => Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[ecl][version] * BLOCKS[ecl][version];

  const alignAt = (version) => {
    if (version === 1) return [];
    const count = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    const spots = [6];
    for (let at = version * 4 + 10; spots.length < count; at -= step) spots.splice(1, 0, at);
    return spots;
  };

  const functionMap = (version) => {
    const size = version * 4 + 17;
    const map = Array.from({ length: size }, () => new Array(size).fill(false));
    const fill = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y += 1) {
        for (let x = x0; x < x0 + w; x += 1) if (x >= 0 && y >= 0 && x < size && y < size) map[y][x] = true;
      }
    };
    fill(0, 0, 8, 8);
    fill(size - 8, 0, 8, 8);
    fill(0, size - 8, 8, 8);
    for (let i = 0; i < size; i += 1) {
      map[6][i] = true;
      map[i][6] = true;
    }
    const spots = alignAt(version);
    for (const cy of spots) {
      for (const cx of spots) {
        if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
        fill(cx - 2, cy - 2, 5, 5);
      }
    }
    for (let i = 0; i < 9; i += 1) {
      map[8][i] = true;
      map[i][8] = true;
    }
    for (let i = 0; i < 8; i += 1) {
      map[8][size - 1 - i] = true;
      map[size - 1 - i][8] = true;
    }
    if (version >= 7) {
      for (let i = 0; i < 18; i += 1) {
        const a = Math.floor(i / 3);
        const b = size - 11 + (i % 3);
        map[b][a] = true;
        map[a][b] = true;
      }
    }
    return map;
  };

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  const readFormat = (modules) => {
    const bits = [];
    for (let i = 0; i < 6; i += 1) bits.push(modules[i][8] ? 1 : 0);
    bits.push(modules[7][8] ? 1 : 0);
    bits.push(modules[8][8] ? 1 : 0);
    bits.push(modules[8][7] ? 1 : 0);
    for (let i = 9; i < 15; i += 1) bits.push(modules[8][14 - i] ? 1 : 0);
    let value = 0;
    bits.forEach((bit, index) => {
      value |= bit << index;
    });
    value ^= 0x5412;
    let best = null;
    for (let candidate = 0; candidate < 32; candidate += 1) {
      let rest = candidate;
      for (let i = 0; i < 10; i += 1) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
      const full = (candidate << 10) | rest;
      let apart = 0;
      let diff = full ^ value;
      while (diff) {
        apart += diff & 1;
        diff >>>= 1;
      }
      if (!best || apart < best.apart) best = { apart, candidate };
    }
    return { ecl: ECL_OF[best.candidate >> 3], mask: best.candidate & 7, apart: best.apart };
  };

  const readWords = (modules, version, mask) => {
    const size = version * 4 + 17;
    const map = functionMap(version);
    const bits = [];
    let right = size - 1;
    while (right >= 1) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < size; vertical += 1) {
        for (let offset = 0; offset < 2; offset += 1) {
          const x = right - offset;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vertical : vertical;
          if (map[y][x]) continue;
          let bit = modules[y][x] ? 1 : 0;
          if (MASKS[mask](x, y)) bit ^= 1;
          bits.push(bit);
        }
      }
      right -= 2;
    }
    const words = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      let byte = 0;
      for (let k = 0; k < 8; k += 1) byte = (byte << 1) | bits[i + k];
      words.push(byte);
    }
    return words;
  };

  const syndromesZero = (data, ecc) => {
    const message = [...data, ...ecc];
    for (let i = 0; i < ecc.length; i += 1) {
      let sum = 0;
      for (const byte of message) sum = times(sum, EXP[i]) ^ byte;
      if (sum !== 0) return false;
    }
    return true;
  };

  const readQr = (code) => {
    const format = readFormat(code.modules);
    const words = readWords(code.modules, code.version, format.mask);
    const total = dataWords(code.version, format.ecl);
    const count = BLOCKS[format.ecl][code.version];
    const eccLength = ECC_PER_BLOCK[format.ecl][code.version];
    const short = Math.floor(total / count);
    const longOnes = total % count;
    const lengths = Array.from({ length: count }, (unused, i) => short + (i >= count - longOnes ? 1 : 0));

    const blocks = Array.from({ length: count }, () => []);
    let at = 0;
    for (let i = 0; i < Math.max(...lengths); i += 1) {
      for (let b = 0; b < count; b += 1) {
        if (i < lengths[b]) blocks[b].push(words[at++]);
      }
    }
    const eccs = Array.from({ length: count }, () => []);
    for (let i = 0; i < eccLength; i += 1) {
      for (let b = 0; b < count; b += 1) eccs[b].push(words[at++]);
    }

    const eccOk = blocks.every((block, b) => syndromesZero(block, eccs[b]));

    const stream = blocks.flat();
    const bits = [];
    for (const byte of stream) {
      for (let k = 7; k >= 0; k -= 1) bits.push((byte >>> k) & 1);
    }
    let cursor = 0;
    const take = (length) => {
      let value = 0;
      for (let i = 0; i < length; i += 1) value = (value << 1) | bits[cursor++];
      return value;
    };
    const mode = take(4);
    const length = take(code.version < 10 ? 8 : 16);
    const bytes = [];
    for (let i = 0; i < length; i += 1) bytes.push(take(8));
    const text = new TextDecoder().decode(Uint8Array.from(bytes));
    return { text, eccOk, mode, format };
  };

  const payloads = [
    ['a url', 'https://jsglobe.com'],
    ['a wi-fi join', 'WIFI:T:WPA;S:Home network;P:hunter2;;'],
    ['an email', 'mailto:hans.mustermann@example.com?subject=Hallo'],
    ['an sms', 'SMSTO:+15550100:Running late'],
    ['a location', 'geo:52.520008,13.404954'],
    ['a contact card', 'BEGIN:VCARD\nVERSION:3.0\nFN:Erika Mustermann\nTEL:+15550100\nEND:VCARD'],
    ['an event', 'BEGIN:VEVENT\nSUMMARY:Team standup\nDTSTART:20260901T090000Z\nEND:VEVENT'],
    ['accented text', 'Grüße aus München'],
    ['han characters', '光学实验室'],
    ['one byte', 'a'],
    ['the last byte of version 1', 'a'.repeat(17)],
    ['the first byte of version 2', 'a'.repeat(18)],
    ['an eight bit length', 'a'.repeat(182)],
    ['a sixteen bit length', 'a'.repeat(183)],
    ['a long payload', 'x'.repeat(900)],
  ];

  for (const [label, text] of payloads) {
    for (const ecl of ['L', 'M', 'Q', 'H']) {
      const code = encodeQr(text, ecl);
      const read = readQr(code);
      ok(`qr ${label} survives ${ecl} error correction`, read.eccOk, `version ${code.version}`);
      ok(`qr ${label} reads back at ${ecl}`, read.text === text, `got ${read.text.slice(0, 24)}`);
      ok(`qr ${label} states its level at ${ecl}`, read.format.ecl === ecl && read.format.apart === 0);
      ok(`qr ${label} states its mask at ${ecl}`, read.format.mask === code.mask);
    }
  }

  const one = encodeQr('https://jsglobe.com', 'M');
  const corner = (cx, cy) => {
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        if (one.modules[cy + dy][cx + dx] !== (ring !== 2)) return false;
      }
    }
    return true;
  };
  ok('qr draws the three finder patterns', corner(3, 3) && corner(one.size - 4, 3) && corner(3, one.size - 4));
  ok('qr draws the timing patterns', [...Array(one.size - 16)].every((unused, i) => one.modules[6][i + 8] === (i % 2 === 0) && one.modules[i + 8][6] === (i % 2 === 0)));
  ok('qr sets the dark module', one.modules[one.size - 8][8] === true);
}

// ---- reading codes back out of a picture -----------------------------
{
  const seedFrom = (start) => {
    let value = start;
    return () => {
      value = (value * 1103515245 + 12345) & 0x7fffffff;
      return value / 0x7fffffff;
    };
  };

  for (const [text, level] of [
    ['https://jsglobe.com/apps/scanner', 'M'],
    ['Grüße aus München, Erika Mustermann', 'Q'],
    ['光学实验室 と 日本語', 'H'],
    ['WIFI:T:WPA;S:Home network;P:hunter2;;', 'L'],
    ['0123456789', 'M'],
    ['x'.repeat(700), 'L'],
  ]) {
    const code = encodeQr(text, level);
    const read = decodeQrMatrix(code.modules);
    ok(`qr reader gets back ${JSON.stringify(text.slice(0, 18))}`, read?.text === text, read ? read.text.slice(0, 20) : 'nothing');
    ok(`qr reader names the level of ${JSON.stringify(text.slice(0, 18))}`, read?.level === level && read?.version === code.version);
  }

  const guarded = encodeQr('https://jsglobe.com/apps/scanner', 'H');
  const roll = seedFrom(20260824);
  let survived = 0;
  let mistaken = 0;
  for (let run = 0; run < 40; run += 1) {
    const copy = guarded.modules.map((row) => [...row]);
    for (let hit = 0; hit < 20; hit += 1) {
      const x = Math.floor(roll() * guarded.size);
      const y = Math.floor(roll() * guarded.size);
      copy[y][x] = !copy[y][x];
    }
    const read = decodeQrMatrix(copy);
    if (read?.text === 'https://jsglobe.com/apps/scanner') survived += 1;
    else if (read) mistaken += 1;
  }
  ok('qr reader repairs a damaged code', survived >= 36, `${survived} of 40 with 20 modules flipped`);
  ok('qr reader never invents a reading', mistaken === 0, `${mistaken} wrong`);

  ok('qr reader reports a clean code as unrepaired', decodeQrMatrix(encodeQr('check', 'M').modules)?.repaired === 0);

  const table = new Uint8Array(512);
  const place = new Uint8Array(256);
  let walk = 1;
  for (let i = 0; i < 255; i += 1) {
    table[i] = walk;
    place[walk] = i;
    walk <<= 1;
    if (walk & 0x100) walk ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) table[i] = table[i - 255];
  const times = (a, b) => (a === 0 || b === 0 ? 0 : table[place[a] + place[b]]);

  const divisorOf = (degree) => {
    let poly = [1];
    for (let i = 0; i < degree; i += 1) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j += 1) {
        next[j] ^= times(poly[j], table[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly.reverse().slice(1);
  };
  const parityOf = (data, degree) => {
    const divisor = divisorOf(degree);
    const rest = new Array(degree).fill(0);
    for (const byte of data) {
      const factor = byte ^ rest.shift();
      rest.push(0);
      divisor.forEach((coefficient, index) => {
        rest[index] ^= times(coefficient, factor);
      });
    }
    return rest;
  };

  const mendable = [64, 84, 132, 84, 196, 196, 240, 236, 17, 236, 17, 236, 17, 236, 17, 236];
  const sound = [...mendable, ...parityOf(mendable, 10)];
  ok('qr reader accepts a sound block untouched', correctBlock(sound, 10)?.fixed === 0);

  for (const breaks of [1, 2, 3, 4, 5]) {
    const nudged = [...sound];
    for (let i = 0; i < breaks; i += 1) nudged[i * 3] ^= 0x5a + i;
    const mended = correctBlock(nudged, 10);
    ok(`qr reader mends ${breaks} broken code word${breaks === 1 ? '' : 's'}`, mended?.data.join() === sound.join(), `${mended ? mended.fixed : 'gave up'}`);
  }

  const wrecked = sound.map((value, index) => (index < 6 ? value ^ 0x7f : value));
  ok('qr reader gives up rather than guess', correctBlock(wrecked, 10) === null);

  const draw = (code, { scale = 6, margin = 4, rotate = 0 } = {}) => {
    const span = (code.size + margin * 2) * scale;
    const width = Math.ceil(span * 1.7);
    const height = width;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    const cos = Math.cos(rotate);
    const sin = Math.sin(rotate);
    for (let py = 0; py < height; py += 1) {
      for (let px = 0; px < width; px += 1) {
        const ux = px - width / 2;
        const uy = py - height / 2;
        const sx = ux * cos + uy * sin + span / 2;
        const sy = -ux * sin + uy * cos + span / 2;
        const mx = Math.floor(sx / scale) - margin;
        const my = Math.floor(sy / scale) - margin;
        const on = mx >= 0 && my >= 0 && mx < code.size && my < code.size ? code.modules[my][mx] : false;
        const at = (py * width + px) * 4;
        const value = on ? 20 : 235;
        data[at] = value;
        data[at + 1] = value;
        data[at + 2] = value;
        data[at + 3] = 255;
      }
    }
    return { data, width, height };
  };

  const photo = encodeQr('https://jsglobe.com/apps/scanner', 'M');
  for (const [label, options] of [
    ['straight on', {}],
    ['small modules', { scale: 3 }],
    ['a quarter turn', { rotate: Math.PI / 2 }],
    ['upside down', { rotate: Math.PI }],
    ['on the diagonal', { rotate: Math.PI / 4 }],
    ['slightly tilted', { rotate: Math.PI / 12 }],
  ]) {
    const read = scanQrImage(draw(photo, options));
    ok(`qr found in a picture ${label}`, read?.text === 'https://jsglobe.com/apps/scanner', read ? 'wrong text' : 'not found');
  }

  const runsOf = (bits) => {
    const runs = [];
    let at = 0;
    while (at < bits.length) {
      let length = 1;
      while (at + length < bits.length && bits[at + length] === bits[at]) length += 1;
      runs.push(length * 4);
      at += length;
    }
    return runs;
  };

  for (const [label, built, want, format] of [
    ['code 128', encodeCode128('TOOLBOX-2026'), 'TOOLBOX-2026', 'Code 128'],
    ['code 128 with a url', encodeCode128('https://jsglobe.com'), 'https://jsglobe.com', 'Code 128'],
    ['ean-13', encodeEan13('4006381333931'), '4006381333931', 'EAN-13'],
    ['upc-a', encodeEan13('0036000291452'), '036000291452', 'UPC-A'],
    ['ean-8', encodeEan8('96385074'), '96385074', 'EAN-8'],
    ['code 39', encodeCode39('PART 42-A'), 'PART 42-A', 'Code 39'],
  ]) {
    const read = decodeBarcodeRuns(runsOf(built.bits), built.bits[0] === '1');
    ok(`bar code reader gets back ${label}`, read?.text === want, read ? read.text : 'nothing');
    ok(`bar code reader names ${label}`, read?.format === format, read ? read.format : 'nothing');
  }

  ok('bar code check digit follows the standard', eanCheckDigit('400638133393') === 1 && eanCheckDigit('003600029145') === 2);
  ok('bar code reader turns down noise', decodeBarcodeRuns([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7], true) === null);
}

// ---- tax: worked by hand from the published bands ---------------------
{
  const country = (id) => TAX_COUNTRIES.find((entry) => entry.id === id);
  const at = (id, input) => {
    const home = country(id);
    const filled = {};
    for (const field of home.fields) filled[field.key] = field.default;
    return taxRates(home, { ...filled, ...input });
  };
  const lineOf = (result, label) => result.lines.find((line) => line.label === label)?.amount ?? 0;

  const ukAtLimit = at('uk', { gross: 50270 });
  close('tax uk basic rate band', lineOf(ukAtLimit, 'Income tax'), 37700 * 0.2, 0.01);
  close('tax uk national insurance to the limit', lineOf(ukAtLimit, 'National Insurance'), 37700 * 0.08, 0.01);
  close('tax uk allowance gone by the top', lineOf(at('uk', { gross: 125140 }), 'Income tax'), 37700 * 0.2 + (125140 - 37700) * 0.4, 0.01);
  ok('tax uk nothing owed at the allowance', at('uk', { gross: 12570 }).taken === 0);
  close('tax uk the sixty two percent trap', at('uk', { gross: 110000 }).marginal, 0.62, 0.005);
  close('tax uk forty seven above the trap', at('uk', { gross: 130000 }).marginal, 0.47, 0.005);
  close('tax uk scotland top rate', at('uk', { gross: 200000, region: 'scotland' }).marginal, 0.5, 0.005);

  const usAt100 = at('us', { gross: 100000 });
  close('tax us federal on a hundred thousand', lineOf(usAt100, 'Federal income tax'),
    11925 * 0.1 + (48475 - 11925) * 0.12 + (85000 - 48475) * 0.22, 0.01);
  close('tax us social security', lineOf(usAt100, 'Social Security'), 6200, 0.01);
  close('tax us medicare', lineOf(usAt100, 'Medicare'), 1450, 0.01);
  close('tax us social security stops at the ceiling', lineOf(at('us', { gross: 400000 }), 'Social Security'), 176100 * 0.062, 0.01);
  ok('tax us joint keeps more than single', at('us', { gross: 120000, status: 'joint' }).net > at('us', { gross: 120000 }).net);

  const deAt55 = at('de', { gross: 55000 });
  const deSocial = deAt55.social;
  const zvE = 55000 - 1230 - 36 - deSocial;
  const z = (zvE - 17443) / 10000;
  close('tax germany follows the official formula', lineOf(deAt55, 'Income tax'), (176.64 * z + 2397) * z + 1015.13, 1);
  ok('tax germany takes contributions off before tax', deSocial > 0 && zvE < 55000 - 1230);
  ok('tax germany class three keeps more than class one', at('de', { gross: 90000, taxClass: 'three' }).net > at('de', { gross: 90000 }).net);
  ok('tax germany class five keeps less than class one', at('de', { gross: 90000, taxClass: 'five' }).net < at('de', { gross: 90000 }).net);
  ok('tax germany class four matches class one', at('de', { gross: 60000, taxClass: 'four' }).net === at('de', { gross: 60000 }).net);
  ok('tax germany church tax costs more', at('de', { gross: 55000, church: 'yes' }).taken > deAt55.taken);
  close('tax germany church tax is nine percent of the tax',
    lineOf(at('de', { gross: 55000, church: 'yes' }), 'Church tax'), lineOf(deAt55, 'Income tax') * 0.09, 1);
  close('tax germany bavaria charges eight percent',
    lineOf(at('de', { gross: 55000, church: 'yes', state: 'by' }), 'Church tax'), lineOf(deAt55, 'Income tax') * 0.08, 1);
  close('tax germany childless pay the care surcharge',
    lineOf(at('de', { gross: 55000 }), 'Care insurance'), 55000 * 0.024, 0.01);
  close('tax germany one child drops the surcharge',
    lineOf(at('de', { gross: 55000, children: 1 }), 'Care insurance'), 55000 * 0.018, 0.01);
  close('tax germany three children lower it further',
    lineOf(at('de', { gross: 55000, children: 3 }), 'Care insurance'), 55000 * 0.013, 0.01);
  close('tax germany saxony charges half a point more',
    lineOf(at('de', { gross: 55000, state: 'sn' }), 'Care insurance'), 55000 * 0.029, 0.01);
  close('tax germany pension stops at the ceiling',
    lineOf(at('de', { gross: 200000 }), 'Pension insurance'), 96600 * 0.093, 0.01);
  close('tax germany health stops at its own ceiling',
    lineOf(at('de', { gross: 200000 }), 'Health insurance'), 66150 * 0.0855, 0.01);

  const frAt45 = at('fr', { gross: 45000 });
  const frBase = 45000 * 0.78 - Math.min(45000 * 0.78 * 0.1, 14171);
  close('tax france taxes pay after contributions', lineOf(frAt45, 'Income tax'),
    taxBands(frBase, [{ upTo: 11497, rate: 0 }, { upTo: 29315, rate: 0.11 }, { upTo: 83823, rate: 0.3 }, { upTo: 180294, rate: 0.41 }, { rate: 0.45 }]), 1);
  ok('tax france children lower the bill', at('fr', { gross: 60000, children: 2 }).taken < at('fr', { gross: 60000 }).taken);

  ok('tax ireland has no cliff at the prsi line',
    at('ie', { gross: 18400 }).net > at('ie', { gross: 18200 }).net - 100,
    `${at('ie', { gross: 18200 }).net} then ${at('ie', { gross: 18400 }).net}`);

  const wide = ['HUF', 'CZK', 'SEK', 'NOK', 'DKK', 'PLN', 'RON'];
  for (const home of TAX_COUNTRIES) {
    const scale = wide.includes(home.currency) ? 40 : 1;
    const filled = {};
    for (const field of home.fields) filled[field.key] = field.default;

    ok(`tax ${home.id} takes nothing from nothing`, taxRates(home, { ...filled, gross: 0 }).taken === 0);

    let last = -Infinity;
    let worst = 0;
    let steepest = 0;
    let adds = true;
    for (let gross = 0; gross <= 260000 * scale; gross += 500 * scale) {
      const result = taxRates(home, { ...filled, gross });
      if (Math.abs(result.gross - (result.net + result.taken)) > 0.05) adds = false;
      if (result.net < last) worst = Math.max(worst, last - result.net);
      last = result.net;
      steepest = Math.max(steepest, result.marginal);
    }
    ok(`tax ${home.id} lines add back to the gross`, adds);
    ok(`tax ${home.id} never pays less for earning more`, worst <= 200 * scale, `worst drop ${worst.toFixed(0)}`);
    ok(`tax ${home.id} keeps the marginal rate believable`, steepest <= 0.85, `${(steepest * 100).toFixed(0)}%`);
  }
}

if (failures.length) {
  console.error(`library check failed with ${failures.length} problem${failures.length === 1 ? '' : 's'}:`);
  failures.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`libraries ok: ${pass} checks across chess move generation, optics, polygon clipping, writing and reading codes, and tax`);
