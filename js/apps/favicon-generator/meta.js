export default {
  id: "favicon-generator",
  name: "Favicon Maker",
  tagline: "Every icon size, an .ico and the manifest",
  category: "media",
  glyph: "★",
  icon: "favicon",
  keywords: ["favicon","icon","ico","apple touch","manifest","pwa","app icon"],
  tag: "jg-app-favicon-generator",
  window: {"width":1040,"height":860},
  load: () => import('./index.js'),
};
