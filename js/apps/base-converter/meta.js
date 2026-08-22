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
  i18n: {
    de: { name: 'Zahlensystem', tagline: 'Binär, oktal, dezimal, hexadezimal und jede Basis' },
    es: { name: 'Base numérica', tagline: 'Binario, octal, decimal, hexadecimal y cualquier base' },
    zh: { name: '进制转换', tagline: '二进制、八进制、十进制、十六进制与任意进制' },
  },
  load: () => import('./index.js'),
};
