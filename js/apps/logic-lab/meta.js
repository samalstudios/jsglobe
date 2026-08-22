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
  i18n: {
    de: { name: 'Logiklabor', tagline: 'Gatter, Flipflops, Zähler, Decoder und LED-Anzeigen' },
    es: { name: 'Laboratorio de lógica', tagline: 'Puertas, biestables, contadores, decodificadores y pantallas LED' },
    zh: { name: '逻辑实验室', tagline: '逻辑门、触发器、计数器、译码器与 LED 显示' },
  },
  load: () => import('./index.js'),
};
