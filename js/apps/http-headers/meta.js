export default {
  id: "http-headers",
  name: "Header Review",
  tagline: "Grade response headers for security and privacy",
  category: "web",
  glyph: "H",
  icon: "headers",
  keywords: ["http","headers","security","csp","hsts","cookies","audit","response"],
  tag: "jg-app-http-headers",
  window: {"width":1120,"height":840},
  i18n: {
    de: { name: 'Header-Prüfung', tagline: 'Antwort-Header auf Sicherheit und Datenschutz bewerten' },
    es: { name: 'Revisión de cabeceras', tagline: 'Evaluar cabeceras de respuesta en seguridad y privacidad' },
    zh: { name: '响应头检查', tagline: '从安全与隐私角度给响应头评分' },
  },
  load: () => import('./index.js'),
};
