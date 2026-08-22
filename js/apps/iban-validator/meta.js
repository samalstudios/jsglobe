export default {
  id: "iban-validator",
  name: "IBAN Validator",
  tagline: "Check bank account numbers and read their parts",
  category: "utility",
  glyph: "IB",
  icon: "bank",
  keywords: ["iban","bank","account","sepa","validate","check digits","bic"],
  tag: "jg-app-iban-validator",
  window: {"width":720,"height":720},
  i18n: {
    de: { name: 'IBAN-Prüfung', tagline: 'Bankkontonummern prüfen und ihre Teile lesen' },
    es: { name: 'Validador de IBAN', tagline: 'Comprobar números de cuenta y leer sus partes' },
    zh: { name: 'IBAN 校验', tagline: '校验银行账号并解读其组成' },
  },
  load: () => import('./index.js'),
};
