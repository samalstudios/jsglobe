export default {
  id: "text-stats",
  name: "Text Stats",
  tagline: "Counts, reading time and character analysis",
  category: "text",
  glyph: "∑",
  icon: "chart",
  tint: "#db2777",
  keywords: ["text","stats","count","words","characters","reading"],
  tag: "jg-app-text-stats",
  load: () => import('./index.js'),
};
