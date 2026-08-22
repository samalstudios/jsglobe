export default {
  id: "hmac-generator",
  name: "HMAC",
  tagline: "Keyed hash message authentication codes",
  category: "crypto",
  glyph: "H",
  icon: "key",
  tint: "#7c3aed",
  keywords: ["hmac","sign","secret","signature","sha"],
  tag: "jg-app-hmac",
  i18n: {
    de: { name: 'HMAC', tagline: 'Schlüsselbasierte Nachrichtenauthentifizierung' },
    es: { name: 'HMAC', tagline: 'Códigos de autenticación de mensajes con clave' },
    zh: { name: 'HMAC', tagline: '基于密钥的消息认证码' },
  },
  load: () => import('./index.js'),
};
