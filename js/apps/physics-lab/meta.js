export default {
  id: "physics-lab",
  name: "Physics Lab",
  tagline: "Balls, blocks, springs, rods, jacks and motors",
  category: "science",
  glyph: "v",
  icon: "cradle",
  tint: "#3f7f6d",
  keywords: ["physics","simulation","mechanics","gravity","spring","pendulum","collision","rigid body","motor","friction","sandbox"],
  tag: "jg-app-physics-lab",
  window: {"width":1120,"height":800,"maximized":true},
  i18n: {
    de: { name: 'Physiklabor', tagline: 'Kugeln, Blöcke, Federn, Stangen, Zylinder und Motoren' },
    es: { name: 'Laboratorio de física', tagline: 'Bolas, bloques, muelles, barras, cilindros y motores' },
    zh: { name: '物理实验室', tagline: '小球、方块、弹簧、连杆、液压缸与马达' },
  },
  load: () => import('./index.js'),
};
