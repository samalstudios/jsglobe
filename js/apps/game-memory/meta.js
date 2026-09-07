export default {
  id: "game-memory",
  name: "Memory",
  tagline: "Flip cards and find the matching pairs",
  category: "play",
  glyph: "⁇",
  icon: "cards",
  keywords: ["memory","pairs","cards","concentration","game"],
  tag: "jg-app-game-memory",
  window: {"width":760,"height":800},
  load: () => import('./index.js'),
};
