export default {
  id: "tuner",
  name: "Tuner",
  tagline: "Tune a guitar, bass or ukulele by ear or mic",
  category: "play",
  glyph: "♩",
  icon: "tuning",
  tint: "#d97706",
  keywords: ["tuner","guitar","bass","ukulele","pitch","tune","strings","music"],
  tag: "jg-app-tuner",
  window: {"width":700,"height":780},
  load: () => import('./index.js'),
};
