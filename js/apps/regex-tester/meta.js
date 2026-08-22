export default {
  id: "regex-tester",
  name: "Regex Tester",
  tagline: "Test patterns with live matches and groups",
  category: "development",
  glyph: ".*",
  icon: "regex",
  tint: "#059669",
  keywords: ["regex","regexp","pattern","match","test"],
  tag: "jg-app-regex",
  i18n: {
    de: { name: 'Regex-Tester', tagline: 'Muster mit Live-Treffern und Gruppen testen' },
    es: { name: 'Probador de regex', tagline: 'Probar patrones con coincidencias y grupos en vivo' },
    zh: { name: '正则测试', tagline: '实时查看匹配结果与分组' },
  },
  load: () => import('./index.js'),
};
