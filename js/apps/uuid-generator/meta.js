export default {
  id: "uuid-generator",
  name: "UUID",
  tagline: "Generate v4 and v7 identifiers in bulk",
  category: "utility",
  glyph: "ID",
  icon: "fingerprint",
  tint: "#64748b",
  keywords: ["uuid","guid","id","random","v4","v7","ulid"],
  tag: "jg-app-uuid",
  widget: true,
  i18n: {
    de: { name: 'UUID', tagline: 'v4- und v7-Kennungen in großer Zahl erzeugen' },
    es: { name: 'UUID', tagline: 'Generar identificadores v4 y v7 en lote' },
    zh: { name: 'UUID', tagline: '批量生成 v4 与 v7 标识符' },
  },
  load: () => import('./index.js'),
};
