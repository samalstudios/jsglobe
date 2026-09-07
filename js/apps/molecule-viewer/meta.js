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
  load: () => import('./index.js'),
};
