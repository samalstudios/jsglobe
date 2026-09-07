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
  load: () => import('./index.js'),
};
