export default {
  id: "css-gradient",
  name: "Gradient Maker",
  tagline: "Build CSS gradients with draggable colour stops",
  category: "web",
  glyph: "▞",
  icon: "gradient",
  keywords: ["css","gradient","linear","radial","conic","background","colour","color"],
  tag: "jg-app-css-gradient",
  window: {"width":780,"height":860},
  load: () => import('./index.js'),
};
