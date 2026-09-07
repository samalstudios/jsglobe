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
  load: () => import('./index.js'),
};
