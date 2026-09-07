export default {
  id: "screenshot",
  name: "Screenshot Studio",
  tagline: "Capture, annotate, blur and compare screenshots",
  category: "media",
  glyph: "⌗",
  icon: "screenshot",
  tint: "#e11d48",
  keywords: ["screenshot","capture","annotate","blur","redact","crop","arrow","before after"],
  tag: "jg-app-screenshot",
  window: {"width":1080,"height":900},
  load: () => import('./index.js'),
};
