export default {
  id: "http-status",
  name: "HTTP Status",
  tagline: "Searchable reference of HTTP status codes",
  category: "web",
  glyph: "200",
  icon: "activity",
  tint: "#38bdf8",
  keywords: ["http","status","code","reference","404","500"],
  tag: "jg-app-http-status",
  i18n: {
    de: { name: 'HTTP-Status', tagline: 'Durchsuchbare Referenz der HTTP-Statuscodes' },
    es: { name: 'Estados HTTP', tagline: 'Referencia de códigos de estado HTTP con búsqueda' },
    zh: { name: 'HTTP 状态码', tagline: '可搜索的 HTTP 状态码参考' },
  },
  load: () => import('./index.js'),
};
