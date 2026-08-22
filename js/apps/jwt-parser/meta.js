export default {
  id: "jwt-parser",
  name: "JWT Parser",
  tagline: "Decode and inspect JSON Web Tokens",
  category: "web",
  glyph: "JWT",
  icon: "badge",
  tint: "#0891b2",
  keywords: ["jwt","token","jose","claims","decode"],
  tag: "jg-app-jwt",
  i18n: {
    de: { name: 'JWT-Parser', tagline: 'JSON Web Tokens dekodieren und untersuchen' },
    es: { name: 'Analizador JWT', tagline: 'Decodificar e inspeccionar JSON Web Tokens' },
    zh: { name: 'JWT 解析', tagline: '解码并查看 JSON Web Token' },
  },
  load: () => import('./index.js'),
};
