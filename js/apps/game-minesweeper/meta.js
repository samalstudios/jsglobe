export default {
  id: "game-minesweeper",
  name: "Minesweeper",
  tagline: "Clear the grid without hitting a mine",
  category: "play",
  glyph: "✱",
  icon: "bomb",
  tint: "#d97706",
  keywords: ["game","minesweeper","mines","puzzle","grid"],
  tag: "jg-app-game-minesweeper",
  window: {"width":940,"height":840},
  i18n: {
    de: { name: 'Minesweeper', tagline: 'Das Feld räumen, ohne eine Mine zu treffen' },
    es: { name: 'Buscaminas', tagline: 'Despejar la cuadrícula sin tocar una mina' },
    zh: { name: '扫雷', tagline: '清空雷区且不踩到地雷' },
  },
  load: () => import('./index.js'),
};
