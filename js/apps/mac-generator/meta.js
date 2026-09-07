export default {
  id: "mac-generator",
  name: "MAC Address",
  tagline: "Generate and reformat MAC addresses",
  category: "network",
  glyph: "MAC",
  icon: "router",
  tint: "#0f766e",
  keywords: ["mac","address","ethernet","hardware","generate"],
  tag: "jg-app-mac",
  load: () => import('./index.js'),
};
