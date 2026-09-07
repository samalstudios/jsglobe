export default {
  id: "base64-converter",
  name: "Base64",
  tagline: "Encode and decode text or files",
  category: "converter",
  glyph: "64",
  icon: "swap",
  tint: "#f59e0b",
  keywords: ["base64","encode","decode","atob","btoa","data uri"],
  tag: "jg-app-base64",
  load: () => import('./index.js'),
};
