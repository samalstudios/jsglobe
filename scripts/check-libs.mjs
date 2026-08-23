// Correctness suites for the libraries whose output can be checked against
// something outside this codebase: published perft counts, the laws of optics,
// and polygon areas that can be worked out by hand.
import { parseFen, perft, START_FEN } from '../js/lib/chess.js';
import {
  traceRay, refract, criticalAngle, glassBlock, prism, planeMirror, curvedMirror,
  idealLens, beamRays, indexAt, minimumDeviation, thinLensImage,
} from '../js/lib/optics.js';
import { clipPolygons, polygonArea } from '../js/lib/clip.js';

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
  close('optics mirror reflects at the same angle', Math.abs(deg(Math.atan2(-leg.y, leg.x))), 45);

  const radius = 200;
  const dish = curvedMirror(0, 0, radius, rad(50), 0, true);
  const axisCross = [];
  for (const ray of beamRays(-300, 0, 40, 0, 5)) {
    const { path } = traceRay({ surfaces: dish }, ray, { bounces: 3, reach: 2000 });
    if (path.length < 3) continue;
    const [, a, b] = path;
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

if (failures.length) {
  console.error(`library check failed with ${failures.length} problem${failures.length === 1 ? '' : 's'}:`);
  failures.forEach((problem) => console.error(`  - ${problem}`));
  process.exit(1);
}

console.log(`libraries ok: ${pass} checks across chess move generation, optics and polygon clipping`);
