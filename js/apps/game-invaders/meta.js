export default {
  id: "game-invaders",
  name: "Invaders",
  tagline: "Hold the line against descending waves",
  category: "play",
  glyph: "👾",
  icon: "joystick",
  tint: "#6f5a9c",
  keywords: ["game","invaders","space","arcade","retro","shooter"],
  tag: "jg-app-game-invaders",
  window: {"width":1020,"height":820},
  load: () => import('./index.js'),
};
