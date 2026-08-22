export default {
  id: "drum-kit",
  name: "Drum Kit",
  tagline: "Play pads and build a 16 step beat",
  category: "play",
  glyph: "🥁",
  icon: "drum",
  keywords: ["drum","kit","beat","sequencer","music","pads","rhythm"],
  tag: "jg-app-drum-kit",
  window: {"width":900,"height":820},
  i18n: {
    de: { name: 'Drumkit', tagline: 'Pads spielen und einen 16-Schritt-Beat bauen' },
    es: { name: 'Batería', tagline: 'Tocar pads y construir un ritmo de 16 pasos' },
    zh: { name: '架子鼓', tagline: '敲击鼓垫并编排 16 步节奏' },
  },
  load: () => import('./index.js'),
};
