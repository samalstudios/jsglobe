export default {
  id: "coin-flipper",
  name: "Coin Flipper",
  tagline: "Flip a coin and watch the odds even out",
  category: "play",
  glyph: "🪙",
  icon: "circle",
  tint: "#d97706",
  keywords: ["coin","flip","heads","tails","random","chance","probability","toss"],
  tag: "jg-app-coin-flipper",
  window: { width: 880, height: 760 },
  load: () => import('./index.js'),
};
