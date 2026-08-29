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
  i18n: {
    de: { name: 'Münzwurf', tagline: 'Eine Münze werfen und zusehen, wie sich die Quote einpendelt' },
    es: { name: 'Lanzador de monedas', tagline: 'Lanza una moneda y observa cómo se equilibra la probabilidad' },
    zh: { name: '抛硬币', tagline: '抛出硬币，看概率如何趋于均衡' },
  },
  load: () => import('./index.js'),
};
