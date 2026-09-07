export default {
  id: "keycode-info",
  name: "Keycode Info",
  tagline: "Inspect keyboard events key by key",
  category: "web",
  glyph: "⌨",
  icon: "keyboard",
  tint: "#0e7490",
  keywords: ["key","keycode","keyboard","event","which"],
  tag: "jg-app-keycode",
  load: () => import('./index.js'),
};
