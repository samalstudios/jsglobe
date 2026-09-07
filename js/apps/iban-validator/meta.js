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
  load: () => import('./index.js'),
};
