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
  load: () => import('./index.js'),
};
