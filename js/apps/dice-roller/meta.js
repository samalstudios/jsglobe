export default {
  id: "dice-roller",
  name: "Dice Roller",
  tagline: "Roll any dice and see how the numbers fall",
  category: "play",
  glyph: "🎲",
  icon: "dice",
  tint: "#7c3aed",
  keywords: ["dice","d20","d6","roll","rpg","tabletop","random","probability"],
  tag: "jg-app-dice-roller",
  window: { width: 980, height: 800 },
  i18n: {
    de: { name: 'Würfelwurf', tagline: 'Beliebige Würfel werfen und sehen, wie sie fallen' },
    es: { name: 'Lanzador de dados', tagline: 'Tira cualquier dado y observa cómo caen los números' },
    zh: { name: '掷骰器', tagline: '投掷任意骰子并观察点数分布' },
  },
  load: () => import('./index.js'),
};
