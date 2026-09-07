export default {
  id: "pdf-studio",
  name: "PDF Studio",
  tagline: "Merge, split, rotate and convert PDFs",
  category: "converter",
  glyph: "P",
  icon: "file",
  tint: "#96703f",
  keywords: ["pdf","merge","split","rotate","convert","image","png","extract","text","combine"],
  tag: "jg-app-pdf-studio",
  window: {"width":1080,"height":800,"maximized":true},
  load: () => import('./index.js'),
};
