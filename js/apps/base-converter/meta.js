export default {
  id: "base-converter",
  name: "Number Base",
  tagline: "Binary, octal, decimal, hex and any base",
  category: "converter",
  glyph: "01",
  icon: "binary",
  tint: "#b45309",
  keywords: ["binary","hex","octal","decimal","radix","base"],
  tag: "jg-app-base-converter",
  load: () => import('./index.js'),
};
