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
  i18n: {
    de: { name: 'Unicode-Tabellen', tagline: 'Unicode-Blöcke durchsuchen und jedes Zeichen prüfen' },
    es: { name: 'Tablas Unicode', tagline: 'Explorar bloques Unicode e inspeccionar cualquier carácter' },
    zh: { name: 'Unicode 表', tagline: '浏览 Unicode 区块并查看任意字符' },
  },
  load: () => import('./index.js'),
};
