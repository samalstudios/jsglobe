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
  load: () => import('./index.js'),
};
