export default {
  id: "basic-auth",
  name: "Basic Auth",
  tagline: "Build Authorization headers from credentials",
  category: "crypto",
  glyph: "Aa",
  icon: "user",
  tint: "#7e22ce",
  keywords: ["basic","auth","header","authorization","base64"],
  tag: "jg-app-basic-auth",
  load: () => import('./index.js'),
};
