export default {
  id: "game-solitaire",
  name: "Solitaire",
  tagline: "Klondike patience with draw one or three",
  category: "play",
  glyph: "♠",
  icon: "card",
  tint: "#4f7f6b",
  keywords: ["game","solitaire","klondike","cards","patience","retro"],
  tag: "jg-app-game-solitaire",
  window: {"width":980,"height":800},
  i18n: {
    de: { name: 'Solitär', tagline: 'Klondike-Patience mit einer oder drei Karten' },
    es: { name: 'Solitario', tagline: 'Klondike con robo de una o tres cartas' },
    zh: { name: '纸牌', tagline: '每次翻一张或三张的克朗代克纸牌' },
  },
  load: () => import('./index.js'),
};
