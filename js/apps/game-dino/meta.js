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
  i18n: {
    de: { name: 'T-Rex-Lauf', tagline: 'Im Offline-Runner über die Kakteen springen' },
    es: { name: 'Carrera del T-Rex', tagline: 'Saltar los cactus en el corredor sin conexión' },
    zh: { name: '恐龙快跑', tagline: '在离线小游戏里跃过仙人掌' },
  },
  load: () => import('./index.js'),
};
