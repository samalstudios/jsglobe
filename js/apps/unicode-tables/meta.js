export default {
  id: "unicode-tables",
  name: "Unicode Tables",
  tagline: "Browse Unicode blocks and inspect any character",
  category: "text",
  glyph: "U+",
  icon: "glyphs",
  keywords: ["unicode","character","code point","utf-8","entity","symbol","charmap"],
  tag: "jg-app-unicode-tables",
  window: {"width":920,"height":780},
  load: () => import('./index.js'),
};
