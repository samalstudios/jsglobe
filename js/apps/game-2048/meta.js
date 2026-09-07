export default {
  id: "game-2048",
  name: "2048",
  tagline: "Slide and merge tiles to reach 2048",
  category: "play",
  glyph: "2048",
  icon: "blocks",
  tint: "#eab308",
  keywords: ["game","2048","puzzle","tiles","merge"],
  tag: "jg-app-game-2048",
  window: {"width":660,"height":880},
  load: () => import('./index.js'),
};
