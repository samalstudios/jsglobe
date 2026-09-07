export default {
  id: "game-pong",
  name: "Pong",
  tagline: "The original paddle duel against the machine",
  category: "play",
  glyph: "|",
  icon: "compare",
  tint: "#4a6fa5",
  keywords: ["game","pong","arcade","retro","paddle","tennis"],
  tag: "jg-app-game-pong",
  window: {"width":1040,"height":720},
  load: () => import('./index.js'),
};
