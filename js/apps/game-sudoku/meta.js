export default {
  id: "game-sudoku",
  name: "Sudoku",
  tagline: "Generated puzzles with notes and hints",
  category: "play",
  glyph: "9",
  icon: "sudoku",
  keywords: ["sudoku","puzzle","numbers","logic","game"],
  tag: "jg-app-game-sudoku",
  window: {"width":820,"height":820},
  load: () => import('./index.js'),
};
