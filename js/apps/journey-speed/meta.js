export default {
  id: "journey-speed",
  name: "Journey Speed",
  tagline: "Work out a trip's average speed and see how much time a faster pace really saves",
  category: "math",
  glyph: "KMH",
  icon: "clock",
  tint: "#0a84ff",
  keywords: ["average speed calculator","journey time calculator","driving time","travel time","time saved driving faster","speed difference","car trip","road trip","mph","km/h","speed distance time"],
  tag: "jg-app-journey-speed",
  window: {"width":980,"height":820},
  load: () => import('./index.js'),
};
