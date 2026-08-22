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
  i18n: {
    de: { name: 'JSON-Formatierer', tagline: 'JSON formatieren, prüfen, minimieren und erkunden' },
    es: { name: 'Formateador JSON', tagline: 'Formatear, validar, minificar y explorar JSON' },
    zh: { name: 'JSON 格式化', tagline: '格式化、校验、压缩并浏览 JSON' },
  },
  load: () => import('./index.js'),
};
