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
  load: () => import('./index.js'),
};
