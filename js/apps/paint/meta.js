export default {
  id: "paint",
  name: "Paint",
  tagline: "Pencil, shapes, fill and spray on a canvas",
  category: "media",
  glyph: "✎",
  icon: "bucket",
  tint: "#8a1c3b",
  keywords: ["paint","draw","canvas","pixel","sketch","bitmap","image"],
  tag: "jg-app-paint",
  window: {"width":1040,"height":760,"maximized":true},
  load: () => import('./index.js'),
};
