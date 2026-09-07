export default {
  id: "html-entities",
  name: "HTML Entities",
  tagline: "Escape and unescape HTML entities",
  category: "web",
  glyph: "&",
  icon: "ampersand",
  tint: "#0369a1",
  keywords: ["html","entities","escape","unescape","amp"],
  tag: "jg-app-html-entities",
  load: () => import('./index.js'),
};
