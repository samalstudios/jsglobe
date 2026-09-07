export default {
  id: "svg-editor",
  name: "SVG Studio",
  tagline: "View, clean, recolour and export SVG",
  category: "media",
  glyph: "SVG",
  icon: "vector",
  tint: "#e11d48",
  keywords: ["svg","vector","viewer","editor","optimise","optimize","icon","minify","png"],
  tag: "jg-app-svg-editor",
  window: {"width":1080,"height":860,"maximized":true},
  load: () => import('./index.js'),
};
