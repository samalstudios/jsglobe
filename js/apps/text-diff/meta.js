export default {
  id: "text-diff",
  name: "Text Diff",
  tagline: "Compare two texts line by line",
  category: "text",
  glyph: "±",
  icon: "compare",
  tint: "#be185d",
  keywords: ["diff","compare","changes","merge"],
  tag: "jg-app-text-diff",
  i18n: {
    de: { name: 'Textvergleich', tagline: 'Zwei Texte Zeile für Zeile vergleichen' },
    es: { name: 'Comparador de texto', tagline: 'Comparar dos textos línea por línea' },
    zh: { name: '文本比较', tagline: '逐行比较两段文本' },
  },
  load: () => import('./index.js'),
};
