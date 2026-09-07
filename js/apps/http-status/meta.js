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
  load: () => import('./index.js'),
};
