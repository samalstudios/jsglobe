export default {
  id: "slugify",
  name: "Slugify",
  tagline: "Turn any string into a clean URL slug",
  category: "web",
  glyph: "/",
  icon: "slug",
  tint: "#155e75",
  keywords: ["slug","url","seo","permalink"],
  tag: "jg-app-slugify",
  i18n: {
    de: { name: 'Slugify', tagline: 'Jeden Text in einen sauberen URL-Slug verwandeln' },
    es: { name: 'Slugify', tagline: 'Convertir cualquier texto en un slug de URL limpio' },
    zh: { name: 'Slugify', tagline: '把任意文本变成干净的 URL slug' },
  },
  load: () => import('./index.js'),
};
