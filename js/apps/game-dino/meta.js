export default {
  id: "game-dino",
  name: "T-Rex Run",
  tagline: "Jump the cacti in the offline runner",
  category: "play",
  glyph: "🦖",
  icon: "dino",
  tint: "#5b6470",
  keywords: ["game","dino","trex","runner","chrome","offline","retro","jump"],
  tag: "jg-app-game-dino",
  window: {"width":1120,"height":560},
  load: () => import('./index.js'),
};
