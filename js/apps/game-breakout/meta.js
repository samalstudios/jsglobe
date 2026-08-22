export default {
  id: "game-breakout",
  name: "Breakout",
  tagline: "Bounce the ball and clear every brick",
  category: "play",
  glyph: "▚",
  icon: "blocks",
  tint: "#c2603f",
  keywords: ["game","breakout","arcade","retro","paddle","brick"],
  tag: "jg-app-game-breakout",
  window: {"width":980,"height":820},
  i18n: {
    de: { name: 'Breakout', tagline: 'Den Ball zurückspielen und alle Steine räumen' },
    es: { name: 'Breakout', tagline: 'Devolver la bola y romper todos los ladrillos' },
    zh: { name: '打砖块', tagline: '接住小球并击碎每一块砖' },
  },
  load: () => import('./index.js'),
};
