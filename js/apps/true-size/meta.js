export default {
  id: "true-size",
  name: "True Size of Countries",
  tagline: "Drag countries across the map to compare their real size",
  category: "science",
  glyph: "TS",
  icon: "globe",
  tint: "#0d9488",
  keywords: ["true size of countries","compare country sizes","country size comparison","mercator projection","real size map","how big is greenland","country area","map distortion","world map","geography"],
  tag: "jg-app-true-size",
  window: {"width":1200,"height":820,"maximized":true},
  load: () => import('./index.js'),
};
