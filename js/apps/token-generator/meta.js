export default {
  id: "token-generator",
  name: "Token Generator",
  tagline: "Strong random passwords and API tokens",
  category: "crypto",
  glyph: "⁂",
  icon: "asterisk",
  tint: "#a855f7",
  keywords: ["password","token","random","secret","entropy"],
  tag: "jg-app-token",
  widget: true,
  i18n: {
    de: { name: 'Token-Generator', tagline: 'Starke Zufallspasswörter und API-Tokens' },
    es: { name: 'Generador de tokens', tagline: 'Contraseñas aleatorias y tokens de API seguros' },
    zh: { name: '令牌生成器', tagline: '高强度随机密码与 API 令牌' },
  },
  load: () => import('./index.js'),
};
