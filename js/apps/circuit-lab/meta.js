export default {
  id: "circuit-lab",
  name: "Circuit Lab",
  tagline: "Build and simulate basic electronic circuits",
  category: "science",
  glyph: "~",
  icon: "circuit",
  tint: "#4a7a58",
  keywords: ["circuit","electronics","simulator","resistor","capacitor","spice","ohm","science"],
  tag: "jg-app-circuit-lab",
  window: {"width":1080,"height":760,"maximized":true},
  load: () => import('./index.js'),
};
