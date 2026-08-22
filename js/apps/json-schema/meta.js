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
  i18n: {
    de: { name: 'JSON-Schema', tagline: 'Schema aus Beispielen ableiten und Dokumente prüfen' },
    es: { name: 'Esquema JSON', tagline: 'Inferir un esquema desde ejemplos y validar documentos' },
    zh: { name: 'JSON Schema', tagline: '从样例推断 schema 并校验文档' },
  },
  load: () => import('./index.js'),
};
