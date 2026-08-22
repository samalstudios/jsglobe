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
  i18n: {
    de: { name: 'Memory', tagline: 'Karten umdrehen und die passenden Paare finden' },
    es: { name: 'Memoria', tagline: 'Voltear cartas y encontrar las parejas' },
    zh: { name: '记忆翻牌', tagline: '翻开卡片并找出配对' },
  },
  load: () => import('./index.js'),
};
