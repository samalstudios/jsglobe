export default {
  id: "game-snake",
  name: "Snake",
  tagline: "Eat, grow and do not bite yourself",
  category: "play",
  glyph: "~",
  icon: "snake",
  tint: "#ca8a04",
  keywords: ["game","snake","arcade","classic"],
  tag: "jg-app-game-snake",
  window: {"width":820,"height":940},
  i18n: {
    de: { name: 'Snake', tagline: 'Fressen, wachsen und sich nicht selbst beißen' },
    es: { name: 'Snake', tagline: 'Comer, crecer y no morderte a ti mismo' },
    zh: { name: '贪吃蛇', tagline: '进食、变长，别咬到自己' },
  },
  load: () => import('./index.js'),
};
