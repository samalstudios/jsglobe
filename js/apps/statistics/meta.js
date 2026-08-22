export default {
  id: "statistics",
  name: "Statistics",
  tagline: "Summary, histogram and box plot for a set of numbers",
  category: "math",
  glyph: "σ",
  icon: "chart",
  keywords: ["statistics","mean","median","standard deviation","quartile","histogram","box plot"],
  tag: "jg-app-statistics",
  window: {"width":1060,"height":860},
  i18n: {
    de: { name: 'Statistik', tagline: 'Kennzahlen, Histogramm und Boxplot für Zahlenreihen' },
    es: { name: 'Estadística', tagline: 'Resumen, histograma y diagrama de caja de un conjunto de números' },
    zh: { name: '统计', tagline: '一组数字的概要、直方图与箱线图' },
  },
  load: () => import('./index.js'),
};
