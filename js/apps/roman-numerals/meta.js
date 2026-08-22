export default {
  id: "roman-numerals",
  name: "Roman Numerals",
  tagline: "Convert numbers to and from Roman numerals",
  category: "converter",
  glyph: "IV",
  icon: "landmark",
  tint: "#c2410c",
  keywords: ["roman","numeral","number"],
  tag: "jg-app-roman",
  i18n: {
    de: { name: 'Römische Zahlen', tagline: 'Zahlen in römische Ziffern und zurück' },
    es: { name: 'Números romanos', tagline: 'Convertir números a numeración romana y al revés' },
    zh: { name: '罗马数字', tagline: '在数字与罗马数字之间转换' },
  },
  load: () => import('./index.js'),
};
