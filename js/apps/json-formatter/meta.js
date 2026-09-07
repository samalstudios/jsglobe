export default {
  id: "json-formatter",
  name: "JSON Formatter",
  tagline: "Format, validate, minify and explore JSON",
  category: "development",
  glyph: "{ }",
  icon: "braces",
  tint: "#22c55e",
  keywords: ["json","format","pretty","minify","validate","tree"],
  tag: "jg-app-json-formatter",
  load: () => import('./index.js'),
};
