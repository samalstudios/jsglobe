export default {
  id: "metro-maps",
  name: "Metro Maps",
  tagline: "Animated metro maps with routes between stations",
  category: "utility",
  glyph: "M",
  icon: "rail",
  tint: "#2563eb",
  keywords: ["metro map","subway map","underground map","route planner","london underground map","paris metro map","berlin u-bahn map","madrid metro map","toronto subway map","seoul subway map","multi stop route planner","transit map"],
  tag: "jg-app-metro-maps",
  window: {"width":1200,"height":820,"maximized":true},
  load: () => import('./index.js'),
};
