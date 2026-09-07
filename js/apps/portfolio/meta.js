export default {
  id: "portfolio",
  name: "Portfolio",
  tagline: "Track holdings, allocation and profit or loss",
  category: "utility",
  glyph: "$",
  icon: "trending",
  tint: "#4a7a58",
  keywords: ["portfolio","stocks","shares","investing","profit","loss","allocation","crypto","positions"],
  tag: "jg-app-portfolio",
  widget: true,
  window: {"width":1040,"height":900},
  load: () => import('./index.js'),
};
