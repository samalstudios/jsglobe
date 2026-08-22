export default {
  id: "otp-generator",
  name: "TOTP",
  tagline: "Time based one-time passwords from a secret",
  category: "crypto",
  glyph: "⏲",
  icon: "timer",
  tint: "#9333ea",
  keywords: ["otp","totp","2fa","mfa","authenticator"],
  tag: "jg-app-otp",
  widget: true,
  i18n: {
    de: { name: 'TOTP', tagline: 'Zeitbasierte Einmalpasswörter aus einem Secret' },
    es: { name: 'TOTP', tagline: 'Contraseñas de un solo uso basadas en tiempo' },
    zh: { name: 'TOTP', tagline: '由密钥生成基于时间的一次性密码' },
  },
  load: () => import('./index.js'),
};
