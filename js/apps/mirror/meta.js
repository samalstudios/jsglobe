export default {
  id: "mirror",
  name: "Mirror",
  tagline: "Camera mirror with an adjustable ring light",
  category: "media",
  glyph: "◲",
  icon: "mirror",
  tint: "#f43f5e",
  keywords: ["mirror","camera","webcam","ring light","selfie","makeup"],
  tag: "jg-app-mirror",
  window: { width: 980, height: 860, maximized: true },
  load: () => import('./index.js'),
};
