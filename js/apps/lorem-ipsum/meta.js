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
  i18n: {
    de: { name: 'Lorem Ipsum', tagline: 'Blindtext als Wörter, Sätze oder Listen' },
    es: { name: 'Lorem Ipsum', tagline: 'Texto de relleno en palabras, frases o listas' },
    zh: { name: 'Lorem Ipsum', tagline: '按词、句或列表生成占位文本' },
  },
  load: () => import('./index.js'),
};
