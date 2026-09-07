export default {
  id: "periodic-table",
  name: "Periodic Table",
  tagline: "All 118 elements with full properties",
  category: "science",
  glyph: "H",
  icon: "element",
  tint: "#3f6b6b",
  keywords: ["element","chemistry","periodic","atomic","science","mendeleev"],
  tag: "jg-app-periodic-table",
  widget: true,
  window: {"width":1080,"height":860,"maximized":true},
  load: () => import('./index.js'),
};
