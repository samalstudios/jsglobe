export default {
  id: "text-encoder",
  name: "Text Encoder",
  tagline: "Binary, hex, unicode, NATO, morse and ROT13",
  category: "converter",
  glyph: "01",
  icon: "transform",
  tint: "#ea580c",
  keywords: ["binary","hex","unicode","nato","morse","rot13","escape","numeronym"],
  tag: "jg-app-text-encoder",
  load: () => import('./index.js'),
};
