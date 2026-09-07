export default {
  id: "svg-placeholder",
  name: "Placeholder SVG",
  tagline: "Generate placeholder images as inline SVG",
  category: "media",
  glyph: "▢",
  icon: "frame",
  keywords: ["placeholder","svg","image","mockup","dummy","data uri"],
  tag: "jg-app-svg-placeholder",
  window: {"width":860,"height":900},
  load: () => import('./index.js'),
};
