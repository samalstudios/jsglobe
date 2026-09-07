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
  load: () => import('./index.js'),
};
