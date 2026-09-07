export default {
  id: "logic-lab",
  name: "Logic Lab",
  tagline: "Gates, flip-flops, counters, decoders and LED displays",
  category: "science",
  glyph: "&",
  icon: "gate",
  tint: "#4a6fa5",
  keywords: ["logic","digital","gate","and","or","xor","flip-flop","counter","seven segment","led matrix","decoder","multiplexer","boolean","circuit"],
  tag: "jg-app-logic-lab",
  window: {"width":1100,"height":780,"maximized":true},
  load: () => import('./index.js'),
};
