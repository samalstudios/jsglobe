export default {
  id: "password-strength",
  name: "Password Strength",
  tagline: "Entropy, weaknesses and time to crack",
  category: "crypto",
  glyph: "◍",
  icon: "gauge",
  tint: "#7c3aed",
  keywords: ["password","strength","entropy","crack","secure"],
  tag: "jg-app-password-strength",
  i18n: {
    de: { name: 'Passwortstärke', tagline: 'Entropie, Schwachstellen und Knackdauer' },
    es: { name: 'Fuerza de contraseña', tagline: 'Entropía, debilidades y tiempo para descifrarla' },
    zh: { name: '密码强度', tagline: '熵值、弱点与破解所需时间' },
  },
  load: () => import('./index.js'),
};
