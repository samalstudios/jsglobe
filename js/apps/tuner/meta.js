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
  i18n: {
    de: { name: 'Stimmgerät', tagline: 'Gitarre, Bass oder Ukulele nach Gehör oder Mikrofon stimmen' },
    es: { name: 'Afinador', tagline: 'Afinar guitarra, bajo o ukelele de oído o por micrófono' },
    zh: { name: '调音器', tagline: '用耳朵或麦克风为吉他、贝斯或尤克里里调音' },
  },
  load: () => import('./index.js'),
};
