export default {
  id: "currency-converter",
  name: "Currency",
  tagline: "Convert between currencies with daily rates",
  category: "converter",
  glyph: "€$",
  icon: "exchange",
  keywords: ["currency","exchange rate","forex","convert","money","eur","usd","bitcoin"],
  tag: "jg-app-currency-converter",
  widget: false,
  window: {"width":880,"height":800},
  load: () => import('./index.js'),
};
