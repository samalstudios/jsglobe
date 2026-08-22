export default {
  id: "game-tetris",
  name: "Blocks",
  tagline: "Stack falling pieces and clear lines",
  category: "play",
  glyph: "▦",
  icon: "tetris",
  keywords: ["tetris","blocks","falling","lines","game","arcade"],
  tag: "jg-app-game-tetris",
  window: {"width":720,"height":860},
  i18n: {
    de: { name: 'Blöcke', tagline: 'Fallende Steine stapeln und Reihen räumen' },
    es: { name: 'Bloques', tagline: 'Apilar piezas que caen y limpiar líneas' },
    zh: { name: '方块', tagline: '堆叠下落的方块并消除整行' },
  },
  load: () => import('./index.js'),
};
