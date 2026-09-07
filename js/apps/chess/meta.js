export default {
  id: "chess",
  name: "Chess",
  tagline: "Play the computer, learn the openings and train tactics",
  category: "play",
  glyph: "♞",
  icon: "knight",
  tint: "#6b7280",
  keywords: ["chess", "board", "openings", "tactics", "puzzle", "engine", "training"],
  tag: "jg-app-chess",
  window: { width: 1080, height: 760 },
  load: () => import('./index.js'),
};
