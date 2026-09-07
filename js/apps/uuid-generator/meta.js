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
  load: () => import('./index.js'),
};
