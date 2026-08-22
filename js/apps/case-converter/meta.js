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
  i18n: {
    de: { name: 'Schreibweise', tagline: 'camelCase, snake_case, kebab-case und mehr' },
    es: { name: 'Conversor de mayúsculas', tagline: 'camelCase, snake_case, kebab-case y más' },
    zh: { name: '大小写转换', tagline: 'camelCase、snake_case、kebab-case 等' },
  },
  load: () => import('./index.js'),
};
