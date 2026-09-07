export default {
  id: "text-diff",
  name: "Text Diff",
  tagline: "Compare two texts line by line",
  category: "text",
  glyph: "±",
  icon: "compare",
  tint: "#be185d",
  keywords: ["diff","compare","changes","merge"],
  tag: "jg-app-text-diff",
  load: () => import('./index.js'),
};
