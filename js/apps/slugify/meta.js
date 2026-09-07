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
  load: () => import('./index.js'),
};
