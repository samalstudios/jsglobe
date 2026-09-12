export default {
  id: "png-outline",
  name: "PNG Outline",
  tagline: "Trace the outline of a picture into an SVG",
  category: "media",
  glyph: "SVG",
  icon: "vector",
  tint: "#0f766e",
  keywords: ["png","svg","outline","trace","vector","contour","silhouette","cut line","sticker","image to svg"],
  tag: "jg-app-png-outline",
  load: () => import('./index.js'),
};
