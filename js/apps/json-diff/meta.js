export default {
  id: "json-diff",
  name: "JSON Diff",
  tagline: "Compare two JSON documents key by key",
  category: "development",
  glyph: "Δ",
  icon: "gitCompare",
  tint: "#16a34a",
  keywords: ["json","diff","compare","changes","merge"],
  tag: "jg-app-json-diff",
  i18n: {
    de: { name: 'JSON-Vergleich', tagline: 'Zwei JSON-Dokumente Schlüssel für Schlüssel vergleichen' },
    es: { name: 'Comparador JSON', tagline: 'Comparar dos documentos JSON clave por clave' },
    zh: { name: 'JSON 比较', tagline: '逐键比较两份 JSON 文档' },
  },
  load: () => import('./index.js'),
};
