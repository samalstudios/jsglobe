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
  load: () => import('./index.js'),
};
