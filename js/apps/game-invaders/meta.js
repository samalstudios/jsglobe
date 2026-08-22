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
  i18n: {
    de: { name: 'Invaders', tagline: 'Die Stellung gegen absteigende Wellen halten' },
    es: { name: 'Invaders', tagline: 'Aguantar la línea ante las oleadas que descienden' },
    zh: { name: '太空入侵者', tagline: '抵挡一波波下压的敌人' },
  },
  load: () => import('./index.js'),
};
