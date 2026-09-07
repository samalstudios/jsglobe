export default {
  id: "case-converter",
  name: "Case Converter",
  tagline: "camelCase, snake_case, kebab-case and more",
  category: "converter",
  glyph: "aA",
  icon: "type",
  tint: "#d97706",
  keywords: ["case","camel","snake","kebab","pascal","title"],
  tag: "jg-app-case",
  load: () => import('./index.js'),
};
