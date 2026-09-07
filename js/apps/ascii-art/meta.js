export default {
  id: "ascii-art",
  name: "ASCII Art",
  tagline: "Text banners and image to ASCII conversion",
  category: "media",
  glyph: "A",
  icon: "ascii",
  keywords: ["ascii","art","banner","figlet","text","image","terminal"],
  tag: "jg-app-ascii-art",
  window: {"width":900,"height":860},
  load: () => import('./index.js'),
};
