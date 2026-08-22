export default {
  id: "list-converter",
  name: "List Converter",
  tagline: "Sort, dedupe, wrap and rejoin lists",
  category: "converter",
  glyph: "≡",
  icon: "list",
  tint: "#d97706",
  keywords: ["list","sort","dedupe","join","split","lines","csv"],
  tag: "jg-app-list-converter",
  i18n: {
    de: { name: 'Listen-Konverter', tagline: 'Listen sortieren, bereinigen, umbrechen und verbinden' },
    es: { name: 'Conversor de listas', tagline: 'Ordenar, quitar duplicados, envolver y unir listas' },
    zh: { name: '列表转换', tagline: '排序、去重、包装并重新拼接列表' },
  },
  load: () => import('./index.js'),
};
