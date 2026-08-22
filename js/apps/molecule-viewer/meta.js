export default {
  id: "molecule-viewer",
  name: "Molecule Viewer",
  tagline: "Vitamins, drugs and famous molecules in 3D",
  category: "science",
  glyph: "Mo",
  icon: "molecule",
  tint: "#4a7a8c",
  keywords: ["molecule","3d","chemistry","vitamin","protein","dna","structure","science"],
  tag: "jg-app-molecule-viewer",
  widget: true,
  window: {"width":1020,"height":780,"maximized":true},
  i18n: {
    de: { name: 'Molekülbetrachter', tagline: 'Vitamine, Wirkstoffe und berühmte Moleküle in 3D' },
    es: { name: 'Visor de moléculas', tagline: 'Vitaminas, fármacos y moléculas famosas en 3D' },
    zh: { name: '分子查看器', tagline: '以 3D 呈现维生素、药物与著名分子' },
  },
  load: () => import('./index.js'),
};
