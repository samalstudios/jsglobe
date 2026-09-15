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
import { createPdf, widthOf as pdfWidth, wrapText as pdfWrap, toWinAnsi } from '../js/lib/pdf.js';
import { layoutDocument, layoutToPdf, baseFor } from '../js/lib/doc-layout.js';
import { blocksToMarkdown, blocksToText, countWords, outlineOf, markdownToHtml } from '../js/lib/richtext.js';
import { COUNTRIES as TAX_COUNTRIES } from '../js/lib/tax-countries.js';
import { rates as taxRates, progressive as taxBands } from '../js/lib/tax.js';
import { decodeQrMatrix, scanQrImage, correctBlock } from '../js/lib/qr-decode.js';
import {
  encodeCode128, encodeEan13, encodeEan8, encodeCode39, decodeBarcodeRuns, eanCheckDigit,
} from '../js/lib/barcode.js';
import {
  fullUuid, shortUuid, isAssigned, assignedNumber, nameFor, decodeValue, parsePayload, toHex, isUuid,
} from '../js/lib/gatt.js';
import { faultsIn, isValid, schemaFor, actionFor, provide } from '../js/lib/webmcp.js';
import {
  traceImage, guessMode, borderColour, signedArea as ringArea, boundsOf, toPath, toSvg, statsOf,
} from '../js/lib/trace.js';
import {
  encodeGif, decodeGif, buildPalette, lzwEncode, lzwDecode, delayInHundredths,
} from '../js/lib/gif.js';
import {
  buildNetwork, planRoute, placeLabels, labelClashes, searchStations, findStation, mapSvg, routeSvg,
  roundedPath, trainMotion, linePaths, planTour,
} from '../js/lib/metro.js';
import torontoMap from '../js/apps/metro-maps/maps/toronto.js';
import {
  ringArea as sphereArea, polygonsArea, moveShape, shapeCentre, mercatorY, mercatorLat, mercatorStretch, packRings, unpackRings, simplifyRing,
} from '../js/lib/geo.js';
import vancouverMap from '../js/apps/metro-maps/maps/vancouver.js';

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

// ---- documents: pdf structure and page layout -------------------------
{
  close('pdf helvetica measures a known string', pdfWidth('Hello', 'helvetica', 12), (722 + 556 + 222 + 222 + 556) * 12 / 1000, 1e-9);
  close('pdf courier is monospaced', pdfWidth('iiii', 'courier', 10), pdfWidth('WWWW', 'courier', 10), 1e-9);
  ok('pdf bold is wider than regular', pdfWidth('Handgloves', 'helveticaBold', 12) > pdfWidth('Handgloves', 'helvetica', 12));
  ok('pdf maps a curly quote into WinAnsi', toWinAnsi('’')[0] === 146);
  ok('pdf keeps plain ascii as it is', toWinAnsi('A')[0] === 65);

  const wrapped = pdfWrap('The quick brown fox jumps over the lazy dog and keeps on running', 'helvetica', 12, 150);
  ok('pdf wraps to more than one line', wrapped.length > 1);
  ok('pdf keeps every wrapped line inside the limit', wrapped.every((line) => pdfWidth(line, 'helvetica', 12) <= 150), `widest ${Math.max(...wrapped.map((line) => pdfWidth(line, 'helvetica', 12))).toFixed(1)}`);
  ok('pdf loses no words when wrapping', wrapped.join(' ').split(/\s+/).join(' ') === 'The quick brown fox jumps over the lazy dog and keeps on running');

  const doc = createPdf({ size: 'a4' });
  doc.text('First', { x: 72, y: 100 });
  doc.addPage();
  doc.text('Second', { x: 72, y: 100, font: 'timesBold' });
  const bytes = doc.save({ title: 'Check' });
  const text = new TextDecoder('latin1').decode(bytes);

  ok('pdf starts with the header', text.startsWith('%PDF-'));
  ok('pdf ends with the marker', text.trimEnd().endsWith('%%EOF'));
  ok('pdf reports both pages', doc.pageCount === 2);

  const startxref = Number(text.slice(text.lastIndexOf('startxref') + 9).trim().split(/\s/)[0]);
  ok('pdf points at its own table', text.slice(startxref, startxref + 4) === 'xref');
  const rows = [...text.slice(startxref).matchAll(/^(\d{10}) (\d{5}) ([nf])/gm)];
  const offsets = rows.map((row, index) => ({ index, at: Number(row[1]), free: row[3] === 'f' }));
  ok('pdf lists every object in the table', offsets.length > 4);
  ok(
    'pdf offsets land on their objects',
    offsets.every((row) => row.free || new RegExp(`^${row.index} 0 obj`).test(text.slice(row.at, row.at + 24))),
  );

  const blocks = [{ type: 'h1', runs: [{ text: 'Title' }] }];
  for (let i = 0; i < 60; i += 1) blocks.push({ type: 'p', align: 'left', runs: [{ text: `Paragraph ${i}. ${'word '.repeat(40)}` }] });
  const layout = layoutDocument(blocks, { size: 'a4', margin: 72 });
  ok('layout runs onto several pages', layout.pages.length > 2, `${layout.pages.length} pages`);
  ok('layout keeps every line above the bottom margin',
    layout.pages.every((page) => page.items.every((item) => item.y <= layout.height - layout.margin + 14)));
  ok('layout keeps every line inside the left margin',
    layout.pages.every((page) => page.items.every((item) => item.x >= layout.margin - 20)));
  ok('layout puts something on every page', layout.pages.every((page) => page.items.length > 0));

  const narrow = layoutDocument(blocks, { size: 'a5', margin: 72 });
  ok('layout needs more pages on smaller paper', narrow.pages.length > layout.pages.length);
  ok('a serif family maps to Times', baseFor('Georgia, Times New Roman, serif') === 'times');
  ok('a sans family maps to Helvetica', baseFor('Verdana, Geneva, sans-serif') === 'helvetica');
  ok('a mono family maps to Courier', baseFor('Courier New, Courier, monospace') === 'courier');
  ok('an unknown family falls back', baseFor('Nonsense') === 'helvetica');

  const rich = [
    { type: 'h1', runs: [{ text: 'Report' }] },
    { type: 'p', runs: [{ text: 'Plain ' }, { text: 'bold', bold: true }] },
    { type: 'bullet', depth: 0, runs: [{ text: 'One' }] },
    { type: 'ordered', depth: 0, runs: [{ text: 'Two' }] },
  ];
  ok('markdown keeps the heading level', blocksToMarkdown(rich).startsWith('# Report'));
  ok('markdown marks bold', blocksToMarkdown(rich).includes('**bold**'));
  ok('markdown numbers an ordered item', blocksToMarkdown(rich).includes('1. Two'));
  ok('text drops the marks', blocksToText(rich).includes('Plain bold'));
  ok('the outline finds the heading', outlineOf(rich).length === 1 && outlineOf(rich)[0].text === 'Report');
  ok('word count counts the words', countWords(rich).words === 5, `${countWords(rich).words}`);
  ok('word count leaves out the list marker', countWords([{ type: 'bullet', depth: 0, runs: [{ text: 'one two' }] }]).words === 2);

  const back = markdownToHtml('# Title\n\nSome **bold** and *slanted* text.\n\n- one\n- two\n\n1. first\n\n> quoted\n\n---\n\n[link](https://example.com)');
  ok('markdown reads a heading', back.includes('<h1>Title</h1>'));
  ok('markdown reads bold', back.includes('<b>bold</b>'));
  ok('markdown reads italics', back.includes('<i>slanted</i>'));
  ok('markdown reads a bulleted list', back.includes('<ul>') && back.includes('<li>one</li>'));
  ok('markdown reads a numbered list', back.includes('<ol>') && back.includes('<li>first</li>'));
  ok('markdown reads a quote', back.includes('<blockquote>quoted</blockquote>'));
  ok('markdown reads a rule', back.includes('<hr>'));
  ok('markdown reads a link', back.includes('href="https://example.com"'));
  ok('markdown escapes stray angle brackets', markdownToHtml('a < b & c').includes('&lt;'));

  const roundTrip = blocksToMarkdown(rich);
  ok('markdown survives a round trip through html', markdownToHtml(roundTrip).includes('<h1>Report</h1>'));

  const mixed = layoutDocument(
    [
      { type: 'h1', runs: [{ text: 'Portrait' }] },
      { type: 'section', setup: { size: 'a4', orientation: 'landscape', margin: 72 } },
      { type: 'h1', runs: [{ text: 'Landscape' }] },
      { type: 'section', setup: { size: 'a5', orientation: 'portrait', margin: 36 } },
      { type: 'h1', runs: [{ text: 'Small' }] },
    ],
    { size: 'a4', margin: 72 },
  );
  ok('a section starts a page of its own', mixed.pages.length === 3, `${mixed.pages.length} pages`);
  ok('a section can turn the paper sideways', mixed.pages[1].width > mixed.pages[1].height);
  ok('a section can change the paper size', Math.round(mixed.pages[2].width) === 420);
  ok('a section carries its own margin', mixed.pages[2].margin === 36);
  ok('the first page keeps the original paper', Math.round(mixed.pages[0].width) === 595 && Math.round(mixed.pages[0].height) === 842);

  const mixedPdf = new TextDecoder('latin1').decode(layoutToPdf(mixed, { title: 'Mixed' }));
  const boxes = [...mixedPdf.matchAll(/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((row) => `${Math.round(Number(row[1]))}x${Math.round(Number(row[2]))}`);
  ok('the pdf gives every page its own size', boxes.join(',') === '595x842,842x595,420x595', boxes.join(','));

  const numbered = layoutToPdf(layoutDocument([{ type: 'p', runs: [{ text: 'one' }] }], { size: 'a4' }), { numbers: true });
  const plainPdf = layoutToPdf(layoutDocument([{ type: 'p', runs: [{ text: 'one' }] }], { size: 'a4' }), {});
  ok('page numbers add to the file', numbered.length > plainPdf.length);
  ok('a footer lands on the page', layoutToPdf(layoutDocument([{ type: 'p', runs: [{ text: 'one' }] }], { size: 'a4' }), { footer: 'Draft' }).length > plainPdf.length);
}

// ---- bluetooth gatt: identifiers and readings from the specification ---
{
  const bytes = (...values) => new DataView(Uint8Array.from(values).buffer);

  ok('16 bit shorthand expands to the base uuid', fullUuid('180f') === '0000180f-0000-1000-8000-00805f9b34fb');
  ok('a 0x prefix is shorthand too', fullUuid('0x2A19') === '00002a19-0000-1000-8000-00805f9b34fb');
  ok('a full uuid passes through unchanged', fullUuid('6E400001-B5A3-F393-E0A9-E50E24DCCA9E') === '6e400001-b5a3-f393-e0a9-e50e24dcca9e');
  ok('nonsense is not a uuid', fullUuid('zzz') === null && !isUuid('1234'));

  ok('a base uuid is assigned', isAssigned('0000180d-0000-1000-8000-00805f9b34fb'));
  ok('a vendor uuid is not assigned', !isAssigned('6e400001-b5a3-f393-e0a9-e50e24dcca9e'));
  ok('a uuid outside the first block is not assigned', !isAssigned('1234180d-0000-1000-8000-00805f9b34fb'));
  ok('the assigned number is the second half of the first block', assignedNumber('0000180f-0000-1000-8000-00805f9b34fb') === '180f');

  ok('an assigned uuid is shown as four digits', shortUuid('0000180f-0000-1000-8000-00805f9b34fb') === '0x180F');
  ok('a vendor uuid is shown whole', shortUuid('6e400001-b5a3-f393-e0a9-e50e24dcca9e') === '6e400001-b5a3-f393-e0a9-e50e24dcca9e');

  ok('an assigned service is named', nameFor(fullUuid('180d')) === 'Heart rate');
  ok('an assigned characteristic is named', nameFor(fullUuid('2a19'), 'characteristic') === 'Battery level');
  ok('a descriptor is named', nameFor(fullUuid('2901'), 'descriptor') === 'Description');
  ok('nordic uart keeps its real uuid', nameFor('6e400001-b5a3-f393-e0a9-e50e24dcca9e') === 'Nordic UART');
  ok('an unknown uuid has no name', nameFor('9f2a1b30-4c7e-4d21-93b8-1f0e5a6c7d80') === null);

  ok('battery level reads as a percentage', decodeValue(fullUuid('2a19'), bytes(84)).text === '84 %');
  ok('temperature is hundredths of a degree', decodeValue(fullUuid('2a6e'), bytes(0x39, 0x08)).text === '21.05 °C');
  ok('temperature can be below zero', decodeValue(fullUuid('2a6e'), bytes(0xc7, 0xf7)).text === '-21.05 °C');
  ok('humidity is hundredths of a percent', decodeValue(fullUuid('2a6f'), bytes(0x10, 0x17)).text === '59.04 % RH');
  ok('pressure is tenths of a pascal', decodeValue(fullUuid('2a6d'), bytes(0x40, 0x0d, 0x03, 0x00)).text === '20000 Pa');

  // the heart rate flags byte: bit 0 clear means the rate is a single byte
  ok('a narrow heart rate is one byte', decodeValue(fullUuid('2a37'), bytes(0x00, 72)).text === '72 bpm');
  ok('a wide heart rate is two bytes', decodeValue(fullUuid('2a37'), bytes(0x01, 0x2c, 0x01)).text === '300 bpm');
  ok('a heart rate needs more than its flags', decodeValue(fullUuid('2a37'), bytes(0x00)) === null);

  ok('a body sensor location is named', decodeValue(fullUuid('2a38'), bytes(2)).text === 'Wrist');
  ok('a text characteristic reads as text', decodeValue(fullUuid('2a29'), bytes(65, 99, 109, 101)).text === 'Acme');
  ok('a trailing zero is dropped from text', decodeValue(fullUuid('2a24'), bytes(65, 66, 0, 0)).text === 'AB');
  ok('bytes that say nothing decode to nothing', decodeValue('9f2a1b30-4c7e-4d21-93b8-1f0e5a6c7d80', bytes(0x01, 0xff, 0x00)) === null);
  ok('an empty value decodes to nothing', decodeValue(fullUuid('2a19'), bytes()) === null);

  ok('bytes are written as hex pairs', toHex(bytes(0x01, 0xff, 0x00, 0x2c)) === '01 ff 00 2c');
  ok('hex is parsed however it is spaced', [...parsePayload('01 FF-00:2c', 'hex')].join(',') === '1,255,0,44');
  ok('text is parsed as its bytes', [...parsePayload('Hi', 'text')].join(',') === '72,105');
  ok('an empty payload is empty', parsePayload('  ', 'hex').length === 0);
}

// ---- webmcp: the shape of a tool a page offers -------------------------
{
  const good = {
    name: 'format_json',
    description: 'Format a JSON document and report any syntax error',
    params: {
      text: { type: 'string', description: 'The JSON to format', required: true },
      indent: { type: 'integer', description: 'Spaces per level' },
    },
    run: async () => 'ok',
  };

  ok('a well formed tool passes', isValid(good), faultsIn(good).join('; '));
  ok('a tool needs a run function', !isValid({ ...good, run: undefined }));
  ok('a name must be lower case', !isValid({ ...good, name: 'Format_JSON' }));
  ok('a name must start with a letter', !isValid({ ...good, name: '9lives' }));
  ok('a name of one character is too short', !isValid({ ...good, name: 'x' }));
  ok('a description must say something', !isValid({ ...good, description: 'short' }));
  ok('a parameter needs a known type', !isValid({ ...good, params: { text: { type: 'object', description: 'a thing' } } }));
  ok('a parameter needs a description', !isValid({ ...good, params: { text: { type: 'string' } } }));
  ok('a tool with no parameters is fine', isValid({ ...good, params: undefined }));
  ok('nonsense is not a tool', !isValid(null) && !isValid('format_json'));

  const schema = schemaFor(good);
  ok('the schema is an object schema', schema.type === 'object');
  ok('every parameter reaches the schema', Object.keys(schema.properties).join(',') === 'text,indent');
  ok('only the required parameter is required', schema.required.join(',') === 'text');
  ok('the required flag does not leak into the schema', !('required' in schema.properties.text));
  ok('a tool with no parameters has no required list', !('required' in schemaFor({ ...good, params: {} })));

  const action = actionFor(good, 'https://jsglobe.com/apps/json-formatter');
  ok('the action carries the name and description', action.name === 'format_json' && action.description === good.description);
  ok('the action points at the page', action.target.urlTemplate === 'https://jsglobe.com/apps/json-formatter');
  ok('an action without a url has no target', !('target' in actionFor(good)));

  // without a browser there is nothing to offer, and nothing should break
  const faults = [];
  const withdraw = provide([good, { name: 'bad' }], { onFault: (name, why) => faults.push(`${name}: ${why.length}`) });
  ok('a badly described tool is reported, not offered', faults.length === 1 && faults[0].startsWith('bad'));
  ok('providing returns something callable even with no browser', typeof withdraw === 'function');
  withdraw();
}

// ---- trace: outlines of pictures whose shapes are known -----------------
{
  const picture = (width, height, paint) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b, a] = paint(x + 0.5, y + 0.5, x, y);
        data.set([r, g, b, a], (y * width + x) * 4);
      }
    }
    return { data, width, height };
  };
  const clear = [0, 0, 0, 0];
  const solid = [20, 20, 20, 255];
  const white = [255, 255, 255, 255];
  // outlines wind one way and holes the other, so the signed areas add up to
  // what is actually covered
  const covered = (result) => result.rings.reduce((total, ring) => total + ringArea(ring.points), 0);
  const near = (value, wanted, within) => Math.abs(value - wanted) <= within;

  // a 40 by 30 block, whose outline should sit exactly on its pixel edges
  const box = picture(100, 80, (x, y) => (x > 30 && x < 70 && y > 25 && y < 55 ? solid : clear));
  ok('a picture cut out on a clear background is traced by its transparency', guessMode(box) === 'alpha');
  const exact = traceImage(box, { tolerance: 0 });
  const edges = boundsOf(exact.rings);
  ok('a block traces as one shape', exact.rings.length === 1 && !exact.rings[0].hole);
  ok('its outline sits on the pixel edges', near(edges.left, 30, 1e-9) && near(edges.right, 70, 1e-9)
    && near(edges.top, 25, 1e-9) && near(edges.bottom, 55, 1e-9), JSON.stringify(edges));
  // each corner loses a triangle half a pixel on a side
  ok('it covers the block less its four corners', near(covered(exact), 1199.5, 0.01), String(covered(exact)));
  const thinned = traceImage(box, { tolerance: 1 });
  ok('simplifying a block leaves only its corners', thinned.rings[0].points.length <= 8, String(thinned.rings[0].points.length));
  ok('and does not change what it covers', near(covered(thinned), 1200, 1), String(covered(thinned)));

  const disc = picture(100, 80, (x, y) => (Math.hypot(x - 50, y - 40) < 25 ? solid : clear));
  const round = traceImage(disc, { tolerance: 0.5 });
  ok('a disc covers pi r squared', near(covered(round), Math.PI * 625, Math.PI * 625 * 0.01), String(covered(round)));

  const ring = picture(110, 110, (x, y) => {
    const out = Math.hypot(x - 55, y - 55);
    return out < 30 && out >= 15 ? solid : clear;
  });
  const donut = traceImage(ring, { tolerance: 0.5 });
  ok('a ring traces as an outline and a hole', donut.rings.length === 2 && donut.rings.filter((r) => r.hole).length === 1);
  ok('the outline winds forwards and the hole backwards',
    donut.rings.every((r) => (r.hole ? ringArea(r.points) < 0 : ringArea(r.points) > 0)));
  ok('a ring covers the disc less its hole', near(covered(donut), Math.PI * 675, Math.PI * 675 * 0.02), String(covered(donut)));
  ok('the counts say one shape and one hole', JSON.stringify(statsOf(donut.rings)).startsWith('{"shapes":1,"holes":1'));

  // A soft edge: the last column is three quarters there. The outline should
  // land where the transparency crosses the threshold, not on a pixel edge.
  const soft = picture(20, 10, (x, y, i) => (i < 8 ? solid : i === 8 ? [20, 20, 20, 191] : clear));
  const between = boundsOf(traceImage(soft, { tolerance: 0 }).rings).right;
  // the field is stretched so the threshold of 128 sits at a half, which puts
  // the three-quarters pixel at a half plus half of 63 out of 127
  const partial = 0.5 + 0.5 * (63 / 127);
  ok('a soft edge is placed between pixels', near(between, 8.5 + (partial - 0.5) / partial, 0.001), String(between));
  const harder = boundsOf(traceImage(soft, { tolerance: 0, threshold: 200 }).rings).right;
  ok('raising the threshold pulls the edge in', harder < between - 0.3, `${harder} against ${between}`);

  // on an opaque picture the subject is whatever differs from the border
  const redOnWhite = picture(40, 40, (x, y) => (x > 10 && x < 30 && y > 10 && y < 30 ? [220, 30, 30, 255] : white));
  ok('an opaque picture is traced by colour', guessMode(redOnWhite) === 'colour');
  const border = borderColour(redOnWhite);
  ok('the background is read off the border', border.r === 255 && border.g === 255 && border.b === 255);
  ok('a coloured square on white traces as the square', near(covered(traceImage(redOnWhite, { tolerance: 0 })), 399.5, 0.01));

  const inkOnPaper = picture(40, 40, (x, y) => (x > 10 && x < 30 && y > 10 && y < 30 ? [0, 0, 0, 255] : white));
  ok('the dark parts are the ink', near(covered(traceImage(inkOnPaper, { mode: 'dark', tolerance: 0 })), 399.5, 0.01));
  const paper = traceImage(inkOnPaper, { mode: 'light', tolerance: 0 });
  ok('the light parts are the paper, with the ink as a hole', paper.rings.length === 2 && paper.rings.some((r) => r.hole));

  // tidying: dust goes, holes fill
  const dusty = picture(100, 80, (x, y) =>
    (x > 30 && x < 70 && y > 25 && y < 55) || (x > 5 && x < 7 && y > 5 && y < 7) ? solid : clear);
  ok('a speck of dust is traced if nothing says otherwise', traceImage(dusty).rings.length === 2);
  ok('and goes when specks are ignored', traceImage(dusty, { specks: 10 }).rings.length === 1);

  const holed = picture(60, 60, (x, y) => {
    const inBlock = x > 15 && x < 45 && y > 15 && y < 45;
    const inHole = x > 28 && x < 32 && y > 28 && y < 32;
    return inBlock && !inHole ? solid : clear;
  });
  ok('a block with a hole in it traces as two', traceImage(holed).rings.length === 2);
  ok('filling holes makes it one', traceImage(holed, { fillHoles: true }).rings.length === 1);
  ok('a hole smaller than a speck is filled too', traceImage(holed, { specks: 20 }).rings.length === 1);

  // Growing a square by r adds a band r wide with rounded corners: the square
  // r larger on every side, less the four corners a circle does not reach.
  const square = picture(100, 100, (x, y) => (x > 40 && x < 60 && y > 40 && y < 60 ? solid : clear));
  const grown = traceImage(square, { offset: 5, tolerance: 0.25 });
  const grownArea = 900 - (4 - Math.PI) * 25;
  ok('growing a square gives it round corners and the right area', near(covered(grown), grownArea, grownArea * 0.02),
    String(covered(grown)));
  ok('grown by five it reaches five further', near(boundsOf(grown.rings).left, 35, 0.2), String(boundsOf(grown.rings).left));
  const shrunk = traceImage(square, { offset: -3, tolerance: 0.25 });
  ok('shrinking a square takes the same off every side', near(covered(shrunk), 196, 196 * 0.04), String(covered(shrunk)));

  // a subject touching the edge can still grow past it
  const edgeOn = picture(40, 40, (x, y) => (x < 10 && y > 10 && y < 30 ? solid : clear));
  const past = traceImage(edgeOn, { offset: 5 });
  ok('an outline can grow past the edge of the picture', boundsOf(past.rings).left < -4, String(boundsOf(past.rings).left));
  ok('and the SVG makes room for it', /viewBox="-\d/.test(toSvg(past)), toSvg(past).slice(0, 120));

  const doubled = traceImage(box, { tolerance: 0, scale: 2 });
  ok('a picture traced small comes back at full size', near(covered(doubled), 1199.5 * 4, 0.05) && doubled.width === 200);

  const nothing = traceImage(picture(20, 20, () => clear));
  ok('an empty picture has no outline', nothing.rings.length === 0);
  ok('and still makes a valid SVG', toSvg(nothing).startsWith('<svg') && !toSvg(nothing).includes('<path'));

  // one solid colour has nothing that differs from its border, so this has to
  // be traced by its transparency; left to guess, it finds no subject at all
  ok('a picture of one colour has no subject to find by colour', traceImage(picture(30, 20, () => solid)).rings.length === 0);
  const everything = traceImage(picture(30, 20, () => solid), { mode: 'alpha', tolerance: 0 });
  ok('a picture that is all subject traces round its edge', everything.rings.length === 1
    && near(covered(everything), 599.5, 0.01));

  // two pixels touching only at a corner are two shapes, not one pinched one
  const diagonal = picture(4, 4, (x, y, i, j) => ((i === 1 && j === 1) || (i === 2 && j === 2) ? solid : clear));
  ok('pixels meeting at a corner stay separate', traceImage(diagonal, { tolerance: 0 }).rings.length === 2);

  const straight = toPath(round.rings);
  const curved = toPath(round.rings, { smooth: true });
  ok('a plain path is straight lines', straight.startsWith('M') && !straight.includes('C') && straight.includes('L'));
  ok('a smooth path is curves', curved.includes('C'));
  ok('every ring is closed', (toPath(donut.rings).match(/Z/g) ?? []).length === 2);

  const outlined = toSvg(donut, { stroke: '#123456', strokeWidth: 3 });
  const filled = toSvg(donut, { style: 'filled', fill: '#abcdef' });
  ok('an outline is a stroke with nothing filled', outlined.includes('fill="none"') && outlined.includes('stroke="#123456"'));
  ok('a filled shape keeps its hole open', filled.includes('fill-rule="evenodd"') && filled.includes('fill="#abcdef"'));
  ok('a colour that is not a colour is not written into the file',
    !toSvg(donut, { stroke: '"><script>' }).includes('script'));
  ok('the picture can ride along underneath', toSvg(donut, { picture: 'data:image/png;base64,AAAA' }).includes('<image'));
}

// ---- gif: what goes in comes back out -----------------------------------
{
  const frame = (width, height, paint, delay = 100) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) data.set(paint(x, y), (y * width + x) * 4);
    }
    return { data, delay };
  };
  const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
  const RED = [220, 30, 40, 255];
  const BLUE = [20, 60, 200, 255];
  const CREAM = [250, 240, 200, 255];
  const CLEAR = [0, 0, 0, 0];

  // A long file read on a cold start. The reader once lost its place partway
  // through one on the first read only, when the compiler stepped in.
  const film = Array.from({ length: 24 }, (_, step) => frame(320, 180, (x, y) =>
    [(x + step * 3) & 255, (y * 2 + step) & 255, ((x ^ y) + step * 5) & 255, 255], 80));
  const reel = decodeGif(encodeGif(film, 320, 180));
  ok('a long file reads back whole the first time', reel.frames.length === 24);

  // the one pixel GIF that has been on the web since the nineties
  const pixel = decodeGif(Uint8Array.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 0xff, 0xff, 0xff,
    0x21, 0xf9, 4, 1, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3b,
  ]));
  ok('the classic see-through pixel reads as one clear pixel', pixel.width === 1 && pixel.frames.length === 1
    && pixel.frames[0].data[3] === 0);

  const rng = ((seed) => () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) / 16777216)(7);
  for (const bits of [2, 4, 8]) {
    const noise = Uint8Array.from({ length: 30000 }, () => Math.floor(rng() * (1 << bits)));
    ok(`packing ${bits} bit noise and unpacking it gives it back`, same(lzwDecode(lzwEncode(noise, bits), bits, noise.length), noise));
  }
  const runs = new Uint8Array(200000).map((_, index) => (index >> 9) & 3);
  const packed = lzwEncode(runs, 2);
  ok('long runs pack small and come back whole', packed.length < 6000 && same(lzwDecode(packed, 2, runs.length), runs));

  // a square walking across a cream field, in three colours
  const walk = [0, 1, 2, 3].map((step) => frame(40, 30, (x, y) =>
    (x >= 4 + step * 8 && x < 12 + step * 8 && y >= 10 && y < 18 ? RED : y > 25 ? BLUE : CREAM)));
  const bytes = encodeGif(walk, 40, 30, { repeat: 0 });
  const back = decodeGif(bytes);
  ok('a GIF starts with its signature', String.fromCharCode(...bytes.subarray(0, 6)) === 'GIF89a');
  ok('every frame comes back', back.frames.length === 4 && back.width === 40 && back.height === 30);
  ok('a few colours come back exactly', back.frames.every((got, index) => same(got.data, walk[index].data)));
  ok('for ever is written as for ever', back.repeat === 0);
  ok('a delay comes back', back.frames.every((got) => got.delay === 100));
  const whole = encodeGif(walk, 40, 30, { optimise: false });
  ok('storing only the changes makes a smaller file', bytes.length < whole.length, `${bytes.length} vs ${whole.length}`);
  ok('storing whole frames reads the same', decodeGif(whole).frames.every((got, index) => same(got.data, walk[index].data)));

  ok('once is written without a loop', decodeGif(encodeGif(walk, 40, 30, { repeat: 1 })).repeat === 1);
  ok('three plays come back as three', decodeGif(encodeGif(walk, 40, 30, { repeat: 3 })).repeat === 3);
  ok('a delay under two hundredths is raised to it', delayInHundredths(0) === 2 && delayInHundredths(5) === 2
    && delayInHundredths(130) === 13);

  const still = [walk[0], walk[0], walk[0], walk[1]];
  const merged = decodeGif(encodeGif(still, 40, 30));
  ok('frames that do not change become one longer frame', merged.frames.length === 2 && merged.frames[0].delay === 300);

  // a dot moving over a clear background has to leave nothing behind
  const dot = [0, 1, 2].map((step) => frame(20, 20, (x, y) => (x >= step * 6 && x < step * 6 + 4 && y < 4 ? RED : CLEAR)));
  const ghost = decodeGif(encodeGif(dot, 20, 20));
  ok('clear stays clear', ghost.frames.every((got, index) => same(got.data, dot[index].data)));
  ok('a moved dot leaves no trail', ghost.frames[2].data[3] === 0);

  // 4096 greys and colours squeezed into a palette
  const rainbow = frame(64, 64, (x, y) => [x * 4, y * 4, (x + y) * 2, 255]);
  const palette = buildPalette([rainbow], 256);
  ok('a palette never holds more than asked', palette.length <= 256 && buildPalette([rainbow], 16).length <= 16);
  const squeezed = decodeGif(encodeGif([rainbow], 64, 64)).frames[0].data;
  let miss = 0;
  for (let at = 0; at < squeezed.length; at += 4) {
    miss += Math.abs(squeezed[at] - rainbow.data[at]) + Math.abs(squeezed[at + 1] - rainbow.data[at + 1])
      + Math.abs(squeezed[at + 2] - rainbow.data[at + 2]);
  }
  ok('many colours come back close', miss / (64 * 64 * 3) < 6, `average miss ${(miss / (64 * 64 * 3)).toFixed(2)}`);
  const two = decodeGif(encodeGif([rainbow], 64, 64, { colours: 2 })).frames[0].data;
  const kinds = new Set();
  for (let at = 0; at < two.length; at += 4) kinds.add(`${two[at]},${two[at + 1]},${two[at + 2]}`);
  ok('two colours means two colours', kinds.size === 2);

  // a grey ramp in four shades: dithering should keep each patch's average
  // close to the ramp, where plain rounding makes steps
  const ramp = frame(128, 32, (x) => [x * 2, x * 2, x * 2, 255]);
  const patchMiss = (options) => {
    const got = decodeGif(encodeGif([ramp], 128, 32, { colours: 4, ...options })).frames[0].data;
    let total = 0;
    for (let px = 0; px < 128; px += 16) {
      let sum = 0;
      let want = 0;
      for (let y = 0; y < 32; y += 1) {
        for (let x = px; x < px + 16; x += 1) {
          sum += got[(y * 128 + x) * 4];
          want += ramp.data[(y * 128 + x) * 4];
        }
      }
      total += Math.abs(sum - want) / (16 * 32);
    }
    return total / 8;
  };
  ok('dithering keeps a ramp smoother than rounding', patchMiss({ dither: true }) < patchMiss({ dither: false }),
    `${patchMiss({ dither: true }).toFixed(2)} vs ${patchMiss({ dither: false }).toFixed(2)}`);

  // interlaced files store rows out of order; a reader has to put them back
  const stripes = frame(4, 10, (x, y) => (y % 3 === 0 ? RED : BLUE));
  const order = [0, 8, 4, 2, 6, 1, 3, 5, 7, 9];
  const rows = Uint8Array.from(order.flatMap((y) => [0, 1, 2, 3].map(() => (y % 3 === 0 ? 0 : 1))));
  const body = lzwEncode(rows, 2);
  const interlaced = Uint8Array.from([
    ...'GIF89a'.split('').map((char) => char.charCodeAt(0)), 4, 0, 10, 0, 0x80, 0, 0,
    ...RED.slice(0, 3), ...BLUE.slice(0, 3),
    0x2c, 0, 0, 0, 0, 4, 0, 10, 0, 0x40, 2, body.length, ...body, 0, 0x3b,
  ]);
  ok('interlaced rows are put back in order', same(decodeGif(interlaced).frames[0].data, stripes.data));

  let threw = false;
  try {
    decodeGif(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
  } catch {
    threw = true;
  }
  ok('something that is not a GIF is refused', threw);
}

// ---- metro: routes on networks small enough to work out by hand, and the real maps ----
{
  // a runs to d along one line, x to y crosses it at b; the long way round has no change
  const small = buildNetwork({
    id: 'small',
    change: 4,
    lines: [
      { id: 'red', colour: '#ff0000', minutes: 2, branches: [['a', 'b', 'c', 'd']] },
      { id: 'blue', colour: '#0000ff', minutes: 2, branches: [['x', 'b', 'y']] },
      { id: 'slow', colour: '#00ff00', minutes: 5, branches: [['a', 'q', 'r', 'y']] },
    ],
    stations: {
      a: { name: 'Alder', x: 0, y: 0 }, b: { name: 'Birch', x: 2, y: 0 }, c: { name: 'Cedar', x: 4, y: 0 },
      d: { name: 'Dogwood', x: 6, y: 0 }, x: { name: 'Hazel', x: 2, y: -2 }, y: { name: 'Yew', x: 2, y: 2 },
      q: { name: 'Quince', x: 0, y: 2 }, r: { name: 'Rowan', x: 1, y: 3 },
    },
  });
  ok('a well formed map has no problems', small.problems.length === 0, small.problems.join('; '));
  const quick = planRoute(small, 'a', 'y');
  ok('the fastest way changes where the lines cross', quick.legs.length === 2 && quick.legs[0].to === 'b' && quick.changes === 1);
  ok('its time is the rides plus the change', quick.minutes === 2 + 4 + 2 && quick.stops === 2);
  ok('each ride says where the train is headed', quick.legs[0].towards.join() === 'd' && quick.legs[1].towards.join() === 'y');
  const steady = planRoute(small, 'a', 'y', { prefer: 'changes' });
  ok('fewest changes takes the long way with none', steady.changes === 0 && steady.legs[0].line === 'slow' && steady.minutes === 15);
  ok('going nowhere is no trip', planRoute(small, 'c', 'c').legs.length === 0);
  ok('an unknown station has no route', planRoute(small, 'a', 'nowhere') === null);
  ok('backwards along a line heads for its first station', planRoute(small, 'd', 'a').legs[0].towards.join() === 'a');

  // visiting several stations along one line in a muddled order comes out in line order
  const long = buildNetwork({
    lines: [{ id: 'l', colour: '#123456', minutes: 2, branches: [['p1', 'p2', 'p3', 'p4', 'p5', 'p6']] }],
    stations: Object.fromEntries(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id, at) => [id, { name: id.toUpperCase(), x: at * 2, y: 0 }])),
  });
  const muddled = planTour(long, ['p1', 'p5', 'p3', 'p6', 'p2']);
  ok('a tour visits stops in the order that is quickest', muddled.visits.join() === 'p1,p2,p3,p5,p6' && muddled.minutes === 10, muddled.visits.join());
  const middle = planTour(long, ['p3', 'p1', 'p6']);
  ok('starting in the middle, the nearer end comes first', middle.visits.join() === 'p3,p1,p6' && middle.minutes === 14, `${middle.visits.join()} ${middle.minutes}`);
  const free = planTour(long, ['p3', 'p1', 'p6'], { keepStart: false });
  ok('free to start anywhere, a tour starts at an end', ['p1,p3,p6', 'p6,p3,p1'].includes(free.visits.join()) && free.minutes === 10);
  const loop = planTour(long, ['p2', 'p5', 'p4'], { returnToStart: true });
  ok('a round trip comes back to where it began', loop.visits[0] === 'p2' && loop.visits[loop.visits.length - 1] === 'p2' && loop.minutes === 12);
  const many = buildNetwork({
    lines: [{ id: 'm', colour: '#654321', minutes: 1, branches: [Array.from({ length: 16 }, (_, at) => `q${at}`)] }],
    stations: Object.fromEntries(Array.from({ length: 16 }, (_, at) => [`q${at}`, { name: `Q${at}`, x: at * 2, y: 0 }])),
  });
  const wide = planTour(many, ['q0', 'q9', 'q3', 'q15', 'q7', 'q12', 'q1', 'q14', 'q5', 'q11', 'q2', 'q13', 'q8', 'q4']);
  ok('fourteen stops are still put in a sensible order', wide.minutes === 15, `${wide.minutes} ${wide.visits.join()}`);
  ok('a tour of one station is no tour', planTour(long, ['p1']) === null);

  const broken = buildNetwork({ lines: [{ id: 'z', colour: 'red', branches: [['a', 'ghost']] }], stations: { a: { name: 'A', x: 0, y: 0 }, lonely: { name: 'L', x: 0, y: 0 } } });
  ok('a map naming a missing station says so', broken.problems.some((problem) => problem.includes('ghost')));
  ok('a station on no line is reported', broken.problems.some((problem) => problem.includes('lonely')));
  ok('two stations in one place are reported', broken.problems.some((problem) => problem.includes('same place')));
  ok('a colour that is not a colour is reported', broken.problems.some((problem) => problem.includes('no colour')));

  const bend = roundedPath([[0, 0, 'a'], [100, 0, null], [100, 100, 'b']]);
  ok('a bend between stations is rounded', bend.startsWith('M0 0') && bend.includes('Q100 0') && bend.endsWith('L100 100'));
  const motion = trainMotion([[0, 0, 'a'], [100, 0, 'b'], [200, 0, 'c']], { speed: 100, dwell: 1 });
  ok('a train waits at a station', Math.abs(motion.at(1.5)[0] - 100) < 1e-9);
  // out over two hops and back over two, each a second's ride and a second's wait
  ok('and turns back at the end', motion.period === 8 && Math.abs(motion.at(7.5)[0]) < 1e-9 && Math.abs(motion.at(2.5)[0] - 150) < 1e-6
    && Math.abs(motion.at(4.5)[0] - 150) < 1e-6);

  const count = (map) => new Set(map.lines.flatMap((line) => line.branches.flat())).size;
  const interchanges = (network) => [...network.stations.values()].filter((station) => station.lines.length > 1).map((station) => station.id).sort().join();
  const lineSizes = (network) => network.lines.map((line) => new Set(line.branches.flat()).size).join();

  const toronto = buildNetwork(torontoMap);
  ok('the Toronto map has no problems', toronto.problems.length === 0, toronto.problems.join('; '));
  ok('Toronto has 109 stations on lines of 38, 31, 5, 25 and 18', toronto.stations.size === 109 && count(torontoMap) === 109 && lineSizes(toronto) === '38,31,5,25,18', `${toronto.stations.size} ${lineSizes(toronto)}`);
  ok('Toronto changes at Bloor–Yonge, St George, Spadina, Sheppard–Yonge, Cedarvale, Eglinton, Kennedy and Finch West', interchanges(toronto) === 'bloor-yonge,cedarvale,eglinton,finch-west,kennedy,sheppard-yonge,spadina,st-george', interchanges(toronto));
  ok('Humber College to Union changes at Finch West', planRoute(toronto, 'humber-college', 'union').legs[0].to === 'finch-west');
  ok('Mount Dennis to Kennedy rides Line 5 end to end', planRoute(toronto, 'mount-dennis', 'kennedy').changes === 0);
  const kipling = planRoute(toronto, 'kipling', 'finch');
  ok('Kipling to Finch changes once, at Bloor–Yonge', kipling.changes === 1 && kipling.legs[0].to === 'bloor-yonge'
    && kipling.legs[0].towards.join() === 'kennedy' && kipling.legs[1].towards.join() === 'finch');
  ok('Union to St George needs no change', planRoute(toronto, 'union', 'st-george').changes === 0);
  const donMills = planRoute(toronto, 'don-mills', 'vaughan-metropolitan-centre');
  const donMillsSteady = planRoute(toronto, 'don-mills', 'vaughan-metropolitan-centre', { prefer: 'changes' });
  ok('Don Mills to Vaughan is quicker across town, changing more', donMills.changes === 3 && donMills.legs.some((leg) => leg.line === '5'),
    `${donMills.changes} changes, ${donMills.minutes} min`);
  ok('and with fewest changes goes round by Union', donMillsSteady.changes === 1 && donMillsSteady.minutes > donMills.minutes);
  ok('a station is found by its old name', searchStations(toronto, 'dundas')[0]?.id === 'tmu' && findStation(toronto, 'bloor yonge')?.id === 'bloor-yonge');

  const vancouver = buildNetwork(vancouverMap);
  ok('the Vancouver map has no problems', vancouver.problems.length === 0, vancouver.problems.join('; '));
  ok('Vancouver has 54 stations on lines of 24, 17 and 17', vancouver.stations.size === 54 && lineSizes(vancouver) === '24,17,17');
  ok('Vancouver changes at Waterfront, Commercial–Broadway, Production Way and Lougheed',
    interchanges(vancouver) === 'commercial-broadway,lougheed-town-centre,production-way-university,waterfront');
  const airport = planRoute(vancouver, 'yvr-airport', 'metrotown');
  ok('the airport to Metrotown changes at Waterfront', airport.changes === 1 && airport.legs[0].to === 'waterfront');
  ok('where branches share track, either train will do', airport.legs[1].towards.sort().join() === 'king-george,production-way-university');
  ok('Sapperton to Scott Road changes between branches at Columbia', planRoute(vancouver, 'sapperton', 'scott-road').legs[0].to === 'columbia');
  ok('Lake City Way to Lougheed stays on the Millennium Line', planRoute(vancouver, 'lake-city-way', 'lougheed-town-centre').changes === 0);
  ok('shared track is drawn once', linePaths(vancouver, 'expo').length === 2 && linePaths(vancouver, 'canada').length === 2);

  for (const [name, network] of [['Toronto', toronto], ['Vancouver', vancouver]]) {
    const labels = placeLabels(network);
    ok(`every ${name} station is named`, labels.size === network.stations.size);
    ok(`no two ${name} names are drawn over each other`, labelClashes(labels) === 0, `${labelClashes(labels)} clashes`);
    const svg = mapSvg(network, labels);
    ok(`the ${name} map draws every station`, (svg.match(/data-station=/g) ?? []).length === network.stations.size);
  }
  const risky = buildNetwork({ lines: [{ id: 'l', colour: '#123456', branches: [['a', 'b']] }], stations: { a: { name: '<script>', x: 0, y: 0 }, b: { name: 'B & C', x: 2, y: 0 } } });
  const riskySvg = mapSvg(risky);
  ok('station names are written as text', !riskySvg.includes('<script>') && riskySvg.includes('&lt;script&gt;') && riskySvg.includes('B &amp; C'));
  ok('a route draws its A and B', routeSvg(toronto, kipling).includes('pin-a') && routeSvg(toronto, kipling).includes('pin-b'));
}

// ---- geo: areas and moves on the globe checked against the sphere itself --------
{
  const box = (west, south, east, north) => [[west, south], [east, south], [east, north], [west, north]];
  // a spherical cap band: 2πR²(sin φ2 − sin φ1) × share of the circle
  const band = (south, north, degrees) => 2 * Math.PI * 6371.0088 ** 2 * (Math.sin((north * Math.PI) / 180) - Math.sin((south * Math.PI) / 180)) * (degrees / 360);
  close('a box on the equator has the area of its band of the sphere', Math.abs(sphereArea(box(0, 0, 10, 10))), band(0, 10, 10), 1e-6);
  close('and so does one near the pole', Math.abs(sphereArea(box(20, 70, 50, 80))), band(70, 80, 30), 1e-6);
  close('a hole is taken away', polygonsArea([[box(0, 0, 10, 10), box(2, 2, 4, 4)]]), band(0, 10, 10) - band(2, 4, 2), 1e-6);

  // edges are read as straight in longitude and latitude, so a moved shape needs
  // enough points along each edge for that to hold, as real outlines have
  const dense = (ring) => ring.flatMap(([x1, y1], at) => {
    const [x2, y2] = ring[(at + 1) % ring.length];
    return Array.from({ length: 40 }, (_, k) => [x1 + ((x2 - x1) * k) / 40, y1 + ((y2 - y1) * k) / 40]);
  });
  const square = [dense(box(-5, -5, 5, 5))];
  const centre = shapeCentre(square);
  ok('the middle of a square on the equator is its centre', Math.abs(centre[0]) < 1e-9 && Math.abs(centre[1]) < 1e-9);
  const north = moveShape(square, centre, [0, 60]);
  const kept = Math.abs(sphereArea(north[0])) / Math.abs(sphereArea(square[0]));
  ok('carried north, a shape keeps its true area', Math.abs(kept - 1) < 0.002, `${kept}`);
  const span = (ring) => Math.max(...ring.map(([lon]) => lon)) - Math.min(...ring.map(([lon]) => lon));
  ok('but spans more longitude, which is why a map draws it bigger', span(north[0]) > 1.9 * span(square[0]));
  const across = moveShape(square, centre, [179, 0]);
  ok('moved over the date line, a shape stays in one piece', span(across[0]) < 10.5);
  close('Mercator runs both ways', mercatorLat(mercatorY(51.5)), 51.5, 1e-9);
  close('Mercator draws 60° north four times as big', mercatorStretch(60), 4, 1e-9);

  const ring = [[10.123, 50.456], [11.5, 50.9], [12.25, 49.75]];
  const back = unpackRings(packRings([ring]))[0];
  ok('packed outlines come back to the hundredth of a degree', back.every(([x, y], at) => Math.abs(x - ring[at][0]) <= 0.005 && Math.abs(y - ring[at][1]) <= 0.005));
  const wiggle = Array.from({ length: 50 }, (_, at) => [at, at % 2 ? 0.01 : 0]);
  ok('thinning drops wiggles smaller than the tolerance', simplifyRing(wiggle, 0.05).length === 2);
}

// ---- mcp: events, schemas and a whole conversation with the demo server
{
  const { sseParser, exampleFor, problemsWith, fieldsOf, expandTemplate, templateNames, createClient } = await import('../js/lib/mcp.js');
  const events = [];
  const feed = sseParser((event) => events.push(event));
  feed('event: endpoint\ndata: /messages?session=1\n\n: comment\ndata: {"a":');
  feed('1}\n\n');
  ok('sse events split across chunks come out whole', events.length === 2 && events[0].event === 'endpoint' && events[1].data === '{"a":1}');
  const schema = { type: 'object', properties: { name: { type: 'string' }, count: { type: 'integer', default: 3 }, tags: { type: 'array', items: { type: 'string' } } }, required: ['name'] };
  ok('an example fills defaults and lists', JSON.stringify(exampleFor(schema)) === '{"name":"","count":3,"tags":[""]}');
  ok('a missing required argument is a problem', problemsWith(schema, { count: 2 }).some((problem) => problem.includes('name')));
  ok('a fraction is not a whole number', problemsWith(schema, { name: 'a', count: 1.5 }).length === 1);
  ok('form fields keep their order and requirement', fieldsOf(schema).map((field) => `${field.name}:${field.required}`).join() === 'name:true,count:false,tags:false');
  ok('templates expand and name their parts', expandTemplate('file:///{path}', { path: 'a b' }) === 'file:///a%20b' && templateNames('db://{table}/{id}').join() === 'table,id');
  const seen = [];
  const client = createClient({ transport: 'demo', onMessage: (direction) => seen.push(direction) });
  const info = await client.connect();
  const tools = await client.listAll('tools/list', 'tools');
  const sum = await client.request('tools/call', { name: 'add', arguments: { a: 2, b: 40 } });
  let refused = false;
  try {
    await client.request('nope/nothing');
  } catch (error) {
    refused = error.code === -32601;
  }
  await client.close();
  ok('the demo server introduces itself', info.serverInfo?.name === 'demo');
  ok('the demo server lists its tools', tools.some((tool) => tool.name === 'add'));
  ok('a tool call returns structured content', sum.structuredContent?.sum === 42);
  ok('an unknown method is refused with its code', refused);
  ok('every message is seen both ways', seen.includes('out') && seen.includes('in'));
}

// ---- files: kinds, names, sorting and a folder from a file input
{
  const { kindOf, freeName, nameProblem, sortNodes, fromFileList, pathOf } = await import('../js/lib/files.js');
  ok('kinds come from extensions', kindOf('photo.JPG') === 'image' && kindOf('main.rs') === 'code' && kindOf('Makefile') === 'code');
  ok('a free name counts up past taken ones', freeName('untitled folder', ['untitled folder', 'Untitled Folder 2']) === 'untitled folder 3');
  ok('a free name keeps the extension', freeName('notes.txt', ['notes.txt']) === 'notes 2.txt');
  ok('slashes are not allowed in names', Boolean(nameProblem('a/b')) && nameProblem('fine.txt') === null);
  ok('folders sort first and numbers sort naturally', sortNodes([{ kind: 'file', name: 'b10' }, { kind: 'directory', name: 'z' }, { kind: 'file', name: 'b9' }]).map((node) => node.name).join() === 'z,b9,b10');
  const fake = (path, size) => ({ name: path.split('/').pop(), webkitRelativePath: path, size, lastModified: 0 });
  const root = fromFileList([fake('site/index.html', 10), fake('site/css/app.css', 20), fake('site/css/print.css', 5)]);
  const top = await root.list();
  const css = top.find((node) => node.name === 'css');
  const inner = await css.list();
  ok('a file input becomes a read only tree', root.name === 'site' && !root.writable && top.length === 2 && inner.length === 2);
  ok('a path runs from the root down', pathOf(inner[0]).map((node) => node.name).join('/') === 'site/css/' + inner[0].name);
}

// ---- journeys: time saved, true averages and durations people type
{
  const { compareSpeeds, averageSpeed, formatHours, parseDuration, fuelFactor } = await import('../js/lib/journey.js');
  const trip = compareSpeeds({ distance: 300, from: 100, to: 120 });
  ok('300 km at 120 instead of 100 saves half an hour', Math.abs(trip.saved - 0.5) < 1e-9);
  ok('an hour at 120 instead of 100 buys ten minutes', Math.abs(trip.minutesPerHour - 10) < 1e-9);
  ok('faster driving uses more fuel', trip.fuelChange > 0 && fuelFactor(90) === 1);
  const mixed = averageSpeed([{ distance: 60, speed: 60 }, { distance: 60, speed: 120 }], 0.5);
  ok('the average speed is distance over time, not the mean of speeds', mixed.moving === 80 && mixed.naive === 90);
  ok('breaks lower the door to door average', Math.abs(mixed.overall - 60) < 1e-9);
  ok('hours are written to the minute', formatHours(2.727) === '2 h 44 min' && formatHours(0.25) === '15 min');
  ok('durations are read the ways people type them', parseDuration('2:30') === 2.5 && parseDuration('1h 15m') === 1.25 && parseDuration('45 min') === 0.75 && parseDuration('2h30') === 2.5);
}

// ---- git: inflate, objects, refs, history, diffs and the graph
{
  const { deflateSync, deflateRawSync } = await import('node:zlib');
  const { createHash } = await import('node:crypto');
  const { inflateZlib, inflateRaw } = await import('../js/lib/inflate.js');
  const git = await import('../js/lib/git.js');
  const sample = new TextEncoder().encode('the quick brown fox '.repeat(400) + 'jumps');
  const packed = deflateSync(sample);
  const joined = new Uint8Array(packed.length + 3);
  joined.set(packed);
  const { data, end } = inflateZlib(joined, 0, sample.length);
  ok('inflate matches zlib and stops at the end of the stream', Buffer.compare(Buffer.from(data), Buffer.from(sample)) === 0 && end === packed.length);
  ok('raw inflate reads stored blocks', new TextDecoder().decode(inflateRaw(deflateRawSync(Buffer.from('stored'), { level: 0 })).data) === 'stored');

  const files = {};
  const store = (type, body) => {
    const bytes = Buffer.concat([Buffer.from(`${type} ${body.length}\0`), Buffer.from(body)]);
    const sha = createHash('sha1').update(bytes).digest('hex');
    files[`.git/objects/${sha.slice(0, 2)}/${sha.slice(2)}`] = deflateSync(bytes);
    return sha;
  };
  const tree = (entries) => store('tree', Buffer.concat(entries.map(([mode, name, sha]) => Buffer.concat([Buffer.from(`${mode} ${name}\0`), Buffer.from(sha, 'hex')]))));
  const commit = (treeSha, parents, message, time) => store('commit', `tree ${treeSha}\n${parents.map((parent) => `parent ${parent}\n`).join('')}author Ada <ada@example.com> ${time} +0000\ncommitter Ada <ada@example.com> ${time} +0000\n\n${message}\n`);
  const one = store('blob', 'one\ntwo\nthree\n');
  const two = store('blob', 'one\n2\nthree\nfour\n');
  const root = commit(tree([['100644', 'a.txt', one]]), [], 'Start', 1000);
  const side = commit(tree([['100644', 'a.txt', one], ['100644', 'b.txt', one]]), [root], 'Side', 1000);
  const main = commit(tree([['100644', 'a.txt', two]]), [root], 'Main', 1000);
  const merge = commit(tree([['100644', 'a.txt', two], ['100644', 'b.txt', one]]), [main, side], 'Merge', 1000);
  files['.git/HEAD'] = 'ref: refs/heads/main\n';
  files['.git/refs/heads/main'] = `${merge}\n`;
  files['.git/packed-refs'] = `# pack-refs with: peeled\n${side} refs/heads/side\n`;
  files['.git/objects/info/packs'] = '';
  const repo = await git.openRepository(git.memoryReader(files));
  const head = await repo.head();
  const refs = await repo.refs();
  const { commits } = await repo.log({ from: [head.sha, ...refs.map((ref) => ref.commit)] });
  ok('HEAD resolves through its branch', head.ref === 'refs/heads/main' && head.sha === merge);
  ok('loose and packed refs are both listed', refs.map((ref) => ref.short).join() === 'main,side');
  const place = new Map(commits.map((item, index) => [item.sha, index]));
  ok('history lists children before parents even when times tie', commits.length === 4 && commits.every((item) => item.parents.every((parent) => place.get(parent) > place.get(item.sha))));
  const layout = git.graphLayout(commits);
  ok('a merge opens a second lane and it closes again', layout.width === 2 && layout.rows[0].parents.length === 2 && layout.rows[3].after.length === 0);
  const changes = await repo.changes(merge);
  ok('a merge is compared with its first parent', changes.length === 1 && changes[0].path === 'b.txt' && changes[0].status === 'added');
  const ops = git.diffLines('one\ntwo\nthree\n', 'one\n2\nthree\nfour\n');
  ok('a line diff finds the changed and added lines', ops.map((op) => op.type[0]).join('') === 'srasa' || ops.filter((op) => op.type !== 'same').length === 3);
  ok('hunks carry line numbers', git.hunks(ops)[0].oldStart === 1 && git.hunks(ops)[0].newLines === 4);
  await repo.createRef('branch', 'feature/new', root);
  ok('a branch can be created at a commit', (await repo.resolve('feature/new')) === root);
  await repo.deleteRef('refs/heads/side');
  ok('a packed branch can be deleted', (await repo.refs()).every((ref) => ref.short !== 'side'));
  ok('bad branch names are refused', Boolean(git.refNameProblem('a..b')) && Boolean(git.refNameProblem('has space')) && git.refNameProblem('feature/ok') === null);
  ok('the id of a blob matches git', (await git.hashBlob(new TextEncoder().encode('one\ntwo\nthree\n'))) === one);
}

// ---- git insights: churn, bus factor, bug clusters, pace and firefighting
{
  const { analyseHistory, isNoisePath } = await import('../js/lib/git.js');
  const now = Date.UTC(2026, 8, 20) / 1000;
  const day = 86400;
  const commits = [];
  const add = (daysAgo, author, subject, files, merge = false) => commits.push({ sha: String(commits.length).padStart(40, '0'), subject, message: `${subject}\n`, author, email: '', time: now - daysAgo * day, zone: '+0000', merge, files });
  for (let index = 0; index < 30; index += 1) add(20 + index * 12, index % 5 ? 'Maya' : 'Omar', index % 3 ? 'Add a feature' : 'Fix the totals', ['src/billing.js', 'package-lock.json']);
  for (let index = 0; index < 8; index += 1) add(400 + index * 10, 'Lena', 'Build the first version', ['src/app.js']);
  add(30, 'Omar', 'Revert "Add a feature"', ['src/billing.js']);
  add(35, 'Omar', 'Merge branch fix', [], true);
  const insight = analyseHistory({ commits, now, anchor: now, idle: false }, {});
  ok('lockfiles are left out of churn unless asked for', insight.churn[0].path === 'src/billing.js' && insight.churn.every((file) => file.path !== 'package-lock.json'));
  ok('lockfiles come back when asked for', analyseHistory({ commits, now, anchor: now, idle: false }, { noise: true }).churn.some((file) => file.path === 'package-lock.json'));
  ok('a folder narrows the file lists', analyseHistory({ commits, now, anchor: now, idle: false }, { folder: 'lib' }).churn.length === 0);
  ok('files that churn and keep getting fixed are high risk', insight.risky.length === 1 && insight.risky[0].path === 'src/billing.js');
  ok('one person with most commits is a bus factor risk', insight.people.busFactorRisk && insight.people.contributors[0].name === 'Maya');
  ok('merges are left out of who built it', insight.people.total === 39);
  ok('a revert in the last year counts as firefighting', insight.firefighting.count === 1 && insight.firefighting.level === 'normal');
  ok('commits are counted by month without gaps', insight.pace.months.every((entry, index, list) => index === 0 || entry.month > list[index - 1].month));
  ok('noise paths are recognised', isNoisePath('web/yarn.lock') && isNoisePath('dist/app.min.js') && !isNoisePath('src/lock.js'));
}

// ---- app icons: every app is drawn, and every paint a drawing uses exists
{
  const { appArt, artNames, figures } = await import('../js/lib/app-art.js');
  const { readdir, stat } = await import('node:fs/promises');
  const apps = [];
  for (const name of await readdir('js/apps')) {
    if ((await stat(`js/apps/${name}`)).isDirectory()) apps.push(name);
  }
  for (const id of apps) ok(`app ${id} has a drawn icon`, artNames.includes(id));
  for (const id of artNames) for (const dark of [false, true]) {
    const art = appArt(id, { dark });
    const defined = new Set([...art.matchAll(/id="@([\w-]+)"/g)].map((match) => match[1]));
    const missing = [...art.matchAll(/url\(#@([\w-]+)\)/g)].map((match) => match[1]).filter((name) => !defined.has(name));
    ok(`icon ${id}${dark ? ' in the dark' : ''} defines every paint it uses`, missing.length === 0, missing.join(', '));
    const opened = (art.match(/<(?!\/)[a-zA-Z][^>]*[^/]>/g) ?? []).length;
    const closed = (art.match(/<\/[a-zA-Z]+>/g) ?? []).length;
    ok(`icon ${id}${dark ? ' in the dark' : ''} closes every element it opens`, opened === closed, `${opened} opened, ${closed} closed`);
    ok(`icon ${id}${dark ? ' in the dark' : ''} leaves no numbers undrawn`, !/NaN|undefined/.test(art));
  }
  ok('figures lay out one path per digit', (figures('2048', 0, 0).match(/<path/g) ?? []).length === 4);
}

if (failures.length) {
  console.error(`library check failed with ${failures.length} problem${failures.length === 1 ? '' : 's'}:`);
  failures.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`libraries ok: ${pass} checks across chess move generation, optics, polygon clipping, writing and reading codes, tax, documents, bluetooth, page tools and app icons`);
