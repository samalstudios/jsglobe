export default {
  id: "json-diff",
  name: "JSON Diff",
  tagline: "Compare two JSON documents key by key",
  category: "development",
  glyph: "Δ",
  icon: "gitCompare",
  tint: "#16a34a",
  keywords: ["json","diff","compare","changes","merge"],
  tag: "jg-app-json-diff",
  load: () => import('./index.js'),
};
