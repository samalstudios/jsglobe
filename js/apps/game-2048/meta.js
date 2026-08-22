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
  i18n: {
    de: { name: '2048', tagline: 'Kacheln schieben und zusammenführen bis 2048' },
    es: { name: '2048', tagline: 'Deslizar y fusionar fichas hasta llegar a 2048' },
    zh: { name: '2048', tagline: '滑动并合并方块，直到凑出 2048' },
  },
  load: () => import('./index.js'),
};
