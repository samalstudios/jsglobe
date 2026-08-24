// The platform library.
//
// Everything here is app agnostic: no module below reaches into js/apps or
// js/ui, so any app can use any of it without dragging another app along.
// Import from this file rather than from js/lib directly, so the paths inside
// can move without touching every app:
//
//   import { physics, qr, chess } from '../../platform.js';
//   const world = physics.createWorld();
//
// A single domain can also be pulled in on its own, which keeps the bundle a
// browser has to fetch down to what an app actually uses:
//
//   import { createWorld } from '../../lib/physics.js';

// ---- simulation ------------------------------------------------------
export * as physics from './lib/physics.js';
export * as logic from './lib/logic.js';
export * as circuit from './lib/circuit.js';
export * as optics from './lib/optics.js';

// ---- geometry --------------------------------------------------------
export * as clip from './lib/clip.js';
export * as svgShapes from './lib/svg-shapes.js';

// ---- drawing ---------------------------------------------------------
export * as glyphs from './lib/glyphs.js';
export * as iconParts from './lib/icon-parts.js';
export * as iconCompose from './lib/icon-compose.js';
export * as poster from './lib/poster.js';
export * as palette from './lib/palette.js';
export * as molecule3d from './lib/gl-molecule.js';

// ---- codes -----------------------------------------------------------
export * as tax from './lib/tax.js';
export * as taxCountries from './lib/tax-countries.js';
export * as qr from './lib/qr.js';
export * as qrDecode from './lib/qr-decode.js';
export * as barcode from './lib/barcode.js';
export * as md5 from './lib/md5.js';
export * as sshKeys from './lib/ssh-keys.js';

// ---- games -----------------------------------------------------------
export * as chess from './lib/chess.js';
export * as chessAi from './lib/chess-ai.js';
export * as chessEngine from './lib/chess-engine.js';
export * as chessOpenings from './lib/chess-openings.js';

// ---- reference data --------------------------------------------------
export * as elements from './lib/elements.js';
export * as molecules from './lib/molecules.js';
export * as holidays from './lib/holidays.js';

// ---- formats ---------------------------------------------------------
export * as composeK8s from './lib/compose-k8s.js';

// ---- storage ---------------------------------------------------------
export * as designs from './lib/designs.js';

// What each domain offers, so an app author can see the surface without
// opening every file. Kept beside the exports on purpose: a domain added
// above without a line here shows up as a gap in the platform check.
export const SURFACE = {
  physics: 'Rigid body simulation: bodies, pins, rods, springs, jacks, motors, gears, collision and joint solving.',
  logic: 'Digital logic: gates, flip flops, counters, decoders, multiplexers and displays over a net list.',
  circuit: 'Analogue circuits: modified nodal analysis with diodes, transistors and time stepping.',
  optics: 'Ray tracing in two dimensions: refraction, reflection, total internal reflection and dispersion.',
  clip: 'Polygon booleans: union, subtract and intersect, with exact vertices.',
  svgShapes: 'Read an SVG into simplified outlines that a solver can use.',
  glyphs: 'The drawn icon outlines as data, on a 24 by 24 grid.',
  iconParts: 'Thousands of generated icon parts from parametric families, searchable and grouped.',
  iconCompose: 'Turn words into a stack of icon parts, with a model or without one.',
  poster: 'Poster canvases, themes, frames and the gallery of designs.',
  palette: 'Colour scales, harmonies and contrast.',
  molecule3d: 'Draw molecules in 3D on a canvas.',
  tax: 'Progressive bands, ceilings and tapers for working out tax.',
  taxCountries: 'Take-home pay models for twenty three countries.',
  qr: 'QR codes as matrices, ready to draw.',
  qrDecode: 'Read a QR code from a picture, repairing damage as a scanner does.',
  barcode: 'Draw and read the common bar codes: EAN, UPC, Code 128, Code 39 and ITF.',
  md5: 'MD5 digests.',
  sshKeys: 'Generate and read OpenSSH keys.',
  chess: 'Chess rules: move generation, check, mate, FEN and SAN.',
  chessAi: 'Chess search and evaluation, with a move judge for coaching.',
  chessEngine: 'Runs the chess search in a worker so a long think never freezes the page.',
  chessOpenings: 'Opening lines with the idea behind each, and a short course.',
  elements: 'The periodic table with full properties.',
  molecules: 'Molecule structures with atoms and bonds.',
  holidays: 'Public holidays by country and year.',
  composeK8s: 'Turn a compose file into Kubernetes manifests.',
  designs: 'Named document storage per app, with import and export.',
};
