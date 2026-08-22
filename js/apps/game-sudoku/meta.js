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
  i18n: {
    de: { name: 'Sudoku', tagline: 'Erzeugte Rätsel mit Notizen und Hinweisen' },
    es: { name: 'Sudoku', tagline: 'Rompecabezas generados con notas y pistas' },
    zh: { name: '数独', tagline: '自动生成的谜题，支持笔记与提示' },
  },
  load: () => import('./index.js'),
};
