export default {
  id: "game-pong",
  name: "Pong",
  tagline: "The original paddle duel against the machine",
  category: "play",
  glyph: "|",
  icon: "compare",
  tint: "#4a6fa5",
  keywords: ["game","pong","arcade","retro","paddle","tennis"],
  tag: "jg-app-game-pong",
  window: {"width":1040,"height":720},
  i18n: {
    de: { name: 'Pong', tagline: 'Das originale Schlägerduell gegen die Maschine' },
    es: { name: 'Pong', tagline: 'El duelo de palas original contra la máquina' },
    zh: { name: 'Pong', tagline: '与机器对决的经典球拍游戏' },
  },
  load: () => import('./index.js'),
};
