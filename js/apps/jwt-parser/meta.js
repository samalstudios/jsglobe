export default {
  id: "jwt-parser",
  name: "JWT Parser",
  tagline: "Decode and inspect JSON Web Tokens",
  category: "web",
  glyph: "JWT",
  icon: "badge",
  tint: "#0891b2",
  keywords: ["jwt","token","jose","claims","decode"],
  tag: "jg-app-jwt",
  load: () => import('./index.js'),
};
