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
  load: () => import('./index.js'),
};
