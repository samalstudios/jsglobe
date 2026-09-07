export default {
  id: "json-schema",
  name: "JSON Schema",
  tagline: "Infer a schema from samples and validate documents",
  category: "development",
  glyph: "JS",
  icon: "schema",
  keywords: ["json schema","validate","infer","draft","contract","api"],
  tag: "jg-app-json-schema",
  window: {"width":1100,"height":840},
  load: () => import('./index.js'),
};
