export default {
  id: "api-spec",
  name: "API Spec Editor",
  tagline: "Edit and check OpenAPI documents",
  category: "development",
  glyph: "API",
  icon: "spec",
  keywords: ["openapi","swagger","api","spec","rest","yaml","schema","lint"],
  tag: "jg-app-api-spec",
  window: {"width":1120,"height":860},
  load: () => import('./index.js'),
};
