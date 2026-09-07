export default {
  id: "icon-studio",
  name: "Icon Studio",
  tagline: "Build an icon from thousands of parts, or describe one",
  category: "media",
  glyph: "◈",
  icon: "swatches",
  tint: "#7c5cff",
  keywords: ["icon", "svg", "logo", "symbol", "design", "generator", "mark", "favicon"],
  tag: "jg-app-icon-studio",
  window: { width: 1120, height: 780 },
  load: () => import('./index.js'),
};
