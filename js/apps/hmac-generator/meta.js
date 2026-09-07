export default {
  id: "hmac-generator",
  name: "HMAC",
  tagline: "Keyed hash message authentication codes",
  category: "crypto",
  glyph: "H",
  icon: "key",
  tint: "#7c3aed",
  keywords: ["hmac","sign","secret","signature","sha"],
  tag: "jg-app-hmac",
  load: () => import('./index.js'),
};
