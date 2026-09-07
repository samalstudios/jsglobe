export default {
  id: "tax-calculator",
  name: "Tax Calculator",
  tagline: "Work out net pay after tax in 23 countries, entirely on your device",
  category: "utility",
  glyph: "€",
  icon: "calculator",
  tint: "#4a7cc4",
  keywords: ["tax", "salary", "income", "net", "take home", "paye", "payroll", "brutto", "netto", "calculator"],
  tag: "jg-app-tax-calculator",
  window: { width: 1060, height: 780 },
  load: () => import('./index.js'),
};
