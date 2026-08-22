export default {
  id: "basic-auth",
  name: "Basic Auth",
  tagline: "Build Authorization headers from credentials",
  category: "crypto",
  glyph: "Aa",
  icon: "user",
  tint: "#7e22ce",
  keywords: ["basic","auth","header","authorization","base64"],
  tag: "jg-app-basic-auth",
  i18n: {
    de: { name: 'Basic Auth', tagline: 'Authorization-Header aus Zugangsdaten erzeugen' },
    es: { name: 'Basic Auth', tagline: 'Crear cabeceras Authorization a partir de credenciales' },
    zh: { name: 'Basic Auth', tagline: '用凭据构建 Authorization 头' },
  },
  load: () => import('./index.js'),
};
