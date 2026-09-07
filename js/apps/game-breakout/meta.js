export default {
  id: "game-breakout",
  name: "Breakout",
  tagline: "Bounce the ball and clear every brick",
  category: "play",
  glyph: "▚",
  icon: "blocks",
  tint: "#c2603f",
  keywords: ["game","breakout","arcade","retro","paddle","brick"],
  tag: "jg-app-game-breakout",
  window: {"width":980,"height":820},
  load: () => import('./index.js'),
};
