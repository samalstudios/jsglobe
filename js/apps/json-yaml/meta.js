export default {
  id: "json-yaml",
  name: "JSON ⇄ YAML",
  tagline: "Convert between JSON and YAML documents",
  category: "converter",
  glyph: "Y",
  icon: "swap",
  tint: "#f59e0b",
  keywords: ["yaml","json","convert","config"],
  tag: "jg-app-json-yaml",
  load: () => import('./index.js'),
};
