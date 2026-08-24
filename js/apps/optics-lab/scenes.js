const SCENES = {
  focus: {
    name: 'Lens brings light to a focus',
    group: 'lenses',
    elements: [
      { kind: 'beam', x: -260, y: 0, angle: 0, width: 120, rays: 9 },
      { kind: 'lensIdeal', x: 0, y: 0, angle: 0, height: 160, focal: 150 },
      { kind: 'screen', x: 150, y: 0, angle: Math.PI / 2, height: 200 },
    ],
  },
  image: {
    name: 'Forming an image',
    group: 'lenses',
    elements: [
      { kind: 'point', x: -300, y: -60, angle: 0, spread: 0.42, rays: 9 },
      { kind: 'point', x: -300, y: 60, angle: 0, spread: 0.42, rays: 9 },
      { kind: 'lensIdeal', x: 0, y: 0, angle: 0, height: 200, focal: 120 },
      { kind: 'screen', x: 200, y: 0, angle: Math.PI / 2, height: 260 },
    ],
  },
  diverging: {
    name: 'A diverging lens',
    group: 'lenses',
    elements: [
      { kind: 'beam', x: -260, y: 0, angle: 0, width: 110, rays: 9 },
      { kind: 'lensIdeal', x: 0, y: 0, angle: 0, height: 150, focal: -110 },
    ],
  },
  glassLens: {
    name: 'A real glass lens',
    group: 'lenses',
    elements: [
      { kind: 'beam', x: -280, y: 0, angle: 0, width: 130, rays: 11 },
      { kind: 'lensGlass', x: 0, y: 0, angle: 0, height: 160, curve: 0.0035, index: 1.52 },
    ],
  },
  prism: {
    name: 'A prism splits white light',
    group: 'colour',
    elements: [
      { kind: 'white', x: -320, y: 80, angle: -0.52, rays: 1 },
      { kind: 'prism', x: 0, y: 0, angle: 0, size: 120, index: 1.52 },
      { kind: 'screen', x: 300, y: 60, angle: Math.PI / 2, height: 400 },
    ],
  },
  rainbow: {
    name: 'Light inside a raindrop',
    group: 'colour',
    elements: [
      { kind: 'white', x: -320, y: -40, angle: 0, rays: 1 },
      { kind: 'drop', x: 0, y: 0, angle: 0, radius: 110, index: 1.333 },
    ],
  },
  trapped: {
    name: 'Light trapped in glass',
    group: 'glass',
    elements: [
      { kind: 'laser', x: -300, y: 40, angle: -0.32 },
      { kind: 'block', x: 0, y: 0, angle: 0, width: 420, height: 90, index: 1.52 },
    ],
  },
  slab: {
    name: 'A slab shifts a ray sideways',
    group: 'glass',
    elements: [
      { kind: 'laser', x: -280, y: -70, angle: 0.42 },
      { kind: 'block', x: 0, y: 0, angle: 0, width: 140, height: 300, index: 1.52 },
    ],
  },
  dish: {
    name: 'A curved mirror focuses',
    group: 'mirrors',
    elements: [
      { kind: 'beam', x: -280, y: 0, angle: 0, width: 150, rays: 9 },
      { kind: 'mirrorConcave', x: 180, y: 0, angle: Math.PI, radius: 300, span: 1 },
    ],
  },
  periscope: {
    name: 'Periscope',
    group: 'mirrors',
    elements: [
      { kind: 'beam', x: -320, y: -120, angle: 0, width: 60, rays: 5 },
      { kind: 'mirrorPlane', x: 0, y: -120, angle: (Math.PI * 5) / 4, length: 130 },
      { kind: 'mirrorPlane', x: 0, y: 120, angle: Math.PI / 4, length: 130 },
      { kind: 'screen', x: 300, y: 120, angle: Math.PI / 2, height: 200 },
    ],
  },
  telescope: {
    name: 'Telescope',
    group: 'instruments',
    elements: [
      { kind: 'beam', x: -340, y: 0, angle: 0, width: 150, rays: 9 },
      { kind: 'lensIdeal', x: -120, y: 0, angle: 0, height: 180, focal: 200 },
      { kind: 'lensIdeal', x: 140, y: 0, angle: 0, height: 90, focal: 60 },
      { kind: 'screen', x: 340, y: 0, angle: Math.PI / 2, height: 220 },
    ],
  },
  pinhole: {
    name: 'Pinhole camera',
    group: 'instruments',
    elements: [
      { kind: 'point', x: -300, y: -90, angle: 0, spread: 0.7, rays: 13 },
      { kind: 'point', x: -300, y: 90, angle: 0, spread: 0.7, rays: 13 },
      { kind: 'aperture', x: 0, y: 0, angle: Math.PI / 2, height: 320, gap: 14 },
      { kind: 'screen', x: 220, y: 0, angle: Math.PI / 2, height: 320 },
    ],
  },
};

export default SCENES;
