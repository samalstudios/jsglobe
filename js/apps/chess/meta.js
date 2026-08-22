export default {
  id: "chess",
  name: "Chess",
  tagline: "Play the computer, learn the openings and train tactics",
  category: "play",
  glyph: "♞",
  icon: "knight",
  tint: "#6b7280",
  keywords: ["chess", "board", "openings", "tactics", "puzzle", "engine", "training"],
  tag: "jg-app-chess",
  window: { width: 1080, height: 760 },
  i18n: {
    de: { name: 'Schach', tagline: 'Gegen den Computer spielen, Eröffnungen lernen und Taktik üben' },
    es: { name: 'Ajedrez', tagline: 'Juega contra el ordenador, aprende aperturas y entrena táctica' },
    zh: { name: '国际象棋', tagline: '与电脑对弈、学习开局并训练战术' },
  },
  load: () => import('./index.js'),
};
