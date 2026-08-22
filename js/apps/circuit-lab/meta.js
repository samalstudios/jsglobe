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
  i18n: {
    de: { name: 'Schaltungslabor', tagline: 'Einfache elektronische Schaltungen bauen und simulieren' },
    es: { name: 'Laboratorio de circuitos', tagline: 'Construir y simular circuitos electrónicos básicos' },
    zh: { name: '电路实验室', tagline: '搭建并模拟基础电子电路' },
  },
  load: () => import('./index.js'),
};
