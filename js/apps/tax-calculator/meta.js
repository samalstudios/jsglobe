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
  i18n: {
    de: { name: 'Steuerrechner', tagline: 'Nettogehalt nach Steuern in 23 Ländern, vollständig auf deinem Gerät' },
    es: { name: 'Calculadora de impuestos', tagline: 'Calcula el sueldo neto tras impuestos en 23 países, todo en tu dispositivo' },
    zh: { name: '税费计算器', tagline: '计算 23 个国家的税后净收入，全部在本机完成' },
  },
  load: () => import('./index.js'),
};
