export default {
  id: "json-yaml",
  name: "JSON ⇄ YAML",
  tagline: "Convert between JSON and YAML documents",
  category: "converter",
  glyph: "Y",
  icon: "swap",
  tint: "#f59e0b",
  keywords: ["yaml","json","convert","config"],
  tag: "jg-app-json-yaml",
  i18n: {
    de: { name: 'JSON ⇄ YAML', tagline: 'Zwischen JSON- und YAML-Dokumenten umwandeln' },
    es: { name: 'JSON ⇄ YAML', tagline: 'Convertir entre documentos JSON y YAML' },
    zh: { name: 'JSON ⇄ YAML', tagline: '在 JSON 与 YAML 文档之间转换' },
  },
  load: () => import('./index.js'),
};
