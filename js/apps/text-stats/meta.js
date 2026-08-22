export default {
  id: "text-stats",
  name: "Text Stats",
  tagline: "Counts, reading time and character analysis",
  category: "text",
  glyph: "∑",
  icon: "chart",
  tint: "#db2777",
  keywords: ["text","stats","count","words","characters","reading"],
  tag: "jg-app-text-stats",
  i18n: {
    de: { name: 'Textstatistik', tagline: 'Zählungen, Lesezeit und Zeichenanalyse' },
    es: { name: 'Estadísticas de texto', tagline: 'Conteos, tiempo de lectura y análisis de caracteres' },
    zh: { name: '文本统计', tagline: '计数、阅读时间与字符分析' },
  },
  load: () => import('./index.js'),
};
