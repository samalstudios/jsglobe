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
  i18n: {
    de: { name: 'Portfolio', tagline: 'Bestände, Aufteilung und Gewinn oder Verlust verfolgen' },
    es: { name: 'Cartera', tagline: 'Seguir posiciones, reparto y ganancias o pérdidas' },
    zh: { name: '投资组合', tagline: '跟踪持仓、配置与盈亏' },
  },
  load: () => import('./index.js'),
};
