export default {
  id: "url-encoder",
  name: "URL Encode",
  tagline: "Percent-encode and decode URL components",
  category: "web",
  glyph: "%",
  icon: "percent",
  tint: "#0ea5e9",
  keywords: ["url","encode","decode","percent","uri"],
  tag: "jg-app-url-encoder",
  load: () => import('./index.js'),
};
