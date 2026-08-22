export default {
  id: "barcode-generator",
  name: "Barcode",
  tagline: "Code 128, EAN and Code 39 barcodes as SVG",
  category: "media",
  glyph: "|||",
  icon: "barcode",
  keywords: ["barcode","code128","ean","ean13","upc","code39","label","sku","retail"],
  tag: "jg-app-barcode-generator",
  window: {"width":820,"height":860},
  i18n: {
    de: { name: 'Barcode', tagline: 'Code 128, EAN und Code 39 als SVG' },
    es: { name: 'Código de barras', tagline: 'Códigos Code 128, EAN y Code 39 en SVG' },
    zh: { name: '条形码', tagline: '输出 SVG 格式的 Code 128、EAN 与 Code 39' },
  },
  load: () => import('./index.js'),
};
