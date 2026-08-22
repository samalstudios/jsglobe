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
  i18n: {
    de: { name: 'Währung', tagline: 'Währungen mit Tageskursen umrechnen' },
    es: { name: 'Divisas', tagline: 'Convertir entre monedas con tipos diarios' },
    zh: { name: '汇率', tagline: '按每日汇率换算货币' },
  },
  load: () => import('./index.js'),
};
