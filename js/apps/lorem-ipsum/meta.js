export default {
  id: "lorem-ipsum",
  name: "Lorem Ipsum",
  tagline: "Placeholder copy in words, sentences or lists",
  category: "text",
  glyph: "L",
  icon: "alignLeft",
  tint: "#ec4899",
  keywords: ["lorem","ipsum","placeholder","dummy","text"],
  tag: "jg-app-lorem",
  load: () => import('./index.js'),
};
